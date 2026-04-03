#!/usr/bin/env python3
"""
Backfill newly created buildings with NYC PLUTO data (BBL, BIN, year_built,
num_floors, total_units, building_class, land_use, owner_name).

Queries the NYC Open Data PLUTO SODA API by borough + house number + street name,
then updates the building record in Supabase.

Usage:
    python3 scripts/backfill-new-buildings.py                    # buildings created in last 24h
    python3 scripts/backfill-new-buildings.py --days=7           # last 7 days
    python3 scripts/backfill-new-buildings.py --all-missing      # all NYC buildings with bbl IS NULL
    python3 scripts/backfill-new-buildings.py --limit=10         # process at most 10
    python3 scripts/backfill-new-buildings.py --dry-run          # preview without DB writes
"""

import os
import re
import sys
import time
import argparse
import requests
from pathlib import Path
from datetime import datetime, timezone, timedelta

# ── ENV ──────────────────────────────────────────────────────────────────────
env_path = Path(__file__).parent.parent / ".env.local"
env = {}
if env_path.exists():
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            key, val = line.split("=", 1)
            env[key.strip()] = val.strip().strip('"').replace("\\n", "")

SUPABASE_URL = (os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or env.get("NEXT_PUBLIC_SUPABASE_URL", "")).strip().replace("\\n", "")
SERVICE_KEY = (os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("SUPABASE_SERVICE_ROLE_KEY", "")).strip().replace("\\n", "")

if not SUPABASE_URL or not SERVICE_KEY:
    print("ERROR: Missing SUPABASE_URL or SERVICE_KEY in .env.local or environment")
    sys.exit(1)

from supabase import create_client

supabase = create_client(SUPABASE_URL, SERVICE_KEY)

# ── CONSTANTS ────────────────────────────────────────────────────────────────
PLUTO_API = "https://data.cityofnewyork.us/resource/64uk-42ks.json"
REQUEST_DELAY = 0.25  # seconds between API calls (stay under rate limit)

# Borough name → PLUTO borough code
BOROUGH_CODES = {
    "Manhattan": "MN",
    "Brooklyn": "BK",
    "Queens": "QN",
    "Bronx": "BX",
    "Staten Island": "SI",
}

# PLUTO field → buildings table field
# Note: PLUTO has no BIN field; BIN can be derived from BBL via DOB datasets if needed
FIELD_MAP = {
    "bbl": "bbl",
    "yearbuilt": "year_built",
    "numfloors": "num_floors",
    "unitsres": "residential_units",
    "unitstotal": "total_units",
    "bldgclass": "building_class",
    "landuse": "land_use",
    "ownername": "owner_name",
}

# ── HELPERS ──────────────────────────────────────────────────────────────────

# Common street abbreviation mappings for normalization
STREET_ABBREVS = {
    "STREET": "ST",
    "AVENUE": "AVE",
    "BOULEVARD": "BLVD",
    "DRIVE": "DR",
    "PLACE": "PL",
    "ROAD": "RD",
    "COURT": "CT",
    "LANE": "LN",
    "TERRACE": "TER",
    "PARKWAY": "PKWY",
    "SQUARE": "SQ",
    "CIRCLE": "CIR",
}

# Reverse: expand abbreviations to full words
STREET_EXPAND = {v: k for k, v in STREET_ABBREVS.items()}


def normalize_street(street: str) -> str:
    """Normalize a street name: uppercase, remove ordinals, collapse spaces."""
    s = street.upper().strip()
    s = re.sub(r'(\d+)(?:ST|ND|RD|TH)\b', r'\1', s)
    s = re.sub(r'\s+', ' ', s)
    return s


def build_pluto_address(house_number: str, street_name: str) -> str:
    """Build a PLUTO-style address from house number + street name.

    PLUTO uses combined addresses like '425 WEST 50 STREET'.
    Ordinal suffixes are removed (50TH → 50).
    """
    s = street_name.upper().strip()
    # Remove ordinal suffixes: 1ST → 1, 2ND → 2, 3RD → 3, 4TH → 4
    s = re.sub(r'(\d+)(?:ST|ND|RD|TH)\b', r'\1', s)
    # Collapse multiple spaces
    s = re.sub(r'\s+', ' ', s)
    # Clean house number (take first part if hyphenated range like "414-445")
    hn = house_number.upper().strip()
    if "-" in hn:
        hn = hn.split("-")[0].strip()
    return f"{hn} {s}"


def _pluto_query(borough_code: str, where_clause: str) -> list:
    """Execute a PLUTO SODA query and return results."""
    params = {
        "$where": where_clause,
        "$limit": 5,
        "$select": ",".join(FIELD_MAP.keys()) + ",address",
    }
    resp = requests.get(PLUTO_API, params=params, timeout=15)
    resp.raise_for_status()
    return resp.json()


def query_pluto(borough_code: str, house_number: str, street_name: str) -> dict | None:
    """Query PLUTO SODA API for a building.

    PLUTO schema uses:
    - borough: 'MN', 'BK', 'QN', 'BX', 'SI'
    - address: combined field like '425 WEST 50 STREET'
    """
    pluto_addr = build_pluto_address(house_number, street_name)

    # Attempt 1: exact address match
    try:
        results = _pluto_query(borough_code, f"borough='{borough_code}' AND address='{pluto_addr}'")
        if results:
            return results[0]
    except Exception as e:
        print(f"    API error (exact): {e}")

    # Attempt 2: try abbreviating/expanding all street type words in the address
    # PLUTO may use "SOUTHERN BLVD" vs our "SOUTHERN BOULEVARD"
    parts = pluto_addr.split()
    hn_part = parts[0]  # house number
    street_parts = parts[1:]  # street words
    modified = False
    alt_parts = []
    for word in street_parts:
        alt = STREET_ABBREVS.get(word) or STREET_EXPAND.get(word)
        if alt:
            alt_parts.append(alt)
            modified = True
        else:
            alt_parts.append(word)
    if modified:
        alt_addr = hn_part + " " + " ".join(alt_parts)
        try:
            results = _pluto_query(borough_code, f"borough='{borough_code}' AND address='{alt_addr}'")
            if results:
                return results[0]
        except Exception:
            pass

    # Attempt 3: LIKE match with house number + key street words
    hn = house_number.upper().strip().split("-")[0].strip()
    # Extract the most distinctive street word (longest non-directional word)
    street_words = [w for w in normalize_street(street_name).split()
                    if w not in ("E", "W", "N", "S", "EAST", "WEST", "NORTH", "SOUTH")
                    and not w.isdigit()]
    if street_words:
        # Use the longest word as the key identifier
        key_word = max(street_words, key=len)
        try:
            results = _pluto_query(
                borough_code,
                f"borough='{borough_code}' AND address LIKE '{hn} %{key_word}%'"
            )
            if results:
                return results[0]
        except Exception:
            pass

    return None


def pluto_to_building_update(pluto_row: dict) -> dict:
    """Convert a PLUTO API result to a building update dict."""
    update = {}
    for pluto_field, db_field in FIELD_MAP.items():
        val = pluto_row.get(pluto_field)
        if val is None or val == "" or val == "0":
            continue
        # Convert numeric fields
        if db_field in ("year_built", "num_floors", "residential_units", "total_units"):
            try:
                val = int(float(val))
                if val == 0:
                    continue
            except (ValueError, TypeError):
                continue
        # BBL as string (PLUTO returns it as decimal like "1010607502.00000000")
        if db_field == "bbl":
            try:
                val = str(int(float(val)))
            except (ValueError, TypeError):
                continue
        # Owner name: title case
        if db_field == "owner_name" and isinstance(val, str):
            val = val.strip().title()
        update[db_field] = val
    return update


# ── MAIN ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Backfill new buildings with NYC PLUTO data")
    parser.add_argument("--days", type=int, default=1, help="Look back N days (default: 1)")
    parser.add_argument("--limit", type=int, default=0, help="Max buildings to process (0 = unlimited)")
    parser.add_argument("--dry-run", action="store_true", help="Preview without DB writes")
    parser.add_argument("--all-missing", action="store_true", help="Target all NYC buildings with bbl IS NULL")
    args = parser.parse_args()

    print(f"{'='*60}")
    print(f"NYC PLUTO Building Backfill")
    print(f"{'='*60}")
    print(f"Mode: {'DRY RUN' if args.dry_run else 'LIVE'}")

    # Build query
    query = supabase.table("buildings") \
        .select("id, full_address, house_number, street_name, borough, zip_code") \
        .is_("bbl", "null") \
        .in_("borough", list(BOROUGH_CODES.keys()))

    if not args.all_missing:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=args.days)).isoformat()
        query = query.gte("created_at", cutoff)
        print(f"Targeting buildings created in last {args.days} day(s)")
    else:
        print(f"Targeting ALL NYC buildings with missing BBL")

    if args.limit > 0:
        query = query.limit(args.limit)
        print(f"Limit: {args.limit}")

    result = query.execute()
    buildings = result.data
    print(f"Found {len(buildings)} buildings to backfill\n")

    if not buildings:
        print("Nothing to do.")
        return

    total_updated = 0
    total_skipped = 0
    total_failed = 0

    for i, bldg in enumerate(buildings):
        addr = bldg["full_address"]
        borough = bldg["borough"]
        house_num = bldg.get("house_number", "")
        street = bldg.get("street_name", "")

        if not house_num or not street:
            print(f"  [{i+1}/{len(buildings)}] SKIP {addr} (missing house_number or street_name)")
            total_skipped += 1
            continue

        borough_code = BOROUGH_CODES.get(borough)
        if not borough_code:
            print(f"  [{i+1}/{len(buildings)}] SKIP {addr} (unknown borough: {borough})")
            total_skipped += 1
            continue

        # Query PLUTO
        pluto = query_pluto(borough_code, house_num, street)

        if not pluto:
            print(f"  [{i+1}/{len(buildings)}] MISS {addr} (no PLUTO match)")
            total_failed += 1
            time.sleep(REQUEST_DELAY)
            continue

        update = pluto_to_building_update(pluto)
        if not update:
            print(f"  [{i+1}/{len(buildings)}] SKIP {addr} (PLUTO returned empty data)")
            total_skipped += 1
            time.sleep(REQUEST_DELAY)
            continue

        fields_str = ", ".join(f"{k}={v}" for k, v in update.items())

        if args.dry_run:
            print(f"  [{i+1}/{len(buildings)}] DRY RUN {addr} -> {fields_str}")
        else:
            try:
                update["updated_at"] = datetime.now(timezone.utc).isoformat()
                supabase.table("buildings").update(update).eq("id", bldg["id"]).execute()
                print(f"  [{i+1}/{len(buildings)}] UPDATED {addr} -> {fields_str}")
            except Exception as e:
                print(f"  [{i+1}/{len(buildings)}] ERROR {addr}: {e}")
                total_failed += 1
                time.sleep(REQUEST_DELAY)
                continue

        total_updated += 1
        time.sleep(REQUEST_DELAY)

    print(f"\n{'='*60}")
    print(f"SUMMARY")
    print(f"{'='*60}")
    print(f"Total buildings:  {len(buildings)}")
    print(f"Updated:          {total_updated}")
    print(f"Skipped:          {total_skipped}")
    print(f"No match / error: {total_failed}")


if __name__ == "__main__":
    main()

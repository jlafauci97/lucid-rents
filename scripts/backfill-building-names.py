#!/usr/bin/env python3
"""
Backfill building names from StreetEasy for NYC buildings missing names.

Targets large buildings (100+ units) first since they're most likely to have
marketing names and be searched by name.

Usage:
    python3 scripts/backfill-building-names.py              # default: 100+ unit buildings
    python3 scripts/backfill-building-names.py --min-units=50
    python3 scripts/backfill-building-names.py --limit=100
    python3 scripts/backfill-building-names.py --dry-run
"""

import json
import os
import re
import sys
import time
import argparse
from pathlib import Path
from datetime import datetime, timezone

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

from scrapling import StealthyFetcher
from supabase import create_client

supabase = create_client(SUPABASE_URL, SERVICE_KEY)
fetcher = StealthyFetcher()


def address_to_se_slug(house_number: str, street_name: str, borough: str) -> str:
    """Generate a StreetEasy building URL slug from address components."""
    hn = house_number.lower().replace("-", "_").strip()
    sn = re.sub(r'[^a-z0-9]+', '-', street_name.lower()).strip('-')
    boro_map = {
        "Manhattan": "new_york",
        "Brooklyn": "brooklyn",
        "Queens": "queens",
        "Bronx": "bronx",
        "Staten Island": "staten_island",
        "MANHATTAN": "new_york",
        "BROOKLYN": "brooklyn",
        "QUEENS": "queens",
        "BRONX": "bronx",
        "STATEN ISLAND": "staten_island",
    }
    boro = boro_map.get(borough, borough.lower().replace(" ", "_"))
    return f"{hn}-{sn}-{boro}"


def is_plain_address(name: str) -> bool:
    """Check if a string looks like a plain address rather than a building name."""
    return bool(re.match(
        r'^\d+[\-\s]?\d*\s+(East|West|North|South|E\.?|W\.?|N\.?|S\.?)?\s*\d*\s*'
        r'(Street|St\.?|Avenue|Ave\.?|Boulevard|Blvd\.?|Road|Rd\.?|Drive|Dr\.?|'
        r'Place|Pl\.?|Lane|Ln\.?|Court|Ct\.?|Way|Terrace|Ter\.?)\b',
        name, re.IGNORECASE
    ))


STREET_SUFFIXES = {
    "street", "st", "avenue", "ave", "boulevard", "blvd", "road", "rd",
    "drive", "dr", "place", "pl", "lane", "ln", "court", "ct", "way",
    "terrace", "ter", "loop", "oval", "circle", "cir", "plaza", "square",
    "parkway", "pkwy", "highway", "hwy", "alley", "crescent", "path",
}


def is_just_address(name: str, full_address: str) -> bool:
    """Check if a StreetEasy h1 is just a reformatted version of the address."""
    if not name:
        return True

    # Quick check: if name starts with a digit and ends with a street suffix,
    # it's almost certainly just a formatted address
    words = name.lower().split()
    if words and words[0][0].isdigit() and words[-1].rstrip(".,") in STREET_SUFFIXES:
        return True

    # Normalize both: lowercase, strip punctuation and ordinal suffixes
    def normalize(s: str) -> set[str]:
        cleaned = re.sub(r'[^a-z0-9\s]', '', s.lower())
        # Strip ordinal suffixes: 1st->1, 2nd->2, 3rd->3, 4th->4, etc.
        cleaned = re.sub(r'\b(\d+)(st|nd|rd|th)\b', r'\1', cleaned)
        return set(cleaned.split())

    name_words = normalize(name)
    addr_words = normalize(full_address.split(",")[0])  # just the street part

    if not name_words:
        return True

    # If most name words appear in the address, it's just a reformatted address
    overlap = name_words & addr_words
    return len(overlap) >= len(name_words) * 0.6


def fetch_building_name(house_number: str, street_name: str, borough: str, full_address: str) -> str | None:
    """Fetch a building's name from its StreetEasy page."""
    slug = address_to_se_slug(house_number, street_name, borough)
    url = f"https://streeteasy.com/building/{slug}"

    try:
        page = fetcher.fetch(url, headless=True, real_chrome=True)
        if not page or not page.status or page.status >= 400:
            return None

        h1_els = page.css("h1")
        if h1_els and len(h1_els) > 0:
            name = h1_els[0].text.strip()
            if name and not is_just_address(name, full_address):
                return name
    except Exception as e:
        print(f"    Fetch error: {e}")

    return None


def main():
    parser = argparse.ArgumentParser(description="Backfill building names from StreetEasy")
    parser.add_argument("--min-units", type=int, default=100, help="Minimum unit count to target")
    parser.add_argument("--limit", type=int, default=500, help="Max buildings to process")
    parser.add_argument("--dry-run", action="store_true", help="Preview without DB writes")
    parser.add_argument("--delay", type=float, default=3.0, help="Seconds between fetches")
    args = parser.parse_args()

    print(f"Fetching NYC buildings with {args.min_units}+ units and no name...")

    result = supabase.table("buildings") \
        .select("id, house_number, street_name, borough, full_address, total_units") \
        .eq("metro", "nyc") \
        .is_("name", "null") \
        .gte("total_units", args.min_units) \
        .not_.is_("house_number", "null") \
        .order("total_units", desc=True) \
        .limit(args.limit) \
        .execute()

    buildings = result.data or []
    print(f"Found {len(buildings)} buildings to check\n")

    found = 0
    skipped = 0
    errors = 0

    for i, b in enumerate(buildings):
        hn = b.get("house_number", "")
        sn = b.get("street_name", "")
        borough = b.get("borough", "")
        addr = b.get("full_address", "")
        units = b.get("total_units", 0)

        if not hn or not sn:
            skipped += 1
            continue

        print(f"[{i+1}/{len(buildings)}] {addr} ({units} units)...", end=" ", flush=True)

        name = fetch_building_name(hn, sn, borough, addr)

        if name:
            found += 1
            print(f'-> "{name}"')
            if not args.dry_run:
                try:
                    supabase.table("buildings") \
                        .update({"name": name}) \
                        .eq("id", b["id"]) \
                        .execute()
                except Exception as e:
                    print(f"    DB error: {e}")
                    errors += 1
        else:
            print("-> no name found")

        if i < len(buildings) - 1:
            time.sleep(args.delay)

    print(f"\nDone! Found {found} names, skipped {skipped}, errors {errors}")
    print(f"Total buildings checked: {len(buildings)}")


if __name__ == "__main__":
    main()

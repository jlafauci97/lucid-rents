#!/usr/bin/env python3
"""
Import scraped StreetEasy listing data from JSON file into building_rents.

Usage:
  python3 scripts/import-listings.py ~/Downloads/streeteasy-listings.json
  python3 scripts/import-listings.py ~/Downloads/streeteasy-listings.json --dry-run
"""

import json
import os
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone

# ── ENV ──────────────────────────────────────────────────────────────────────

def load_env_local():
    env_path = os.path.join(os.path.dirname(__file__), "..", ".env.local")
    env = {}
    with open(env_path, "r") as f:
        for line in f:
            line = line.strip()
            m = re.match(r"^([^#=]+)=(.*)$", line)
            if m:
                key = m.group(1).strip()
                val = m.group(2).strip()
                val = re.sub(r'^"|"$', "", val)
                val = val.replace("\\n", "")
                env[key] = val
    return env


env = load_env_local()
SUPABASE_URL = env.get("NEXT_PUBLIC_SUPABASE_URL", "")
SERVICE_KEY = env.get("SUPABASE_SERVICE_ROLE_KEY", "")

if not SUPABASE_URL or not SERVICE_KEY:
    print("Missing SUPABASE_URL or SERVICE_KEY in .env.local", file=sys.stderr)
    sys.exit(1)

from supabase import create_client

supabase = create_client(SUPABASE_URL, SERVICE_KEY)

# ── HELPERS ──────────────────────────────────────────────────────────────────

BOROUGH_MAP = {
    "manhattan": "Manhattan",
    "brooklyn": "Brooklyn",
    "queens": "Queens",
    "bronx": "Bronx",
    "staten-island": "Staten Island",
}


def normalize_address(addr):
    addr = addr.lower().strip()
    addr = re.sub(r"\s*#\S+", "", addr)
    addr = re.sub(r"\s*(?:apt|unit|suite|fl|floor)\s*\S+", "", addr, flags=re.I)
    # Strip ordinal suffixes: 37th -> 37, 1st -> 1, 2nd -> 2, 3rd -> 3, 53rd -> 53
    addr = re.sub(r"(\d+)(?:st|nd|rd|th)\b", r"\1", addr)
    # Expand abbreviations
    addr = re.sub(r"\bave\b", "avenue", addr)
    addr = re.sub(r"\bst\b(?!reet)", "street", addr)
    addr = re.sub(r"\bblvd\b", "boulevard", addr)
    addr = re.sub(r"\bdr\b(?!ive)", "drive", addr)
    addr = re.sub(r"\bpl\b(?!ace)", "place", addr)
    addr = re.sub(r"\s+", " ", addr).strip()
    return addr


# ── MAIN ─────────────────────────────────────────────────────────────────────

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 scripts/import-listings.py <listings.json> [--dry-run]")
        sys.exit(1)

    json_path = sys.argv[1]
    dry_run = "--dry-run" in sys.argv

    with open(json_path) as f:
        listings = json.load(f)

    print(f"Loaded {len(listings)} listings from {json_path}")

    # Group by building slug
    by_slug = defaultdict(list)
    for l in listings:
        by_slug[l["slug"]].append(l)

    print(f"Unique buildings: {len(by_slug)}")

    # Get unique zip codes
    zip_codes = set()
    for l in listings:
        if l.get("zip"):
            zip_codes.add(l["zip"])

    print(f"Unique zip codes: {len(zip_codes)}")

    # Fetch buildings from DB by zip code
    print("Querying database for matching buildings...")
    zip_buildings = {}  # zip -> {normalized_address -> building_id}

    for zip_code in sorted(zip_codes):
        try:
            result = supabase.table("buildings") \
                .select("id, full_address, borough, zip_code") \
                .eq("zip_code", zip_code) \
                .limit(2000) \
                .execute()
            for b in (result.data or []):
                # Normalize: take just the street part before the first comma
                street_part = b["full_address"].split(",")[0].strip()
                norm = normalize_address(street_part)
                zip_buildings.setdefault(zip_code, {})[norm] = b["id"]
        except Exception as e:
            print(f"  DB error for zip {zip_code}: {e}")

    total_db_buildings = sum(len(v) for v in zip_buildings.values())
    print(f"Found {total_db_buildings} buildings in DB across {len(zip_buildings)} zip codes")

    # Match listings to buildings
    matched = {}  # slug -> building_id
    unmatched = []

    for slug, slug_listings in by_slug.items():
        building_id = None

        for l in slug_listings:
            zip_code = l.get("zip", "")
            street = l.get("street", "")
            if not zip_code or not street:
                continue

            norm = normalize_address(street)
            building_id = zip_buildings.get(zip_code, {}).get(norm)
            if building_id:
                break

        if building_id:
            matched[slug] = {"building_id": building_id, "listings": slug_listings}
        else:
            unmatched.append(slug)

    print(f"\nMatched: {len(matched)} buildings")
    print(f"Unmatched: {len(unmatched)} buildings")

    if unmatched:
        print(f"\nSample unmatched slugs:")
        for slug in unmatched[:10]:
            sample = by_slug[slug][0]
            print(f"  {slug}: {sample.get('street', '?')} {sample.get('zip', '?')} ({sample.get('neighborhood', '?')})")

    if dry_run:
        print("\nDry run -- showing what would be upserted:")
        for slug, data in list(matched.items())[:10]:
            ls = data["listings"]
            by_beds = defaultdict(list)
            for l in ls:
                by_beds[l["beds"]].append(l["price"])
            for beds, prices in sorted(by_beds.items()):
                prices.sort()
                print(f"  {slug} ({beds}BR): ${min(prices)}-${max(prices)} ({len(prices)} listings)")
        return

    # Upsert to building_rents
    now = datetime.now(timezone.utc).isoformat()
    total_upserted = 0
    errors = 0

    for slug, data in matched.items():
        by_beds = defaultdict(list)
        for l in data["listings"]:
            if l["beds"] >= 0:
                by_beds[l["beds"]].append(l["price"])

        rows = []
        for beds, prices in by_beds.items():
            prices.sort()
            n = len(prices)
            mid = n // 2
            med = prices[mid] if n % 2 else round((prices[mid - 1] + prices[mid]) / 2)
            rows.append({
                "building_id": data["building_id"],
                "source": "streeteasy",
                "bedrooms": beds,
                "min_rent": prices[0],
                "max_rent": prices[-1],
                "median_rent": med,
                "listing_count": n,
                "scraped_at": now,
                "updated_at": now,
            })

        if rows:
            try:
                supabase.table("building_rents").upsert(
                    rows, on_conflict="building_id,source,bedrooms"
                ).execute()
                total_upserted += len(rows)
            except Exception as e:
                print(f"  Upsert error for {slug}: {e}")
                errors += 1

    print(f"\nDone!")
    print(f"  Upserted: {total_upserted} rent records for {len(matched)} buildings")
    print(f"  Errors: {errors}")


if __name__ == "__main__":
    main()

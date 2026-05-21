#!/usr/bin/env python3
"""
Pull NYS DEC Environmental Remediation Sites located in NYC (brownfields,
Superfund, hazardous waste cleanups) and write to nearby_concerns.

Uses the public Socrata API at data.ny.gov — no scrapling/browser needed.
Geocodes each site via NYC PlanningLabs GeoSearch.

Usage:
    python3 scripts/scrape-nys-brownfields.py
    python3 scripts/scrape-nys-brownfields.py --dry-run
"""

import argparse, os, re, sys, time
from datetime import datetime, timezone
from pathlib import Path

env_path = Path(__file__).parent.parent / ".env.local"
env = {}
if env_path.exists():
    for line in env_path.read_text().splitlines():
        if "=" in line and not line.strip().startswith("#"):
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")

SUPABASE_URL = (os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or env.get("NEXT_PUBLIC_SUPABASE_URL", "")).strip()
SERVICE_KEY = (os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("SUPABASE_SERVICE_ROLE_KEY", "")).strip()

import requests
from supabase import create_client

SOURCE = "nys_dec_remediation_sites"
SOURCE_URL = "https://data.ny.gov/Energy-Environment/Environmental-Remediation-Sites-Map/jvqh-m7fz"
SODA_ENDPOINT = "https://data.ny.gov/resource/c6ci-rzpg.json"
PAGE_SIZE = 1000

COUNTY_TO_BOROUGH = {
    "New York": "Manhattan",
    "Kings": "Brooklyn",
    "Queens": "Queens",
    "Bronx": "Bronx",
    "Richmond": "Staten Island",
}

NYC_COUNTIES = list(COUNTY_TO_BOROUGH.keys())


def geocode(address, borough=None):
    if not address:
        return None
    query = f"{address}, {borough}, NY" if borough else f"{address}, New York, NY"
    try:
        res = requests.get(
            "https://geosearch.planninglabs.nyc/v2/search",
            params={"text": query, "size": 1}, timeout=10,
        )
        features = res.json().get("features", [])
        if not features:
            return None
        coords = features[0]["geometry"]["coordinates"]
        return (coords[1], coords[0])
    except Exception as e:
        print(f"  geocode error for {address!r}: {e}")
        return None


def fetch_county(county):
    """Pull all remediation sites for one NYC county via Socrata pagination."""
    results = []
    offset = 0
    while True:
        params = {
            "$limit": PAGE_SIZE,
            "$offset": offset,
            "$where": f"county='{county}'",
        }
        res = requests.get(SODA_ENDPOINT, params=params, timeout=30)
        res.raise_for_status()
        page = res.json()
        if not page:
            break
        results.extend(page)
        if len(page) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
    return results


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if not SUPABASE_URL or not SERVICE_KEY:
        print("ERROR: missing env vars")
        sys.exit(1)

    supabase = None if args.dry_run else create_client(SUPABASE_URL, SERVICE_KEY)
    all_records = []
    now = datetime.now(timezone.utc).isoformat()

    for county in NYC_COUNTIES:
        borough = COUNTY_TO_BOROUGH[county]
        print(f"\n=== {borough} ({county} County) ===")
        try:
            sites = fetch_county(county)
        except Exception as e:
            print(f"  fetch failed: {e}")
            continue
        print(f"  {len(sites)} sites")

        for s in sites:
            program_number = s.get("program_number")
            if not program_number:
                continue
            address = s.get("address1", "").strip()
            if not address:
                continue
            coords = geocode(address, borough)
            if not coords:
                print(f"  SKIP no coords: {address}")
                continue
            lat, lng = coords
            name = (s.get("program_facility_name") or address)[:120]
            all_records.append({
                "metro": "nyc",
                "category": "environmental",
                "sub_category": "brownfield",
                "name": name,
                "address": address,
                "borough": borough,
                "geom": f"SRID=4326;POINT({lng} {lat})",
                "lat": lat,
                "lng": lng,
                "source": SOURCE,
                "source_url": SOURCE_URL,
                "source_record_id": program_number,
                "metadata": {
                    "program_type": s.get("program_type"),
                    "siteclass": s.get("siteclass"),
                    "county": county,
                    "zipcode": s.get("zipcode"),
                    "dec_region": s.get("dec_region"),
                },
                "active": True,
                "last_synced": now,
            })
            time.sleep(0.1)  # rate limit geocoder

    print(f"\n=== {len(all_records)} total geocoded ===")

    if args.dry_run:
        for r in all_records[:8]:
            mt = r["metadata"]
            print(f"  [{mt['program_type']}] {r['name'][:50]} @ {r['address']} ({r['borough']})")
        return

    for i in range(0, len(all_records), 100):
        batch = all_records[i:i + 100]
        try:
            supabase.table("nearby_concerns").upsert(batch, on_conflict="source,source_record_id").execute()
            print(f"  upserted batch: {len(batch)} rows")
        except Exception as e:
            print(f"  upsert failed: {e}")

    print(f"Done — {len(all_records)} rows written")


if __name__ == "__main__":
    main()

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

# Manhattan has ~5,968 records and takes ~25 min of geocoding. Running it
# last means any DNS-resolver fatigue at the tail end only affects the
# already-populated Manhattan data (the upserts are idempotent). The four
# outer-borough counties finish in <10 min combined while DNS is fresh.
NYC_COUNTIES = ["Kings", "Queens", "Bronx", "Richmond", "New York"]


def _request_with_retry(url, params, timeout, attempts=4):
    """GET with backoff. The macOS DNS resolver intermittently fails with
    `[Errno 8] nodename nor servname provided` after long-running scripts —
    we hit this on every county fetch after Manhattan's ~25-min geocode
    loop. Retrying with backoff buys time for the resolver to recover."""
    last_err = None
    for i in range(attempts):
        try:
            return requests.get(url, params=params, timeout=timeout)
        except Exception as e:
            last_err = e
            # Backoff: 2, 4, 8s
            if i < attempts - 1:
                time.sleep(2 ** (i + 1))
    raise last_err


def geocode(address, borough=None):
    if not address:
        return None
    query = f"{address}, {borough}, NY" if borough else f"{address}, New York, NY"
    try:
        res = _request_with_retry(
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
        res = _request_with_retry(SODA_ENDPOINT, params=params, timeout=30)
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
            # The NYS DEC dataset publishes lat/lng on every record — use
            # those directly. We previously geocoded every address, which
            # turned a 30-second job into a 4-6 hour one and added DNS
            # fatigue that broke per-county fetches.
            lat_raw = s.get("latitude")
            lng_raw = s.get("longitude")
            if lat_raw and lng_raw:
                try:
                    lat = float(lat_raw)
                    lng = float(lng_raw)
                except (TypeError, ValueError):
                    lat, lng = None, None
            else:
                lat, lng = None, None
            # Fall back to PlanningLabs geocoder only when the DEC record
            # lacks coordinates (a handful of older or intersection-style
            # records). Most rows skip this branch entirely.
            if lat is None or lng is None:
                coords = geocode(address, borough)
                if not coords:
                    print(f"  SKIP no coords: {address}")
                    continue
                lat, lng = coords
                time.sleep(0.1)  # rate limit geocoder fallback only
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

    print(f"\n=== {len(all_records)} total geocoded ===")

    # Dedupe by source_record_id. The NYS DEC dataset has multiple program
    # records sharing the same program_number (different operable units,
    # different program phases, etc.). Without this, the upsert fails with
    # "ON CONFLICT DO UPDATE command cannot affect row a second time"
    # because Postgres can't UPSERT the same (source, source_record_id)
    # tuple twice in one statement. First-wins is fine here — operable-unit
    # differences don't affect the data we surface in the UI.
    seen_ids: set[str] = set()
    deduped = []
    for r in all_records:
        sid = r["source_record_id"]
        if sid in seen_ids:
            continue
        seen_ids.add(sid)
        deduped.append(r)
    print(f"=== {len(deduped)} after dedupe by program_number ===")
    all_records = deduped

    if args.dry_run:
        for r in all_records[:8]:
            mt = r["metadata"]
            print(f"  [{mt['program_type']}] {r['name'][:50]} @ {r['address']} ({r['borough']})")
        return

    # Upsert in batches. We deliberately recreate the Supabase client every
    # batch — supabase-py's underlying httpx client caches DNS resolutions
    # internally, and after ~15 min of script wall-time (the geocoder loop
    # above) those cached lookups go stale and every batch fails with
    # `[Errno 8] nodename nor servname provided`. A fresh client per batch
    # forces a fresh DNS lookup and keeps the upsert side reliable.
    BATCH_SIZE = 100
    total_written = 0
    for i in range(0, len(all_records), BATCH_SIZE):
        batch = all_records[i:i + BATCH_SIZE]
        attempt = 0
        while attempt < 3:
            try:
                fresh = create_client(SUPABASE_URL, SERVICE_KEY)
                fresh.table("nearby_concerns").upsert(
                    batch, on_conflict="source,source_record_id"
                ).execute()
                total_written += len(batch)
                print(f"  upserted batch {i // BATCH_SIZE + 1}: {len(batch)} rows")
                break
            except Exception as e:
                attempt += 1
                print(f"  upsert attempt {attempt} failed: {e}")
                time.sleep(2 * attempt)
        else:
            print(f"  GIVING UP on batch {i // BATCH_SIZE + 1} after 3 attempts")

    print(f"Done — {total_written} of {len(all_records)} rows written")


if __name__ == "__main__":
    main()

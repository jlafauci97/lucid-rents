#!/usr/bin/env python3
"""
Pull NYC DOE public school locations (2019-2020 School Locations dataset)
and write to nearby_concerns as noise / school entries.

This is the one-shot backfill counterpart to
`supabase/functions/sync-nearby-concerns/modules/schools-nyc-doe.ts` —
same data shape, same dedupe/transform logic, but runs from a workstation
instead of the Deno edge runtime. Used to land data immediately; the
edge function handles ongoing weekly refresh.

Usage:
    python3 scripts/scrape-nyc-schools.py
    python3 scripts/scrape-nyc-schools.py --dry-run
"""

import argparse, os, sys
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

SOURCE = "nyc_doe_school_locations"
SOURCE_URL = "https://data.cityofnewyork.us/Education/2019-2020-School-Locations/wg9x-4ke6"
SODA_ENDPOINT = "https://data.cityofnewyork.us/resource/wg9x-4ke6.json"

# BBL first character → display borough.
BOROUGH_BY_BBL = {
    "1": "Manhattan",
    "2": "Bronx",
    "3": "Brooklyn",
    "4": "Queens",
    "5": "Staten Island",
}

# NYC bounding box for sanity-checking coords.
NYC_BBOX = {"lat_min": 40.4, "lat_max": 41.0, "lng_min": -74.3, "lng_max": -73.6}


def borough_from_bbl(bbl):
    if not bbl:
        return None
    return BOROUGH_BY_BBL.get(bbl[0])


def normalize(r):
    """Returns a nearby_concerns row dict, or None if the record should be skipped."""
    name = (r.get("location_name") or "").strip()
    if not name:
        return None
    if r.get("status_descriptions") and r["status_descriptions"] != "Open":
        return None

    try:
        lat = float(r.get("latitude"))
        lng = float(r.get("longitude"))
    except (TypeError, ValueError):
        return None
    if not (NYC_BBOX["lat_min"] <= lat <= NYC_BBOX["lat_max"]):
        return None
    if not (NYC_BBOX["lng_min"] <= lng <= NYC_BBOX["lng_max"]):
        return None

    cat = (r.get("location_category_description") or "").strip()
    if not cat or cat == "Administrative":
        return None

    location_code = (r.get("location_code") or "").strip()
    source_record_id = location_code or name

    return {
        "metro": "nyc",
        "category": "noise",
        "sub_category": "school",
        "name": name[:120],
        "address": (r.get("primary_address_line_1") or "").strip() or None,
        "borough": borough_from_bbl(r.get("borough_block_lot")),
        "lat": lat,
        "lng": lng,
        "geom": f"SRID=4326;POINT({lng} {lat})",
        "source": SOURCE,
        "source_url": SOURCE_URL,
        "source_record_id": source_record_id,
        "metadata": {
            "category": cat or None,
            "type": r.get("location_type_description"),
            "grades": r.get("grades_final_text"),
            "managed_by": r.get("managed_by_name"),
            "building_code": r.get("primary_building_code"),
            "nta": r.get("nta"),
        },
        "active": True,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if not SUPABASE_URL or not SERVICE_KEY:
        print("ERROR: missing env vars (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)")
        sys.exit(1)

    # Fetch all open schools (dataset is ~2,200 rows total, single page is fine).
    params = {"$limit": 5000, "status_descriptions": "Open"}
    print(f"Fetching {SODA_ENDPOINT} ...")
    res = requests.get(SODA_ENDPOINT, params=params, timeout=30)
    res.raise_for_status()
    raw = res.json()
    print(f"  {len(raw)} raw rows")

    rows = []
    seen_ids = set()
    now = datetime.now(timezone.utc).isoformat()
    for r in raw:
        out = normalize(r)
        if not out:
            continue
        # The DOE dataset has multiple program rows per building (an
        # elementary school plus a Pre-K program at the same site share
        # location_code). Dedupe first — Postgres rejects UPSERTs with
        # duplicate (source, source_record_id) tuples in a single
        # statement.
        if out["source_record_id"] in seen_ids:
            continue
        seen_ids.add(out["source_record_id"])
        out["last_synced"] = now
        rows.append(out)

    print(f"  {len(rows)} unique schools after dedupe")

    if args.dry_run:
        for r in rows[:8]:
            print(f"  [{r['borough']}] {r['name']} @ {r['address']} ({r['metadata']['category']})")
        return

    BATCH_SIZE = 100
    total_written = 0
    for i in range(0, len(rows), BATCH_SIZE):
        batch = rows[i : i + BATCH_SIZE]
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
        else:
            print(f"  GIVING UP on batch {i // BATCH_SIZE + 1} after 3 attempts")

    print(f"Done — {total_written} of {len(rows)} rows written")


if __name__ == "__main__":
    main()

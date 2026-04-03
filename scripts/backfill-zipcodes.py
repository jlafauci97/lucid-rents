#!/usr/bin/env python3
"""
Backfill ZIP codes (and lat/lon) for buildings missing them using Census Bureau geocoder.

Usage:
  python3 scripts/backfill-zipcodes.py --metro=houston
  python3 scripts/backfill-zipcodes.py --metro=miami --limit=0
  python3 scripts/backfill-zipcodes.py --metro=houston --threads=4

Census Bureau batch geocoder: free, no API key, 10K addresses per batch.
Single address endpoint: https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress
"""

import argparse
import json
import os
import re
import sys
import time
import traceback
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed

# ── ENV ──────────────────────────────────────────────────────────────────────

def load_env():
    for name in [".env.local", ".env.production.local"]:
        path = os.path.join(os.path.dirname(__file__), "..", name)
        if not os.path.exists(path):
            continue
        env = {}
        with open(path) as f:
            for line in f:
                m = re.match(r"^([^#=]+)=(.*)$", line.strip())
                if m:
                    k, v = m.group(1).strip(), m.group(2).strip().strip('"')
                    env[k] = v.replace("\\n", "")
        if env.get("NEXT_PUBLIC_SUPABASE_URL"):
            return env
    return {}

env = load_env()
SUPABASE_URL = (os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or env.get("NEXT_PUBLIC_SUPABASE_URL", "")).strip()
SERVICE_KEY = (os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("SUPABASE_SERVICE_ROLE_KEY", "")).strip()

if not SUPABASE_URL or not SERVICE_KEY:
    print("Missing SUPABASE_URL or SERVICE_KEY", file=sys.stderr)
    sys.exit(1)

from supabase import create_client
supabase = create_client(SUPABASE_URL, SERVICE_KEY)

# ── CLI ──────────────────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Backfill ZIP codes via Census geocoder")
parser.add_argument("--metro", required=True, choices=["nyc", "los-angeles", "chicago", "miami", "houston"])
parser.add_argument("--limit", type=int, default=500)
parser.add_argument("--threads", type=int, default=4)
parser.add_argument("--batch-size", type=int, default=500)
args = parser.parse_args()

UNLIMITED = args.limit == 0
BATCH_SIZE = args.batch_size

METRO_STATES = {
    "nyc": "NY",
    "los-angeles": "CA",
    "chicago": "IL",
    "miami": "FL",
    "houston": "TX",
}

METRO_CITIES = {
    "houston": "Houston, TX",
    "miami": "Miami, FL",
    "chicago": "Chicago, IL",
    "los-angeles": "Los Angeles, CA",
    "nyc": None,  # NYC addresses already include city
}

CENSUS_URL = "https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress"

# ── PROGRESS ─────────────────────────────────────────────────────────────────

PROGRESS_FILE = os.path.join(os.path.dirname(__file__), f".zipcode-backfill-progress-{args.metro}.json")

def load_progress():
    if os.path.exists(PROGRESS_FILE):
        try:
            with open(PROGRESS_FILE) as f:
                return json.load(f)
        except:
            pass
    return {"total_geocoded": 0, "total_failed": 0, "processed_ids": []}

def save_progress(progress):
    # Keep only last 50K IDs to avoid memory bloat
    progress["processed_ids"] = progress["processed_ids"][-50000:]
    with open(PROGRESS_FILE, "w") as f:
        json.dump(progress, f)

# ── GEOCODE ──────────────────────────────────────────────────────────────────

def geocode_address(address):
    """Geocode a single address using Census Bureau API. Returns (zip, lat, lon) or None."""
    try:
        resp = requests.get(CENSUS_URL, params={
            "address": address,
            "benchmark": "Public_AR_Current",
            "vintage": "Current_Current",
            "format": "json",
        }, timeout=15)

        if resp.status_code != 200:
            return None

        data = resp.json()
        matches = data.get("result", {}).get("addressMatches", [])
        if not matches:
            return None

        match = matches[0]
        coords = match.get("coordinates", {})
        addr_components = match.get("addressComponents", {})

        zip_code = addr_components.get("zip", "")
        lat = coords.get("y")
        lon = coords.get("x")

        if zip_code and lat and lon:
            return {"zip_code": zip_code, "latitude": float(lat), "longitude": float(lon)}
        elif zip_code:
            return {"zip_code": zip_code}

        return None
    except Exception as e:
        return None

# ── FETCH BUILDINGS ──────────────────────────────────────────────────────────

def fetch_buildings_without_zip(metro, limit, offset):
    """Get buildings missing ZIP codes."""
    result = supabase.from_("buildings") \
        .select("id, full_address, borough") \
        .eq("metro", metro) \
        .or_("zip_code.is.null,zip_code.eq.") \
        .order("id") \
        .range(offset, offset + limit - 1) \
        .execute()
    return result.data or []

# ── MAIN ─────────────────────────────────────────────────────────────────────

def main():
    metro = args.metro
    state = METRO_STATES[metro]
    city_suffix = METRO_CITIES[metro]
    limit = BATCH_SIZE if UNLIMITED else min(args.limit, BATCH_SIZE)

    print(f"ZIP code backfill -- metro={metro}, limit={'unlimited' if UNLIMITED else args.limit}, threads={args.threads}")

    progress = load_progress()
    processed_set = set(progress["processed_ids"][-50000:])
    print(f"Resuming: {progress['total_geocoded']} geocoded, {progress['total_failed']} failed")

    current_offset = 0
    total_geocoded = 0
    total_failed = 0
    total_processed = 0

    while True:
        buildings = fetch_buildings_without_zip(metro, limit, current_offset)
        buildings = [b for b in buildings if b["id"] not in processed_set]

        if not buildings:
            # Try advancing offset in case of already-processed buildings
            raw = fetch_buildings_without_zip(metro, limit, current_offset)
            if not raw:
                print("No more buildings to process.")
                break
            current_offset += limit
            continue

        print(f"\nBatch: {len(buildings)} buildings (offset={current_offset})")

        def process_one(building):
            bid = building["id"]
            addr = building["full_address"]

            # Append city/state if not already in address
            if city_suffix and state not in addr:
                addr = f"{addr}, {city_suffix}"

            result = geocode_address(addr)

            if result:
                # Update building with ZIP and optionally lat/lon
                update = {"zip_code": result["zip_code"]}
                if "latitude" in result:
                    update["latitude"] = result["latitude"]
                    update["longitude"] = result["longitude"]

                try:
                    supabase.table("buildings").update(update).eq("id", bid).execute()
                    print(f"  {addr} -> ZIP {result['zip_code']}")
                    return bid, True
                except Exception as e:
                    print(f"  {addr} -> DB error: {e}")
                    return bid, False
            else:
                return bid, False

        with ThreadPoolExecutor(max_workers=args.threads) as pool:
            futures = {pool.submit(process_one, b): b for b in buildings}
            for future in as_completed(futures):
                try:
                    bid, success = future.result()
                    if success:
                        total_geocoded += 1
                        progress["total_geocoded"] += 1
                    else:
                        total_failed += 1
                        progress["total_failed"] += 1
                    total_processed += 1
                    progress["processed_ids"].append(bid)
                except Exception as e:
                    print(f"  Worker error: {e}")
                    total_failed += 1

                if total_processed % 50 == 0:
                    save_progress(progress)
                    print(f"  [progress: {progress['total_geocoded']} geocoded, {progress['total_failed']} failed]")

        current_offset += limit
        save_progress(progress)

        if not UNLIMITED:
            break

    save_progress(progress)
    print(f"\nDone! {total_geocoded} geocoded, {total_failed} failed out of {total_processed} buildings.")
    print(f"Cumulative: {progress['total_geocoded']} geocoded, {progress['total_failed']} failed")


if __name__ == "__main__":
    max_retries = 50
    for attempt in range(max_retries):
        try:
            main()
            break
        except KeyboardInterrupt:
            print("\nInterrupted.")
            break
        except Exception as e:
            print(f"Crash #{attempt + 1}: {e} — auto-restarting in 5s...", file=sys.stderr)
            traceback.print_exc()
            time.sleep(5)

#!/usr/bin/env python3
"""
Backfill rent data from Realtor.com for buildings missing rent records.
Uses HomeHarvest (no browser needed — direct API calls to Realtor.com GraphQL).

Usage:
  python3 scripts/scrape-realtor-backfill.py                        # NYC, 500 buildings
  python3 scripts/scrape-realtor-backfill.py --metro=los-angeles    # LA
  python3 scripts/scrape-realtor-backfill.py --limit=0              # unlimited
  python3 scripts/scrape-realtor-backfill.py --threads=4            # 4 concurrent

Requires: pip3 install homeharvest supabase
"""

import argparse
import json
import os
import re
import sys
import time
import traceback
from datetime import datetime, timezone
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

parser = argparse.ArgumentParser(description="Backfill rents from Realtor.com")
parser.add_argument("--metro", default="nyc", choices=["nyc", "los-angeles", "chicago", "miami", "houston"])
parser.add_argument("--limit", type=int, default=500)
parser.add_argument("--threads", type=int, default=2)
parser.add_argument("--min-units", type=int, default=0)
args = parser.parse_args()

BATCH_SIZE = 500
UNLIMITED = args.limit == 0
SOURCE = "realtor"

# ── AMENITY CATEGORIZATION ──────────────────────────────────────────────────

AMENITY_CATEGORIES = {
    "doorman": "building", "concierge": "building", "elevator": "building",
    "lobby": "building", "package room": "building", "mail room": "building",
    "community room": "building", "lounge": "building", "co-working": "building",
    "business center": "building", "game room": "building", "playroom": "building",
    "library": "building", "wi-fi": "building", "wifi": "building",
    "wheelchair accessible": "building", "smoke free": "building",
    "roof deck": "outdoor", "rooftop": "outdoor", "terrace": "outdoor",
    "balcony": "outdoor", "patio": "outdoor", "garden": "outdoor",
    "courtyard": "outdoor", "pool": "outdoor", "swimming pool": "outdoor",
    "bbq": "outdoor", "grill": "outdoor",
    "gym": "fitness", "fitness center": "fitness", "fitness": "fitness",
    "yoga": "fitness", "sauna": "fitness", "spa": "fitness",
    "parking": "parking", "garage": "parking", "bike room": "parking",
    "bike storage": "parking", "ev charging": "parking",
    "laundry in unit": "laundry", "washer/dryer": "laundry",
    "in-unit laundry": "laundry", "laundry room": "laundry",
    "washer dryer": "laundry", "w/d": "laundry",
    "security": "security", "video intercom": "security",
    "surveillance": "security", "cctv": "security", "gated": "security",
    "pet friendly": "pet", "pets allowed": "pet", "dog friendly": "pet",
    "cat friendly": "pet", "dog run": "pet",
    "storage": "storage", "storage room": "storage",
    "penthouse": "luxury", "screening room": "luxury", "wine cellar": "luxury",
}

def categorize_amenity(text):
    lower = text.lower().strip()
    for kw, cat in AMENITY_CATEGORIES.items():
        if kw in lower:
            return cat
    return "other"

def normalize_amenity(text):
    return " ".join(w.capitalize() for w in text.strip().split())

def valid_price(p):
    return 500 <= p <= 50000

# ── FETCH BUILDINGS WITHOUT RENTS ────────────────────────────────────────────

def fetch_buildings_without_rents(metro, limit, offset):
    """Get buildings that have NO real rent data (HUD FMR doesn't count)."""
    result = supabase.rpc("get_buildings_without_real_rents", {
        "p_metro": metro,
        "p_borough": None,
        "p_limit": limit,
        "p_offset": offset,
        "p_min_units": args.min_units,
    }).execute()
    return result.data or []

# ── SCRAPE ONE BUILDING ──────────────────────────────────────────────────────

def scrape_building(building):
    """Search Realtor.com for a building's address and extract rent data."""
    from homeharvest import scrape_property

    addr = building["full_address"]
    bid = building["id"]

    try:
        # Search with tight radius to get exact building matches
        props = scrape_property(
            location=addr,
            listing_type="for_rent",
            radius=0.05,  # ~250ft radius
        )
    except Exception as e:
        print(f"  [{bid[:8]}] HomeHarvest error for {addr}: {e}")
        return {"rents": 0, "amenities": 0}

    if props is None or len(props) == 0:
        return {"rents": 0, "amenities": 0}

    # Aggregate rents by bedroom count
    rent_data = {}  # beds -> [prices]
    amenities_set = set()

    import pandas as pd

    for _, row in props.iterrows():
        price = row.get("list_price")
        if pd.isna(price):
            price = row.get("list_price_min")
        beds = row.get("beds")

        if pd.notna(price) and pd.notna(beds):
            try:
                p = int(float(price))
                b = int(float(beds))
            except (ValueError, TypeError):
                continue
            if valid_price(p) and 0 <= b <= 6:
                rent_data.setdefault(b, []).append(p)

        # Extract text description for amenities
        text = row.get("text")
        if pd.notna(text) and text:
            text = str(text).lower()
            for kw in AMENITY_CATEGORIES:
                if kw in text:
                    amenities_set.add(normalize_amenity(kw))

        # Style field sometimes has property type info
        style = row.get("style")
        if pd.notna(style) and style:
            style = str(style).lower()
            for kw in AMENITY_CATEGORIES:
                if kw in style:
                    amenities_set.add(normalize_amenity(kw))

    # Upsert rents
    rents_saved = upsert_rents(bid, rent_data)
    amenities_saved = upsert_amenities(bid, amenities_set)

    return {"rents": rents_saved, "amenities": amenities_saved}


# ── DATABASE WRITES ──────────────────────────────────────────────────────────

def upsert_rents(building_id, rent_data):
    if not rent_data:
        return 0
    now = datetime.now(timezone.utc).isoformat()
    rows = []
    history_rows = []
    for beds, prices in rent_data.items():
        if not prices:
            continue
        prices.sort()
        n = len(prices)
        mid = n // 2
        median = prices[mid] if n % 2 else round((prices[mid - 1] + prices[mid]) / 2)
        rows.append({
            "building_id": building_id,
            "source": SOURCE,
            "bedrooms": beds,
            "min_rent": prices[0],
            "max_rent": prices[-1],
            "median_rent": median,
            "listing_count": n,
            "scraped_at": now,
            "updated_at": now,
        })
        history_rows.append({
            "building_id": building_id,
            "source": SOURCE,
            "bedrooms": beds,
            "rent": median,
            "observed_at": now,
        })

    try:
        supabase.table("building_rents").upsert(
            rows, on_conflict="building_id,source,bedrooms"
        ).execute()
    except Exception as e:
        print(f"  Rent upsert error: {e}")
        return 0

    try:
        supabase.table("unit_rent_history").upsert(
            history_rows, on_conflict="building_id,source,unit_number,bedrooms,rent,observed_at"
        ).execute()
    except Exception:
        pass

    return len(rows)


def upsert_amenities(building_id, amenities_set):
    if not amenities_set:
        return 0
    now = datetime.now(timezone.utc).isoformat()
    rows = [{
        "building_id": building_id,
        "source": SOURCE,
        "amenity": a,
        "category": categorize_amenity(a),
        "scraped_at": now,
    } for a in amenities_set]

    try:
        supabase.table("building_amenities").upsert(
            rows, on_conflict="building_id,source,amenity"
        ).execute()
        return len(rows)
    except Exception as e:
        print(f"  Amenity upsert error: {e}")
        return 0


# ── PROGRESS TRACKING ────────────────────────────────────────────────────────

PROGRESS_FILE = os.path.join(os.path.dirname(__file__), f".realtor-backfill-progress-{args.metro}.json")

def load_progress():
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE) as f:
            return json.load(f)
    return {"scraped_ids": [], "total_rents": 0, "total_amenities": 0, "total_buildings": 0}

def save_progress(progress):
    with open(PROGRESS_FILE, "w") as f:
        json.dump(progress, f)


# ── MAIN ─────────────────────────────────────────────────────────────────────

def main():
    metro = args.metro
    limit = BATCH_SIZE if UNLIMITED else min(args.limit, BATCH_SIZE)
    print(f"Realtor.com backfill -- metro={metro}, limit={'unlimited' if UNLIMITED else args.limit}, threads={args.threads}")

    progress = load_progress()
    scraped_set = set(progress["scraped_ids"][-50000:])  # keep last 50K to avoid memory bloat
    print(f"Resuming: {progress['total_buildings']} buildings done, {progress['total_rents']} rents, {progress['total_amenities']} amenities")

    current_offset = 0
    total_rents = 0
    total_amenities = 0
    total_processed = 0

    empty_streak = 0
    while True:
        raw_buildings = fetch_buildings_without_rents(metro, limit, current_offset)
        if not raw_buildings:
            if UNLIMITED and current_offset > 0:
                print("No more buildings to process.")
            break

        buildings = [b for b in raw_buildings if b["id"] not in scraped_set]

        if not buildings:
            # All buildings in this batch were already scraped — advance offset and keep going
            current_offset += limit
            empty_streak += 1
            if empty_streak > 20:
                print("20 consecutive empty batches — stopping.")
                break
            print(f"  [skipped batch at offset={current_offset - limit}, all {len(raw_buildings)} already scraped]")
            continue
        empty_streak = 0

        print(f"\nBatch: {len(buildings)} buildings (offset={current_offset})")

        def process_one(building):
            addr = building["full_address"]
            try:
                result = scrape_building(building)
                r, a = result["rents"], result["amenities"]
                status = f"{r} rents, {a} amenities" if r or a else "no data"
                print(f"  {addr} -> {status}")
            except Exception as e:
                print(f"  {addr} -> ERROR: {e}")
                r, a = 0, 0
            time.sleep(1)  # be polite to Realtor.com API
            return building["id"], r, a

        with ThreadPoolExecutor(max_workers=args.threads) as pool:
            futures = {pool.submit(process_one, b): b for b in buildings}
            for future in as_completed(futures):
                try:
                    bid, r, a = future.result()
                    total_rents += r
                    total_amenities += a
                    total_processed += 1
                    progress["scraped_ids"].append(bid)
                    progress["total_rents"] += r
                    progress["total_amenities"] += a
                    progress["total_buildings"] += 1
                except Exception as e:
                    print(f"  Worker error: {e}")

                if total_processed % 10 == 0:
                    save_progress(progress)
                    print(f"  [progress saved: {progress['total_buildings']} buildings, {progress['total_rents']} rents]")

        current_offset += limit
        save_progress(progress)

        if not UNLIMITED:
            break

    save_progress(progress)
    print(f"\nDone! {total_rents} rents, {total_amenities} amenities for {total_processed} buildings.")
    print(f"Cumulative: {progress['total_buildings']} buildings, {progress['total_rents']} rents, {progress['total_amenities']} amenities")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nInterrupted.")
    except Exception as e:
        print(f"Fatal: {e}", file=sys.stderr)
        traceback.print_exc()
        sys.exit(1)

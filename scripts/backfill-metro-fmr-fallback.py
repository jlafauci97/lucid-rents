#!/usr/bin/env python3
"""
Apply metro-level average HUD FMR to ALL buildings that have zero rent data.
This is the final fallback to achieve 100% rent coverage.

Usage:
  python3 scripts/backfill-metro-fmr-fallback.py --metro=houston
  python3 scripts/backfill-metro-fmr-fallback.py --metro=miami
"""

import argparse
import os
import re
import sys
import time

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

from supabase import create_client
supabase = create_client(SUPABASE_URL, SERVICE_KEY)

parser = argparse.ArgumentParser()
parser.add_argument("--metro", required=True)
parser.add_argument("--batch-size", type=int, default=500)
args = parser.parse_args()

# Metro-level average FMR (from HUD data, ZIP codes starting with 77/33/etc)
METRO_FMR = {
    "houston":     {0: 1105, 1: 1161, 2: 1386, 3: 1834, 4: 2261},
    "miami":       {0: 1618, 1: 1752, 2: 2122, 3: 2787, 4: 3328},
    "chicago":     {0: 1034, 1: 1134, 2: 1339, 3: 1718, 4: 1958},
    "los-angeles": {0: 1479, 1: 1680, 2: 2126, 3: 2885, 4: 3198},
    "nyc":         {0: 1535, 1: 1617, 2: 1884, 3: 2378, 4: 2642},
}

metro = args.metro
fmr = METRO_FMR.get(metro)
if not fmr:
    print(f"No FMR data for {metro}")
    sys.exit(1)

print(f"Backfilling metro-level FMR for {metro}: {fmr}")

cursor = None
total_inserted = 0
total_skipped = 0
batch_num = 0

while True:
    # Fetch buildings without ANY rent data
    query = supabase.from_("buildings").select("id").eq("metro", metro).order("id").limit(args.batch_size)
    if cursor:
        query = query.gt("id", cursor)

    result = query.execute()
    buildings = result.data or []

    if not buildings:
        break

    cursor = buildings[-1]["id"]
    batch_num += 1
    ids = [b["id"] for b in buildings]

    # Check which ones already have rent data
    has_rents = set()
    for i in range(0, len(ids), 100):
        chunk = ids[i:i+100]
        existing = supabase.from_("building_rents").select("building_id").in_("building_id", chunk).execute()
        for r in (existing.data or []):
            has_rents.add(r["building_id"])

    # Insert FMR for buildings without rent data
    need_fmr = [bid for bid in ids if bid not in has_rents]
    total_skipped += len(ids) - len(need_fmr)

    if need_fmr:
        rows = []
        for bid in need_fmr:
            for beds, rent in fmr.items():
                rows.append({
                    "building_id": bid,
                    "source": "hud_fmr",
                    "bedrooms": beds,
                    "min_rent": round(rent * 0.85),
                    "max_rent": round(rent * 1.15),
                    "median_rent": rent,
                    "listing_count": 0,
                })

        # Insert in chunks of 50 (no upsert — these buildings have no rent data)
        for i in range(0, len(rows), 50):
            chunk = rows[i:i+50]
            try:
                supabase.table("building_rents").insert(chunk).execute()
            except Exception as e:
                # If duplicate, try one at a time
                if "duplicate" in str(e).lower() or "conflict" in str(e).lower():
                    for row in chunk:
                        try:
                            supabase.table("building_rents").insert(row).execute()
                        except:
                            pass
                else:
                    print(f"  Insert error: {e}")

        total_inserted += len(need_fmr)

    if batch_num % 10 == 0:
        print(f"  Batch {batch_num}: {total_inserted} buildings filled, {total_skipped} skipped (already have rents)")

print(f"\nDone! {total_inserted} buildings filled with metro-level FMR, {total_skipped} skipped.")

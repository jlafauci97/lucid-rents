#!/usr/bin/env python3
"""
Scrape adult homeless shelter / drop-in center locations from Coalition for
the Homeless public directories. Writes to nearby_concerns table.

Family shelters are intentionally excluded.

Usage:
    python3 scripts/scrape-coalition-homeless.py
    python3 scripts/scrape-coalition-homeless.py --dry-run
"""

import argparse
import os
import re
import sys
import time
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path

# Env loading — match existing pattern
env_path = Path(__file__).parent.parent / ".env.local"
env = {}
if env_path.exists():
    for line in env_path.read_text().splitlines():
        if "=" in line and not line.strip().startswith("#"):
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")

SUPABASE_URL = (os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or env.get("NEXT_PUBLIC_SUPABASE_URL", "")).strip()
SERVICE_KEY = (os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("SUPABASE_SERVICE_ROLE_KEY", "")).strip()

# Late imports so env check fails fast
import requests
from scrapling import StealthyFetcher
from supabase import create_client

SOURCE = "coalition_for_homeless"
SOURCE_URL_BASE = "https://www.coalitionforthehomeless.org"

# Pages to scrape (add/remove as discovery yields more)
SCRAPE_TARGETS = [
    {
        "url": "https://www.coalitionforthehomeless.org/our-programs/our-emergency-resources/",
        "label": "emergency_resources",
    },
    {
        "url": "https://www.coalitionforthehomeless.org/our-programs/grand-central-food-program/",
        "label": "grand_central_food",
    },
]

FAMILY_KEYWORDS = ["family", "families", "with children", "mother", "child"]

# ─── helpers ──────────────────────────────────────────────────────────────────

def geocode(address: str, borough: str = None) -> tuple[float, float] | None:
    """Geocode via NYC GeoSearch. Returns (lat, lng) or None on failure."""
    if not address:
        return None
    query = f"{address}, {borough}, NY" if borough else f"{address}, NY"
    try:
        res = requests.get(
            "https://geosearch.planninglabs.nyc/v2/search",
            params={"text": query, "size": 1},
            timeout=10,
        )
        res.raise_for_status()
        features = res.json().get("features", [])
        if not features:
            return None
        coords = features[0]["geometry"]["coordinates"]
        return (coords[1], coords[0])  # [lng, lat] → (lat, lng)
    except Exception as e:
        print(f"  geocode failed for {address!r}: {e}")
        return None


def slugify(text: str) -> str:
    """Stable slug for source_record_id."""
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")


def is_family_shelter(text: str) -> bool:
    lower = text.lower()
    return any(kw in lower for kw in FAMILY_KEYWORDS)


def parse_records_from_page(html: str, source_url: str) -> list[dict]:
    """
    Parse a Coalition page HTML for shelter/dropin records.
    Returns list of dicts: {name, address, borough, raw_text}
    """
    # Coalition's pages typically embed addresses in <p> or <li> tags near program names.
    # Conservative regex-based extraction: find lines that look like street addresses
    # (number + street name + optional borough) near program-name sentences.
    records = []
    # Match "<num> <street> ..., Manhattan/Brooklyn/Queens/Bronx/Staten Island"
    addr_re = re.compile(
        r"(\d{1,5}\s+[A-Z][A-Za-z0-9.\- ]{3,60}(?:Street|St\.?|Avenue|Ave\.?|Road|Rd\.?|Boulevard|Blvd\.?|Place|Pl\.?|Drive|Dr\.?|Way|Lane|Ln\.?))(?:[^,\n]{0,40},?\s+(Manhattan|Brooklyn|Queens|Bronx|Staten Island))?",
        re.IGNORECASE,
    )
    # Strip HTML tags to plain text for matching
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text)
    seen_addresses = set()
    for m in addr_re.finditer(text):
        address = m.group(1).strip()
        borough = m.group(2)
        if address.lower() in seen_addresses:
            continue
        seen_addresses.add(address.lower())
        # Pull 100 chars around the match for context — used for family-keyword check
        ctx_start = max(0, m.start() - 80)
        ctx_end = min(len(text), m.end() + 80)
        context = text[ctx_start:ctx_end]
        if is_family_shelter(context):
            continue
        # Use the address as the name if we can't extract a program name from nearby words
        name = context.strip()
        # Trim to a reasonable program name — first 80 chars
        name = re.sub(r"\s+", " ", name)[:80]
        records.append({
            "name": name,
            "address": address,
            "borough": borough,
            "source_url": source_url,
        })
    return records


# ─── main ────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Print what would be written, no DB writes")
    args = parser.parse_args()

    if not SUPABASE_URL or not SERVICE_KEY:
        print("ERROR: Missing SUPABASE_URL or SERVICE_KEY")
        sys.exit(1)

    if args.dry_run:
        print("DRY RUN — no DB writes")
        supabase = None
    else:
        supabase = create_client(SUPABASE_URL, SERVICE_KEY)

    all_records: list[dict] = []
    seen_addresses = set()

    for target in SCRAPE_TARGETS:
        print(f"\n=== Scraping {target['url']} ===")
        try:
            page = StealthyFetcher.fetch(target["url"], real_chrome=True)
            html = page.html_content if hasattr(page, "html_content") else str(page)
        except Exception as e:
            print(f"  fetch failed: {e}")
            continue

        records = parse_records_from_page(html, target["url"])
        print(f"  found {len(records)} candidate records")

        for r in records:
            if r["address"].lower() in seen_addresses:
                continue
            seen_addresses.add(r["address"].lower())

            coords = geocode(r["address"], r.get("borough"))
            if not coords:
                print(f"  SKIP no coords: {r['address']}")
                continue
            lat, lng = coords

            now = datetime.now(timezone.utc).isoformat()
            row = {
                "metro": "nyc",
                "category": "public_safety",
                "sub_category": "homeless_shelter_adult",
                "name": r["name"],
                "address": r["address"],
                "borough": r.get("borough"),
                "geom": f"SRID=4326;POINT({lng} {lat})",
                "lat": lat,
                "lng": lng,
                "source": SOURCE,
                "source_url": r["source_url"],
                "source_record_id": slugify(r["address"]),
                "metadata": {
                    "operator": "Coalition for the Homeless",
                    "population": "adult",
                    "scrape_label": target["label"],
                    "scrape_date": now,
                },
                "active": True,
                "last_synced": now,
            }
            all_records.append(row)

        time.sleep(2)  # rate limit between pages

    print(f"\n=== {len(all_records)} unique geocoded records ready ===")

    if args.dry_run:
        for r in all_records[:5]:
            print(f"  {r['name'][:60]} @ {r['address']} ({r['lat']:.4f}, {r['lng']:.4f})")
        print(f"  ... {len(all_records)} total")
        return

    # Upsert in batches
    BATCH_SIZE = 100
    for i in range(0, len(all_records), BATCH_SIZE):
        batch = all_records[i:i + BATCH_SIZE]
        try:
            supabase.table("nearby_concerns").upsert(
                batch, on_conflict="source,source_record_id"
            ).execute()
            print(f"  upserted batch {i // BATCH_SIZE + 1}: {len(batch)} rows")
        except Exception as e:
            print(f"  upsert failed: {e}")

    print(f"\nDone — wrote {len(all_records)} rows to nearby_concerns")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Scrape NYPD precinct station addresses and write to nearby_concerns under
the `sirens` sub-category (with metadata.facility_type = 'precinct').

Usage:
    python3 scripts/scrape-nypd-precincts.py
    python3 scripts/scrape-nypd-precincts.py --dry-run
"""

import argparse
import os
import re
import sys
import time
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
from scrapling import StealthyFetcher
from supabase import create_client

SOURCE = "nypd_precinct_directory"
LANDING_URL = "https://www.nyc.gov/site/nypd/bureaus/patrol/find-your-precinct.page"

ADDR_RE = re.compile(
    r"(\d{1,5}\s+[A-Z][A-Za-z0-9.\- ]{3,60}(?:Street|St\.?|Avenue|Ave\.?|Road|Rd\.?|Boulevard|Blvd\.?|Place|Pl\.?|Drive|Dr\.?|Way|Lane|Ln\.?))",
    re.IGNORECASE,
)

BOROUGHS = ["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"]
PRECINCT_LINK_RE = re.compile(r"precincts/(\d+)(?:st|nd|rd|th)-precinct\.page", re.IGNORECASE)


def precinct_suffix(n):
    if n % 100 in [11, 12, 13]:
        return "th"
    last = n % 10
    return {1: "st", 2: "nd", 3: "rd"}.get(last, "th")


def precinct_name(n):
    return f"NYPD {n}{precinct_suffix(n)} Precinct"


def geocode(address, borough=None):
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
        print(f"  geocode error: {e}")
        return None


def detect_borough(text):
    for b in BOROUGHS:
        if b.lower() in text.lower():
            return b
    return None


def scrape_precinct_page(precinct_num):
    """Fetch one precinct page and extract its address."""
    suffix = precinct_suffix(precinct_num)
    url = f"https://www.nyc.gov/site/nypd/bureaus/patrol/precincts/{precinct_num}{suffix}-precinct.page"
    try:
        page = StealthyFetcher.fetch(url, real_chrome=True)
        html = page.html_content if hasattr(page, "html_content") else str(page)
    except Exception as e:
        print(f"  fetch failed for {precinct_num}: {e}")
        return None
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text)
    m = ADDR_RE.search(text)
    if not m:
        return None
    address = m.group(1).strip()
    borough = detect_borough(text)
    return {"precinct": precinct_num, "address": address, "borough": borough, "url": url}


def discover_precincts():
    """Fetch the find-your-precinct landing page to discover precinct numbers."""
    try:
        page = StealthyFetcher.fetch(LANDING_URL, real_chrome=True)
        html = page.html_content if hasattr(page, "html_content") else str(page)
    except Exception as e:
        print(f"  landing fetch failed: {e}")
        return []
    nums = set()
    for m in PRECINCT_LINK_RE.finditer(html):
        try:
            nums.add(int(m.group(1)))
        except ValueError:
            pass
    return sorted(nums)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if not SUPABASE_URL or not SERVICE_KEY:
        print("ERROR: missing env vars")
        sys.exit(1)

    supabase = None if args.dry_run else create_client(SUPABASE_URL, SERVICE_KEY)

    precincts = discover_precincts()
    print(f"=== Discovered {len(precincts)} precincts ===")

    if not precincts:
        # Fallback: try a numeric range
        precincts = list(range(1, 124))
        print(f"  fallback: scanning 1-123")

    all_records = []
    now = datetime.now(timezone.utc).isoformat()

    for n in precincts:
        rec = scrape_precinct_page(n)
        if not rec:
            continue
        coords = geocode(rec["address"], rec.get("borough"))
        if not coords:
            print(f"  SKIP precinct {n}: no coords for {rec['address']}")
            continue
        lat, lng = coords
        all_records.append({
            "metro": "nyc",
            "category": "noise",
            "sub_category": "sirens",
            "name": precinct_name(n),
            "address": rec["address"],
            "borough": rec.get("borough"),
            "geom": f"SRID=4326;POINT({lng} {lat})",
            "lat": lat,
            "lng": lng,
            "source": SOURCE,
            "source_url": rec["url"],
            "source_record_id": f"NYPD-{n}",
            "metadata": {
                "facility_type": "precinct",
                "precinct_number": n,
            },
            "active": True,
            "last_synced": now,
        })
        print(f"  precinct {n}: {rec['address']} ({rec.get('borough')})")
        time.sleep(1)  # rate limit per precinct page

    print(f"\n=== {len(all_records)} precinct rows ready ===")

    if args.dry_run:
        for r in all_records[:5]:
            print(f"  {r['name']} @ {r['address']}")
        return

    for i in range(0, len(all_records), 100):
        batch = all_records[i:i + 100]
        try:
            supabase.table("nearby_concerns").upsert(batch, on_conflict="source,source_record_id").execute()
            print(f"  upserted {len(batch)} rows")
        except Exception as e:
            print(f"  upsert failed: {e}")

    print(f"Done — {len(all_records)} rows written")


if __name__ == "__main__":
    main()

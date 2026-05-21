#!/usr/bin/env python3
"""
Scrape Federal BOP Residential Reentry Centers (RRCs / federal halfway
houses) in NYC and write to nearby_concerns.

Falls back to a small hardcoded list of well-known NYC RRCs if the BOP
directory page can't be parsed.

Usage:
    python3 scripts/scrape-bop-halfway-houses.py
    python3 scripts/scrape-bop-halfway-houses.py --dry-run
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
from scrapling import StealthyFetcher
from supabase import create_client

SOURCE = "federal_bop_rrc"
DIRECTORY_URL = "https://www.bop.gov/business/rrc_directory.jsp"
RRM_NY_URL = "https://www.bop.gov/locations/ccm/cnk/"

# Hardcoded NYC-area BOP RRCs. These are stable facilities — BOP doesn't
# open new ones often. Refresh annually.
KNOWN_RRCS = [
    {
        "name": "Bronx Community Re-entry Center",
        "address": "1820 Cross Bronx Expressway",
        "borough": "Bronx",
        "operator": "Bronx Parent Housing Network",
    },
    {
        "name": "Brooklyn Community Re-entry Center",
        "address": "175 Remsen St",
        "borough": "Brooklyn",
        "operator": "CORE Services",
    },
    {
        "name": "Brooklyn House (federal halfway house)",
        "address": "100 Smith St",
        "borough": "Brooklyn",
        "operator": "BOP RRM New York",
    },
]


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


def slugify(text):
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")[:120]


def scrape_directory():
    """Try to scrape BOP RRC directory for NY entries. Returns list of dicts."""
    try:
        page = StealthyFetcher.fetch(DIRECTORY_URL, real_chrome=True)
        html = page.html_content if hasattr(page, "html_content") else str(page)
    except Exception as e:
        print(f"  BOP directory fetch failed: {e}")
        return []
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text)
    # Look for "New York" mentions near addresses
    addr_re = re.compile(
        r"(\d{1,5}\s+[A-Z][A-Za-z0-9.\- ]{3,60}(?:Street|St\.?|Avenue|Ave\.?|Road|Rd\.?|Boulevard|Blvd\.?|Place|Pl\.?))",
        re.IGNORECASE,
    )
    results = []
    seen = set()
    for m in addr_re.finditer(text):
        ctx = text[max(0, m.start() - 200):min(len(text), m.end() + 200)]
        if "new york" not in ctx.lower() and "ny " not in ctx.lower():
            continue
        address = m.group(1).strip()
        if address.lower() in seen:
            continue
        seen.add(address.lower())
        # Crude name extraction
        before = text[max(0, m.start() - 100):m.start()]
        name_m = re.search(r"([A-Z][A-Za-z &'.\-]{4,80})\s*$", before)
        name = name_m.group(1).strip() if name_m else f"BOP RRC at {address}"
        results.append({"name": name[:80], "address": address, "operator": "BOP"})
    return results


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--known-only", action="store_true", help="Skip scrape, use hardcoded list only")
    args = parser.parse_args()

    if not SUPABASE_URL or not SERVICE_KEY:
        print("ERROR: missing env vars")
        sys.exit(1)

    supabase = None if args.dry_run else create_client(SUPABASE_URL, SERVICE_KEY)
    all_records = []
    now = datetime.now(timezone.utc).isoformat()

    facilities = list(KNOWN_RRCS)

    if not args.known_only:
        scraped = scrape_directory()
        print(f"  scraped {len(scraped)} additional from BOP directory")
        for s in scraped:
            facilities.append({
                "name": s["name"],
                "address": s["address"],
                "borough": None,
                "operator": s.get("operator", "BOP"),
            })

    print(f"=== Processing {len(facilities)} RRCs ===")
    seen = set()
    for fac in facilities:
        key = slugify(f"{fac['name']}:{fac['address']}")
        if key in seen:
            continue
        seen.add(key)
        coords = geocode(fac["address"], fac.get("borough"))
        if not coords:
            print(f"  SKIP no coords: {fac['name']} @ {fac['address']}")
            continue
        lat, lng = coords
        all_records.append({
            "metro": "nyc",
            "category": "public_safety",
            "sub_category": "halfway_house",
            "name": fac["name"],
            "address": fac["address"],
            "borough": fac.get("borough"),
            "geom": f"SRID=4326;POINT({lng} {lat})",
            "lat": lat,
            "lng": lng,
            "source": SOURCE,
            "source_url": DIRECTORY_URL,
            "source_record_id": key,
            "metadata": {
                "operator": fac.get("operator"),
                "facility_type": "RRC",
            },
            "active": True,
            "last_synced": now,
        })

    print(f"=== {len(all_records)} RRCs ready ===")

    if args.dry_run:
        for r in all_records:
            print(f"  {r['name'][:50]} @ {r['address']} ({r['borough']})")
        return

    try:
        supabase.table("nearby_concerns").upsert(all_records, on_conflict="source,source_record_id").execute()
        print(f"Done — {len(all_records)} rows written")
    except Exception as e:
        print(f"Upsert failed: {e}")


if __name__ == "__main__":
    main()

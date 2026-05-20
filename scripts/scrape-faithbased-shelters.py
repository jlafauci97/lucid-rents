#!/usr/bin/env python3
"""
Scrape adult shelter locations from major NYC faith-based shelter operators.
Writes to nearby_concerns table.

Family shelters intentionally excluded.

Usage:
    python3 scripts/scrape-faithbased-shelters.py
    python3 scripts/scrape-faithbased-shelters.py --dry-run
"""

import argparse, os, re, sys, time, urllib.parse
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

SOURCE = "faithbased_shelters_nyc"

# (operator, url, label)
SCRAPE_TARGETS = [
    ("Bowery Mission", "https://www.bowery.org/locations", "bowery_mission"),
    ("The Father's Heart", "https://thefathersheart.org/find-us", "fathers_heart"),
    ("NYC Rescue Mission", "https://www.nycrescue.org/locations", "nyc_rescue"),
]

FAMILY_KEYWORDS = ["family", "families", "with children", "mother", "child"]
BOROUGHS = ["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"]

ADDR_RE = re.compile(
    r"(\d{1,5}\s+[A-Z][A-Za-z0-9.\- ]{3,60}(?:Street|St\.?|Avenue|Ave\.?|Road|Rd\.?|Boulevard|Blvd\.?|Place|Pl\.?|Drive|Dr\.?|Way|Lane|Ln\.?))",
    re.IGNORECASE,
)


def geocode(address, borough=None):
    if not address:
        return None
    query = f"{address}, {borough}, NY" if borough else f"{address}, New York, NY"
    try:
        res = requests.get(
            "https://geosearch.planninglabs.nyc/v2/search",
            params={"text": query, "size": 1},
            timeout=10,
        )
        features = res.json().get("features", [])
        if not features:
            return None
        coords = features[0]["geometry"]["coordinates"]
        return (coords[1], coords[0])
    except Exception as e:
        print(f"  geocode error for {address!r}: {e}")
        return None


def slugify(text):
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")[:120]


def detect_borough(text):
    for b in BOROUGHS:
        if b.lower() in text.lower():
            return b
    return None


def is_family(text):
    return any(kw in text.lower() for kw in FAMILY_KEYWORDS)


def extract_from_page(html, operator, source_url):
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text)
    records = []
    seen = set()
    for m in ADDR_RE.finditer(text):
        address = m.group(1).strip()
        if address.lower() in seen:
            continue
        seen.add(address.lower())
        ctx = text[max(0, m.start() - 100):min(len(text), m.end() + 100)]
        if is_family(ctx):
            continue
        borough = detect_borough(ctx)
        # Try to grab a name from before the address
        before = text[max(0, m.start() - 60):m.start()].strip()
        name = re.sub(r"[^A-Za-z0-9 \-.&,']", " ", before)[-50:].strip() or operator
        if not name or len(name) < 4:
            name = f"{operator} — {address}"
        records.append({
            "name": name,
            "address": address,
            "borough": borough,
            "operator": operator,
            "source_url": source_url,
        })
    return records


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if not SUPABASE_URL or not SERVICE_KEY:
        print("ERROR: missing env vars")
        sys.exit(1)

    supabase = None if args.dry_run else create_client(SUPABASE_URL, SERVICE_KEY)
    all_records = []

    for operator, url, label in SCRAPE_TARGETS:
        print(f"\n=== {operator} — {url} ===")
        try:
            page = StealthyFetcher.fetch(url, real_chrome=True)
            html = page.html_content if hasattr(page, "html_content") else str(page)
        except Exception as e:
            print(f"  fetch failed: {e}")
            continue
        recs = extract_from_page(html, operator, url)
        print(f"  found {len(recs)} candidates")
        for r in recs:
            coords = geocode(r["address"], r.get("borough"))
            if not coords:
                print(f"  SKIP {r['address']}")
                continue
            lat, lng = coords
            now = datetime.now(timezone.utc).isoformat()
            all_records.append({
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
                "source_record_id": slugify(f"{r['operator']}:{r['address']}"),
                "metadata": {
                    "operator": r["operator"],
                    "population": "adult",
                    "scrape_label": label,
                },
                "active": True,
                "last_synced": now,
            })
        time.sleep(2)

    print(f"\n=== {len(all_records)} total geocoded records ===")

    if args.dry_run:
        for r in all_records[:8]:
            print(f"  [{r['metadata']['operator']}] {r['name'][:50]} @ {r['address']}")
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

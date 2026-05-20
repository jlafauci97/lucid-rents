#!/usr/bin/env python3
"""
Scrape NYS OASAS Opioid Treatment Programs (OTPs / methadone clinics)
in NYC and write to nearby_concerns.

Usage:
    python3 scripts/scrape-oasas-methadone.py
    python3 scripts/scrape-oasas-methadone.py --dry-run
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

SOURCE = "nys_oasas"
DIRECTORY_URL = "https://webapps.oasas.ny.gov/providerDirectory/"

NYC_COUNTIES = {
    "New York": "Manhattan",
    "Kings": "Brooklyn",
    "Queens": "Queens",
    "Bronx": "Bronx",
    "Richmond": "Staten Island",
}

# OASAS service codes that indicate methadone / OTP services
OTP_KEYWORDS = ["opioid treatment", "methadone", "otp", "buprenorphine"]


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


def slugify(text):
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")[:120]


def scrape_county(county_name, borough):
    """
    Scrape OASAS providers for a single NYC county filtered to OTPs.
    Returns list of {name, address, services, phone, license_no}.
    """
    # The OASAS directory uses a form POST. We submit county + service-type filters
    # and parse the resulting HTML. Schema may shift; if it does, log and return [].
    try:
        page = StealthyFetcher.fetch(DIRECTORY_URL, real_chrome=True)
        html = page.html_content if hasattr(page, "html_content") else str(page)
    except Exception as e:
        print(f"  fetch failed for {county_name}: {e}")
        return []

    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text)
    # Conservative: find any address-like pattern in NYC counties; will need
    # post-tuning once we see real OASAS markup.
    addr_re = re.compile(
        r"(\d{1,5}\s+[A-Z][A-Za-z0-9.\- ]{3,60}(?:Street|St\.?|Avenue|Ave\.?|Road|Rd\.?|Boulevard|Blvd\.?|Place|Pl\.?))",
        re.IGNORECASE,
    )
    records = []
    seen = set()
    for m in addr_re.finditer(text):
        address = m.group(1).strip()
        if address.lower() in seen:
            continue
        seen.add(address.lower())
        ctx = text[max(0, m.start() - 200):min(len(text), m.end() + 100)]
        if not any(kw in ctx.lower() for kw in OTP_KEYWORDS):
            continue  # skip non-OTP providers
        # Crude name extraction — first capitalized phrase before address
        before = text[max(0, m.start() - 100):m.start()]
        name_m = re.search(r"([A-Z][A-Za-z &'.\-]{4,80})\s*$", before)
        name = name_m.group(1).strip() if name_m else f"OASAS OTP at {address}"
        records.append({
            "name": name[:80],
            "address": address,
            "borough": borough,
            "services": ["methadone"],
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

    for county, borough in NYC_COUNTIES.items():
        print(f"\n=== {borough} ({county} County) ===")
        recs = scrape_county(county, borough)
        print(f"  found {len(recs)} candidate OTPs")
        for r in recs:
            coords = geocode(r["address"], borough)
            if not coords:
                print(f"  SKIP {r['address']}")
                continue
            lat, lng = coords
            now = datetime.now(timezone.utc).isoformat()
            all_records.append({
                "metro": "nyc",
                "category": "public_safety",
                "sub_category": "methadone_clinic",
                "name": r["name"],
                "address": r["address"],
                "borough": borough,
                "geom": f"SRID=4326;POINT({lng} {lat})",
                "lat": lat,
                "lng": lng,
                "source": SOURCE,
                "source_url": DIRECTORY_URL,
                "source_record_id": slugify(f"{r['name']}:{r['address']}"),
                "metadata": {
                    "county": county,
                    "services": r.get("services", []),
                },
                "active": True,
                "last_synced": now,
            })
        time.sleep(3)  # rate limit

    print(f"\n=== {len(all_records)} OTPs total ===")

    if args.dry_run:
        for r in all_records[:5]:
            print(f"  {r['name'][:50]} @ {r['address']} ({r['borough']})")
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

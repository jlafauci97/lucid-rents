#!/usr/bin/env python3
"""
Scrape property owner names from ZIMAS (zimas.lacity.org) for LA buildings.

Uses Scrapling with StealthyFetcher (real_chrome=True) to render the
JavaScript-heavy ZIMAS pages and extract owner names from the Assessor tab.

Flow:
  1. Load LA buildings with APNs but no owner_name from Supabase
  2. For each APN, search ZIMAS to get the PIN
  3. Load the ZIMAS map page for that PIN (requires JS rendering)
  4. Parse the Assessor section for Owner1 name
  5. Update buildings.owner_name in Supabase

Usage:
    python3 scripts/scrape-zimas-owners.py                    # all LA buildings missing owners
    python3 scripts/scrape-zimas-owners.py --limit=100        # first 100 buildings
    python3 scripts/scrape-zimas-owners.py --zip=90028        # single zip code
    python3 scripts/scrape-zimas-owners.py --apn=5044011074   # single APN test
    python3 scripts/scrape-zimas-owners.py --dry-run          # preview without DB writes
"""

import json
import os
import re
import sys
import time
import random
import argparse
from pathlib import Path
from datetime import datetime, timezone

# ── ENV ──────────────────────────────────────────────────────────────────────
env_path = Path(__file__).parent.parent / ".env.local"
env = {}
if env_path.exists():
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            key, val = line.split("=", 1)
            env[key.strip()] = val.strip().strip('"').replace("\\n", "")

SUPABASE_URL = (os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or env.get("NEXT_PUBLIC_SUPABASE_URL", "")).strip().replace("\\n", "")
SERVICE_KEY = (os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("SUPABASE_SERVICE_ROLE_KEY", "")).strip().replace("\\n", "")

if not SUPABASE_URL or not SERVICE_KEY:
    print("ERROR: Missing SUPABASE_URL or SERVICE_KEY in .env.local or environment")
    sys.exit(1)

# Late imports so env check fails fast
from scrapling import StealthyFetcher
from supabase import create_client
import requests

supabase = create_client(SUPABASE_URL, SERVICE_KEY)

# ── CONFIG ───────────────────────────────────────────────────────────────────
ZIMAS_SEARCH_URL = "https://zimas.lacity.org/ajaxSearchResults.aspx"
ZIMAS_MAP_URL = "https://zimas.lacity.org/map.aspx"

MAX_RETRIES = 3
RETRY_DELAY = 5
PAGE_DELAY_MIN = 3
PAGE_DELAY_MAX = 8
BATCH_SIZE = 50  # DB update batch size

def fetch_page(url: str, timeout: int = 45000):
    """Fetch a page using StealthyFetcher with real Chrome."""
    return StealthyFetcher.fetch(
        url,
        headless=True,
        real_chrome=True,
        network_idle=True,
        timeout=timeout,
    )


def normalize_apn(apn: str) -> str:
    """Convert APN formats to 10-digit ZIMAS format.

    Input formats:
      '5044-011-074' -> '5044011074'
      '5044011074'   -> '5044011074'
      '5044 011 074' -> '5044011074'
    """
    return re.sub(r"[\s\-]", "", apn).strip()


def parse_zimas_response(text: str) -> dict:
    """Parse ZIMAS JavaScript object notation into a Python dict.

    ZIMAS returns JS object syntax with unquoted keys like:
      {type: "APN", pin: "120B185  1534", ...}
    We fix this by quoting unquoted keys before parsing as JSON.
    """
    # Quote unquoted keys: `key:` -> `"key":`
    fixed = re.sub(r'(?<=[{,\n])\s*(\w+)\s*:', r'"\1":', text.strip())
    try:
        return json.loads(fixed)
    except json.JSONDecodeError:
        # Fallback: extract pin with regex
        pin_match = re.search(r'pin:\s*"([^"]+)"', text)
        if pin_match:
            return {"pin": pin_match.group(1)}
        return {}


def search_pin_by_apn(apn_10: str) -> str | None:
    """Search ZIMAS for a PIN by APN (lightweight endpoint, no JS needed)."""
    try:
        resp = requests.get(
            ZIMAS_SEARCH_URL,
            params={"search": "apn", "apn": apn_10},
            timeout=15,
        )
        resp.raise_for_status()
        data = parse_zimas_response(resp.text)

        # Try top-level pin first
        if data.get("pin"):
            return data["pin"].strip()

        # Then check selectedPins array
        pins = data.get("selectedPins", [])
        if pins:
            pin = pins[0].get("pin", "") if isinstance(pins[0], dict) else str(pins[0])
            return pin.strip() if pin else None

        return None
    except Exception as e:
        print(f"  [WARN] APN search failed for {apn_10}: {e}")
        return None


def scrape_owner_from_zimas(pin: str) -> dict | None:
    """Load ZIMAS map page for a PIN and extract owner data from Assessor section.

    Returns dict with owner_name and optionally owner_address, or None on failure.
    """
    # URL-encode the PIN (may contain spaces like "120B185  1534")
    import urllib.parse
    encoded_pin = urllib.parse.quote(pin)
    url = f"{ZIMAS_MAP_URL}?pin={encoded_pin}"

    for attempt in range(MAX_RETRIES):
        try:
            # Don't use wait_selector — ZIMAS loads data dynamically via ASPX postback.
            # Instead, wait for the page to settle by using a longer network_idle approach.
            page = fetch_page(url)

            if not page or page.status != 200:
                print(f"  [WARN] Bad status for PIN {pin}: {page.status if page else 'None'}")
                time.sleep(RETRY_DELAY)
                continue

            # Get full page HTML for parsing
            html = str(page.html) if hasattr(page, 'html') else ""
            if not html:
                html = str(page.body) if hasattr(page, 'body') else ""

            # Get full page text for fallback parsing
            page_text = page.text if hasattr(page, 'text') else ""

            owner_name = None
            owner_address = None

            # Strategy 1: Parse from HTML — look for the Assessor table
            # ZIMAS renders rows like:
            #   <td class="sub">Owner1</td><td>SMITH JOHN</td>
            owner_match = re.search(
                r'Owner1\s*</(?:td|span|div)>\s*<(?:td|span|div)[^>]*>\s*([^<]+)',
                html, re.IGNORECASE | re.DOTALL
            )
            if owner_match:
                name = owner_match.group(1).strip()
                if name and name.lower() not in ("", "n/a", "none", "no data"):
                    owner_name = name

            # Strategy 2: Parse from page text
            if not owner_name and page_text:
                # Pattern: "Owner1\tSOME NAME\n" or "Owner1  SOME NAME\n"
                text_match = re.search(
                    r'Owner1[\s\t]+(.+?)(?:\n|\r|Address)',
                    page_text
                )
                if text_match:
                    name = text_match.group(1).strip()
                    if name and len(name) > 1 and name.lower() not in ("address", "n/a", "none", "no data"):
                        owner_name = name

            # Parse owner address (follows Owner1 row)
            if owner_name:
                addr_match = re.search(
                    r'Owner1.*?Address\s*</(?:td|span|div)>\s*<(?:td|span|div)[^>]*>\s*([^<]+)',
                    html, re.IGNORECASE | re.DOTALL
                )
                if addr_match:
                    addr = addr_match.group(1).strip()
                    if addr and addr.lower() not in ("", "n/a", "none"):
                        owner_address = addr

            if owner_name:
                return {
                    "owner_name": owner_name,
                    "owner_address": owner_address,
                }
            else:
                # Debug: check if page loaded at all
                has_assessor = "Assessor" in page_text or "Assessor" in html
                has_owner_label = "Owner1" in page_text or "Owner1" in html
                print(f"  [INFO] No owner found for PIN {pin} (assessor section: {has_assessor}, owner label: {has_owner_label})")
                return None

        except Exception as e:
            print(f"  [WARN] Attempt {attempt + 1}/{MAX_RETRIES} failed for PIN {pin}: {e}")
            time.sleep(RETRY_DELAY * (attempt + 1))

    return None


def load_buildings(args) -> list:
    """Load LA buildings that need owner enrichment."""
    query = supabase.table("buildings").select("id, apn, full_address, zip_code").eq("metro", "los-angeles").is_("owner_name", "null").not_.is_("apn", "null")

    if args.zip:
        query = query.eq("zip_code", args.zip)

    if args.apn:
        clean = normalize_apn(args.apn)
        # Match with or without dashes
        query = query.or_(f"apn.eq.{args.apn},apn.eq.{clean}")

    # Paginate through all results
    all_buildings = []
    page_size = 1000
    offset = 0

    while True:
        resp = query.range(offset, offset + page_size - 1).execute()
        batch = resp.data or []
        all_buildings.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size

    if args.limit:
        all_buildings = all_buildings[:args.limit]

    return all_buildings


def update_building_owner(building_id: str, owner_name: str, dry_run: bool = False):
    """Update a building's owner_name in Supabase."""
    if dry_run:
        print(f"  [DRY-RUN] Would set owner_name = '{owner_name}' on {building_id}")
        return

    supabase.table("buildings").update({
        "owner_name": owner_name,
    }).eq("id", building_id).execute()


def main():
    parser = argparse.ArgumentParser(description="Scrape ZIMAS for LA property owner names")
    parser.add_argument("--limit", type=int, help="Max buildings to process")
    parser.add_argument("--zip", type=str, help="Filter to a single zip code")
    parser.add_argument("--apn", type=str, help="Process a single APN (for testing)")
    parser.add_argument("--dry-run", action="store_true", help="Preview without DB writes")
    parser.add_argument("--start-index", type=int, default=0, help="Skip first N buildings (for resuming)")
    args = parser.parse_args()

    print(f"=== ZIMAS Owner Scraper ===")
    print(f"Started: {datetime.now(timezone.utc).isoformat()}")
    print(f"Mode: {'DRY RUN' if args.dry_run else 'LIVE'}")
    print()

    # Load buildings
    buildings = load_buildings(args)
    print(f"Found {len(buildings)} LA buildings with APN but no owner_name")

    if args.start_index:
        buildings = buildings[args.start_index:]
        print(f"Skipping to index {args.start_index}, {len(buildings)} remaining")

    if not buildings:
        print("Nothing to do.")
        return

    # Stats
    total = len(buildings)
    found = 0
    failed = 0
    no_pin = 0
    skipped = 0

    for i, bldg in enumerate(buildings):
        apn_raw = bldg["apn"]
        apn_10 = normalize_apn(apn_raw)
        addr = bldg.get("full_address", "?")

        print(f"[{i + 1}/{total}] {addr} (APN: {apn_raw})")

        # Step 1: Get PIN from APN
        pin = search_pin_by_apn(apn_10)
        if not pin:
            print(f"  [SKIP] No PIN found for APN {apn_10}")
            no_pin += 1
            continue

        print(f"  PIN: {pin}")

        # Step 2: Scrape owner from ZIMAS
        result = scrape_owner_from_zimas(pin)

        if result and result.get("owner_name"):
            owner = result["owner_name"]
            print(f"  OWNER: {owner}")
            update_building_owner(bldg["id"], owner, dry_run=args.dry_run)
            found += 1
        else:
            print(f"  [MISS] No owner data")
            failed += 1

        # Rate limiting
        delay = random.uniform(PAGE_DELAY_MIN, PAGE_DELAY_MAX)
        if i < total - 1:
            print(f"  Waiting {delay:.1f}s...")
            time.sleep(delay)

    # Summary
    print()
    print(f"=== Summary ===")
    print(f"Total processed: {total}")
    print(f"Owners found:    {found}")
    print(f"No PIN:          {no_pin}")
    print(f"No owner data:   {failed}")
    print(f"Finished: {datetime.now(timezone.utc).isoformat()}")


if __name__ == "__main__":
    main()

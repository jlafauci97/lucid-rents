#!/usr/bin/env python3
"""
Scrape all active StreetEasy rental listings via search results pages.

Instead of visiting individual building pages (~777K), this scrapes
the search results pages (~14 listings per page) and groups by building.
Covers all ~15K active NYC rental listings in a few hours.

Usage:
  python3 scripts/scrape-listings.py                    # scrape all boroughs
  python3 scripts/scrape-listings.py --borough=Manhattan
  python3 scripts/scrape-listings.py --dry-run          # extract without upserting

Requires: pip3 install "scrapling[all]" supabase && scrapling install
"""

import argparse
import json
import os
import re
import sys
import time
from collections import defaultdict
from datetime import datetime, timezone
from statistics import median

# ── ENV ──────────────────────────────────────────────────────────────────────

def load_env_local():
    env_path = os.path.join(os.path.dirname(__file__), "..", ".env.local")
    env = {}
    with open(env_path, "r") as f:
        for line in f:
            line = line.strip()
            m = re.match(r"^([^#=]+)=(.*)$", line)
            if m:
                key = m.group(1).strip()
                val = m.group(2).strip()
                val = re.sub(r'^"|"$', "", val)
                val = val.replace("\\n", "")
                env[key] = val
    return env


env = load_env_local()
SUPABASE_URL = env.get("NEXT_PUBLIC_SUPABASE_URL", "")
SERVICE_KEY = env.get("SUPABASE_SERVICE_ROLE_KEY", "")

if not SUPABASE_URL or not SERVICE_KEY:
    print("Missing SUPABASE_URL or SERVICE_KEY in .env.local", file=sys.stderr)
    sys.exit(1)

from supabase import create_client

supabase = create_client(SUPABASE_URL, SERVICE_KEY)

# ── CLI ARGS ─────────────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Scrape StreetEasy search results")
parser.add_argument("--borough", type=str, default="",
                    help="Filter by borough: Manhattan, Brooklyn, Queens, Bronx, Staten Island")
parser.add_argument("--dry-run", action="store_true",
                    help="Extract data without upserting to database")
parser.add_argument("--max-pages", type=int, default=100,
                    help="Max pages per area (StreetEasy caps at 100)")
args = parser.parse_args()

DELAY_SEC = 2
MAX_PAGES = min(args.max_pages, 100)

# ── STREETEASY AREA SLUGS ────────────────────────────────────────────────────
# Grouped by borough to stay under the 100-page pagination cap

AREAS = {
    "Manhattan": [
        "battery-park-city", "chelsea", "chinatown", "civic-center",
        "east-harlem", "east-village", "financial-district",
        "flatiron", "gramercy-park", "greenwich-village",
        "hamilton-heights", "harlem", "hells-kitchen",
        "inwood", "kips-bay", "lenox-hill",
        "lincoln-square", "little-italy", "lower-east-side",
        "manhattan-valley", "marble-hill", "midtown",
        "midtown-east", "midtown-south", "midtown-west",
        "morningside-heights", "murray-hill", "nolita",
        "noho", "nomad", "roosevelt-island", "soho",
        "stuyvesant-town/pcv", "sutton-place", "tribeca",
        "turtle-bay", "two-bridges", "upper-east-side",
        "upper-west-side", "washington-heights", "west-village",
        "yorkville",
    ],
    "Brooklyn": [
        "bay-ridge", "bed-stuy", "bensonhurst", "boerum-hill",
        "borough-park", "brighton-beach", "brooklyn-heights",
        "brownsville", "bushwick", "canarsie",
        "carroll-gardens", "clinton-hill", "cobble-hill",
        "columbia-street-waterfront-district", "coney-island",
        "crown-heights", "ditmas-park", "downtown-brooklyn",
        "dumbo", "dyker-heights", "east-flatbush",
        "east-new-york", "east-williamsburg", "flatbush",
        "flatlands", "fort-greene", "gowanus",
        "gravesend", "greenpoint", "kensington",
        "marine-park", "midwood", "mill-basin",
        "park-slope", "prospect-heights", "prospect-lefferts-gardens",
        "prospect-park-south", "red-hook", "sheepshead-bay",
        "south-slope", "sunset-park", "vinegar-hill",
        "williamsburg", "windsor-terrace",
    ],
    "Queens": [
        "astoria", "bayside", "briarwood", "college-point",
        "corona", "east-elmhurst", "elmhurst",
        "far-rockaway", "flushing", "forest-hills",
        "fresh-meadows", "glendale", "howard-beach",
        "hunters-point", "jackson-heights", "jamaica",
        "kew-gardens", "kew-gardens-hills", "long-island-city",
        "maspeth", "middle-village", "ozone-park",
        "rego-park", "richmond-hill", "ridgewood",
        "rockaway-beach", "south-ozone-park", "sunnyside",
        "whitestone", "woodhaven", "woodside",
    ],
    "Bronx": [
        "baychester", "bedford-park", "belmont",
        "city-island", "concourse", "concourse-village",
        "country-club", "fieldston", "fordham",
        "highbridge", "hunts-point", "kingsbridge",
        "kingsbridge-heights", "longwood", "morris-heights",
        "morris-park", "morrisania", "mott-haven",
        "norwood", "parkchester", "pelham-bay",
        "pelham-gardens", "riverdale", "soundview",
        "throgs-neck", "tremont", "university-heights",
        "van-nest", "wakefield", "westchester-square",
        "williamsbridge", "woodlawn",
    ],
    "Staten Island": [
        "annadale", "arden-heights", "arrochar",
        "bay-terrace-si", "bulls-head", "castleton-corners",
        "clifton", "dongan-hills", "eltingville",
        "emerson-hill", "graniteville", "grant-city",
        "grymes-hill", "huguenot", "mariners-harbor",
        "midland-beach", "new-brighton", "new-dorp",
        "new-springville", "oakwood", "port-richmond",
        "princes-bay", "randall-manor", "rosebank",
        "rossville", "silver-lake", "south-beach",
        "st-george", "stapleton", "todt-hill",
        "tottenville", "travis", "west-brighton",
        "westerleigh", "willowbrook",
    ],
}

# Borough name to StreetEasy URL slug
BOROUGH_SLUGS = {
    "Manhattan": "manhattan",
    "Brooklyn": "brooklyn",
    "Queens": "queens",
    "Bronx": "bronx",
    "Staten Island": "staten-island",
}


# ── HELPERS ──────────────────────────────────────────────────────────────────

def normalize_address(addr):
    """Normalize an address for matching: lowercase, strip unit, standardize."""
    addr = addr.lower().strip()
    # Remove unit/apt numbers
    addr = re.sub(r"\s*#\S+", "", addr)
    addr = re.sub(r"\s*(?:apt|unit|suite|fl|floor)\s*\S+", "", addr, flags=re.I)
    # Standardize
    addr = re.sub(r"\bave\b", "avenue", addr)
    addr = re.sub(r"\bst\b(?!\.)", "street", addr)
    addr = re.sub(r"\bblvd\b", "boulevard", addr)
    addr = re.sub(r"\bdr\b", "drive", addr)
    addr = re.sub(r"\bpl\b", "place", addr)
    addr = re.sub(r"\brd\b", "road", addr)
    addr = re.sub(r"\bln\b", "lane", addr)
    addr = re.sub(r"\bpkwy\b", "parkway", addr)
    # Ordinal: 1st, 2nd, 3rd, etc -> keep as-is
    addr = re.sub(r"\s+", " ", addr).strip()
    return addr


def parse_beds(text):
    """Parse bedroom count from listing text."""
    if re.search(r"\bstudio\b", text, re.I):
        return 0
    m = re.search(r"(\d)\s*(?:bed|br|bd)", text, re.I)
    return int(m.group(1)) if m else -1


def valid_price(p):
    return 500 <= p <= 50000


# ── EXTRACTION ───────────────────────────────────────────────────────────────

def extract_listings_from_page(page):
    """Extract rental listings from a StreetEasy search results page."""
    listings = []
    text = page.get_all_text() if hasattr(page, "get_all_text") else str(page.text or "")

    # Get total count from page
    total_match = re.search(r"([\d,]+)\s+\w[\w\s-]+Apartments?\s+for\s+Rent", text)
    total = 0
    if total_match:
        digits = total_match.group(1).replace(",", "").strip()
        if digits.isdigit():
            total = int(digits)

    # Extract JSON-LD addresses (more reliable for address data)
    jsonld_addresses = {}
    for script_el in page.css('script[type="application/ld+json"]'):
        try:
            data = json.loads(script_el.text or "")
            if isinstance(data, dict) and data.get("@graph"):
                for item in data["@graph"]:
                    if item.get("@type") == "ApartmentComplex" and item.get("address"):
                        addr = item["address"]
                        street = addr.get("streetAddress", "")
                        zip_code = addr.get("postalCode", "")
                        locality = addr.get("addressLocality", "")
                        if street:
                            key = normalize_address(street)
                            jsonld_addresses[key] = {
                                "street": street,
                                "zip": zip_code,
                                "neighborhood": locality,
                            }
        except (json.JSONDecodeError, ValueError):
            pass

    # Extract listing cards from DOM using link elements
    seen_slugs_on_page = set()  # deduplicate (DOM can have dupes)
    for link_el in page.css('a[href*="/building/"]'):
        href = link_el.attrib.get("href", "") if hasattr(link_el, "attrib") else ""
        if not href:
            try:
                href = link_el.attributes.get("href", "")
            except Exception:
                continue

        slug_match = re.search(r"/building/([^/?\s]+)(?:/([^?\s]+))?", href)
        if not slug_match:
            continue
        building_slug = slug_match.group(1)
        unit = slug_match.group(2) or ""

        # Deduplicate: same building+unit on same page
        dedup_key = f"{building_slug}/{unit}"
        if dedup_key in seen_slugs_on_page:
            continue
        seen_slugs_on_page.add(dedup_key)

        # Walk up to find card text with price
        el = link_el
        card_text = ""
        for _ in range(8):
            el_parent = getattr(el, "parent", None)
            if el_parent is None:
                break
            el = el_parent
            txt = el.text or ""
            if "$" in txt and ("bed" in txt.lower() or "studio" in txt.lower()):
                card_text = txt
                break

        if not card_text:
            continue

        # Extract price (first $ amount in the card)
        price_match = re.search(r"\$([\d,]+)", card_text)
        if not price_match:
            continue
        price = int(price_match.group(1).replace(",", ""))
        if not valid_price(price):
            continue

        # Extract beds
        beds = parse_beds(card_text)
        if beds < 0:
            continue

        # Extract address from link text
        link_text = link_el.text or ""
        addr_match = re.search(
            r"(\d+\s+(?:East|West|North|South)?\s*\d*\s*\w[\w\s]+?(?:Street|Avenue|Place|Boulevard|Drive|Road|Way|Lane|Broadway|Parkway|Court|Terrace|Plaza))",
            link_text, re.I
        )
        street_address = addr_match.group(1).strip() if addr_match else ""

        # Try to match with JSON-LD for full address data
        normalized = normalize_address(street_address) if street_address else ""
        jsonld = jsonld_addresses.get(normalized, {})

        listings.append({
            "building_slug": building_slug,
            "street_address": jsonld.get("street", street_address),
            "zip_code": jsonld.get("zip", ""),
            "neighborhood": jsonld.get("neighborhood", ""),
            "price": price,
            "beds": beds,
        })

    return listings, total


# ── MATCHING ─────────────────────────────────────────────────────────────────

def match_buildings(grouped_listings):
    """Match listing groups to buildings in the database by address."""
    matched = {}
    unmatched = []

    # Build lookup of all unique addresses
    addresses = set()
    for slug, listings in grouped_listings.items():
        for l in listings:
            if l["street_address"] and l["zip_code"]:
                addresses.add((l["street_address"], l["zip_code"]))

    if not addresses:
        return matched, list(grouped_listings.keys())

    # Query buildings in batches by zip code
    zip_buildings = {}
    unique_zips = set(z for _, z in addresses)
    for zip_code in unique_zips:
        if not zip_code:
            continue
        try:
            result = supabase.table("buildings") \
                .select("id, full_address, borough, zip_code") \
                .eq("zip_code", zip_code) \
                .limit(1000) \
                .execute()
            for b in (result.data or []):
                norm = normalize_address(b["full_address"].split(",")[0])
                zip_buildings.setdefault(zip_code, {})[norm] = b["id"]
        except Exception as e:
            print(f"  DB query error for zip {zip_code}: {e}")

    # Match each listing group
    for slug, listings in grouped_listings.items():
        building_id = None
        for l in listings:
            if l["zip_code"] and l["street_address"]:
                norm = normalize_address(l["street_address"])
                building_id = zip_buildings.get(l["zip_code"], {}).get(norm)
                if building_id:
                    break

        if building_id:
            matched[slug] = {"building_id": building_id, "listings": listings}
        else:
            unmatched.append(slug)

    return matched, unmatched


# ── UPSERT ───────────────────────────────────────────────────────────────────

def upsert_building_rents(building_id, listings):
    """Aggregate listings by bedroom count and upsert to building_rents."""
    by_beds = defaultdict(list)
    for l in listings:
        by_beds[l["beds"]].append(l["price"])

    now = datetime.now(timezone.utc).isoformat()
    rows = []
    for beds, prices in by_beds.items():
        if beds < 0:
            continue
        prices.sort()
        n = len(prices)
        mid = n // 2
        med = prices[mid] if n % 2 else round((prices[mid - 1] + prices[mid]) / 2)
        rows.append({
            "building_id": building_id,
            "source": "streeteasy",
            "bedrooms": beds,
            "min_rent": prices[0],
            "max_rent": prices[-1],
            "median_rent": med,
            "listing_count": n,
            "scraped_at": now,
            "updated_at": now,
        })

    if not rows:
        return 0

    try:
        supabase.table("building_rents").upsert(
            rows, on_conflict="building_id,source,bedrooms"
        ).execute()
        return len(rows)
    except Exception as e:
        print(f"  Upsert error: {e}")
        return 0


# ── MAIN ─────────────────────────────────────────────────────────────────────

def main():
    boroughs = [args.borough] if args.borough else list(AREAS.keys())
    print(f"Scraping StreetEasy search results for: {', '.join(boroughs)}")
    print(f"Max pages per area: {MAX_PAGES}\n")

    from scrapling.fetchers import DynamicFetcher
    fetcher = DynamicFetcher(headless=True)

    all_listings = []
    total_pages_scraped = 0

    for borough in boroughs:
        areas = AREAS.get(borough, [])
        boro_slug = BOROUGH_SLUGS.get(borough, borough.lower())
        print(f"\n{'='*60}")
        print(f"  {borough} ({len(areas)} neighborhoods)")
        print(f"{'='*60}")

        for area in areas:
            page_num = 1
            area_listings = []
            area_total = 0

            while page_num <= MAX_PAGES:
                url = f"https://streeteasy.com/for-rent/{area}?page={page_num}"
                if page_num == 1:
                    url = f"https://streeteasy.com/for-rent/{area}"

                try:
                    page = fetcher.fetch(url)
                except Exception as e:
                    print(f"  [{area}] page {page_num} fetch error: {e}")
                    break

                if page.status == 404:
                    break
                if page.status == 429:
                    print(f"  [{area}] Rate limited, waiting 30s...")
                    time.sleep(30)
                    continue
                if page.status and page.status >= 400:
                    print(f"  [{area}] HTTP {page.status}")
                    break

                listings, total = extract_listings_from_page(page)

                if page_num == 1:
                    area_total = total
                    if total == 0:
                        break
                    print(f"  [{area}] {total} listings found")

                if not listings:
                    break

                area_listings.extend(listings)
                total_pages_scraped += 1

                # Check if we've gotten all listings
                if len(area_listings) >= area_total:
                    break

                page_num += 1
                time.sleep(DELAY_SEC)

            if area_listings:
                print(f"  [{area}] scraped {len(area_listings)} listings across {page_num} pages")
                all_listings.extend(area_listings)

    # Group by building slug
    grouped = defaultdict(list)
    for l in all_listings:
        grouped[l["building_slug"]].append(l)

    print(f"\n{'='*60}")
    print(f"  RESULTS")
    print(f"{'='*60}")
    print(f"Total listings scraped: {len(all_listings)}")
    print(f"Unique buildings: {len(grouped)}")
    print(f"Pages scraped: {total_pages_scraped}")

    if args.dry_run:
        # Print sample
        for slug, listings in list(grouped.items())[:10]:
            prices = [l["price"] for l in listings]
            print(f"  {slug}: {len(listings)} listings, ${min(prices)}-${max(prices)}")
        print("\nDry run -- no data upserted.")
        return

    # Match to database buildings
    print("\nMatching to database buildings...")
    matched, unmatched = match_buildings(grouped)
    print(f"Matched: {len(matched)} buildings")
    print(f"Unmatched: {len(unmatched)} buildings")

    # Upsert rents
    total_upserted = 0
    for slug, data in matched.items():
        count = upsert_building_rents(data["building_id"], data["listings"])
        total_upserted += count

    print(f"\nDone! Upserted {total_upserted} rent records for {len(matched)} buildings.")
    print(f"Unmatched buildings (not in DB): {len(unmatched)}")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nInterrupted.")
    except Exception as e:
        print(f"Fatal error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

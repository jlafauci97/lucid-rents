#!/usr/bin/env python3
"""
Scrape rent + amenity data from StreetEasy and Zillow using Scrapling.

Usage:
  python3 scripts/scrape-rents.py                             # scrape next 50 NYC buildings
  python3 scripts/scrape-rents.py --metro=los-angeles         # scrape LA buildings
  python3 scripts/scrape-rents.py --metro=chicago             # scrape Chicago buildings
  python3 scripts/scrape-rents.py --borough=Manhattan         # filter by borough
  python3 scripts/scrape-rents.py --limit=100                 # change batch size
  python3 scripts/scrape-rents.py --source=streeteasy         # only StreetEasy (NYC only)
  python3 scripts/scrape-rents.py --source=zillow             # only Zillow

Requires: pip3 install "scrapling[stealth]" supabase && scrapling install
"""

import argparse
import json
import os
import re
import sys
import time
from datetime import datetime, timezone

# ── ENV ──────────────────────────────────────────────────────────────────────

def load_env_local():
    env_path = os.path.join(os.path.dirname(__file__), "..", ".env.local")
    env = {}
    if not os.path.exists(env_path):
        return {}
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

parser = argparse.ArgumentParser(description="Scrape rent + amenity data")
parser.add_argument("--limit", type=int, default=50)
parser.add_argument("--borough", type=str, default="")
parser.add_argument("--metro", type=str, default="nyc", choices=["nyc", "los-angeles", "chicago"])
parser.add_argument("--source", type=str, default="", choices=["", "streeteasy", "zillow"])
args = parser.parse_args()

LIMIT = args.limit
BOROUGH = args.borough
SOURCE = args.source
DELAY_SEC = 2

# ── AMENITY CATEGORIZATION ──────────────────────────────────────────────────

AMENITY_CATEGORIES = {
    # Building
    "doorman": "building", "concierge": "building", "elevator": "building",
    "live-in super": "building", "superintendent": "building", "lobby": "building",
    "package room": "building", "mail room": "building", "common area": "building",
    "community room": "building", "residents lounge": "building", "lounge": "building",
    "co-working": "building", "coworking": "building", "business center": "building",
    "media room": "building", "game room": "building", "playroom": "building",
    "children's playroom": "building", "library": "building", "wi-fi": "building",
    "wifi": "building", "virtual doorman": "building", "intercom": "building",
    "wheelchair accessible": "building", "ada accessible": "building",
    "smoke free": "building", "no smoking": "building",
    # Outdoor
    "roof deck": "outdoor", "rooftop": "outdoor", "terrace": "outdoor",
    "balcony": "outdoor", "patio": "outdoor", "garden": "outdoor",
    "courtyard": "outdoor", "backyard": "outdoor", "outdoor space": "outdoor",
    "bbq": "outdoor", "grill": "outdoor", "sun deck": "outdoor", "pool": "outdoor",
    "swimming pool": "outdoor",
    # Fitness
    "gym": "fitness", "fitness center": "fitness", "fitness room": "fitness",
    "yoga studio": "fitness", "yoga room": "fitness", "sauna": "fitness",
    "spa": "fitness", "steam room": "fitness", "basketball court": "fitness",
    "tennis court": "fitness", "rock climbing": "fitness",
    # Parking
    "parking": "parking", "garage": "parking", "bike room": "parking",
    "bike storage": "parking", "bicycle storage": "parking",
    "valet parking": "parking", "ev charging": "parking",
    # Laundry
    "laundry in unit": "laundry", "washer/dryer": "laundry",
    "in-unit laundry": "laundry", "laundry room": "laundry",
    "laundry in building": "laundry", "washer dryer": "laundry",
    # Security
    "security": "security", "video intercom": "security",
    "surveillance": "security", "key fob": "security", "cctv": "security",
    "security camera": "security", "24-hour security": "security",
    # Pet
    "pet friendly": "pet", "pets allowed": "pet", "dog friendly": "pet",
    "cat friendly": "pet", "pet spa": "pet", "dog run": "pet",
    "dog grooming": "pet", "pet grooming": "pet",
    # Storage
    "storage": "storage", "storage room": "storage", "private storage": "storage",
    "wine storage": "storage", "cellar": "storage",
    # Luxury
    "penthouse": "luxury", "private terrace": "luxury",
    "screening room": "luxury", "wine cellar": "luxury",
    "golf simulator": "luxury", "bowling alley": "luxury",
    "private dining": "luxury", "chef's kitchen": "luxury",
}

BEDROOM_PATTERNS = [
    (0, re.compile(r"studio[^$]*?\$?\s*([\d,]+)(?:\s*[-\u2013]\s*\$?\s*([\d,]+))?", re.I)),
    (1, re.compile(r"1\s*(?:bed|br|bd)[^$]*?\$?\s*([\d,]+)(?:\s*[-\u2013]\s*\$?\s*([\d,]+))?", re.I)),
    (2, re.compile(r"2\s*(?:bed|br|bd)[^$]*?\$?\s*([\d,]+)(?:\s*[-\u2013]\s*\$?\s*([\d,]+))?", re.I)),
    (3, re.compile(r"3\s*(?:bed|br|bd)[^$]*?\$?\s*([\d,]+)(?:\s*[-\u2013]\s*\$?\s*([\d,]+))?", re.I)),
    (4, re.compile(r"4\+?\s*(?:bed|br|bd)[^$]*?\$?\s*([\d,]+)(?:\s*[-\u2013]\s*\$?\s*([\d,]+))?", re.I)),
]


# ── HELPERS ──────────────────────────────────────────────────────────────────

def categorize_amenity(text):
    lower = text.lower().strip()
    for keyword, category in AMENITY_CATEGORIES.items():
        if keyword in lower:
            return category
    return "other"


def normalize_amenity(text):
    return " ".join(w.capitalize() for w in text.strip().split())


def parse_bedrooms(text):
    if re.search(r"studio", text, re.I):
        return 0
    m = re.search(r"(\d)\s*(?:bed|br|bd)", text, re.I)
    return int(m.group(1)) if m else -1


def slugify_for_streeteasy(address, borough):
    parts = address.split(",")[0].strip().lower()
    parts = re.sub(r"\bave\b", "avenue", parts)
    parts = re.sub(r"\bst\b", "street", parts)
    slug = re.sub(r"[^a-z0-9]+", "-", parts)
    slug = re.sub(r"-+", "-", slug).strip("-")
    boro = borough.lower().replace(" ", "-")
    return f"{slug}-{boro}"


def slugify_for_zillow(address):
    return address.replace(",", "").replace(" ", "-").lower()


def aggregate_rent_data(rent_data, source):
    results = []
    for beds, prices in rent_data.items():
        if beds < 0 or not prices:
            continue
        prices.sort()
        n = len(prices)
        mid = n // 2
        median = prices[mid] if n % 2 else round((prices[mid - 1] + prices[mid]) / 2)
        results.append({
            "bedrooms": beds,
            "source": source,
            "min_rent": prices[0],
            "max_rent": prices[-1],
            "median_rent": median,
            "listing_count": n,
        })
    return results


def valid_price(p):
    return 500 <= p <= 50000


# ── STREETEASY SCRAPER ──────────────────────────────────────────────────────

def scrape_streeteasy(building, fetcher):
    slug = slugify_for_streeteasy(building["full_address"], building["borough"])
    url = f"https://streeteasy.com/building/{slug}"
    print(f"  StreetEasy: {url}")

    try:
        page = fetcher.fetch(url)
    except Exception as e:
        print(f"  StreetEasy fetch error: {e}")
        return {"rents": [], "amenities": []}

    if page.status == 404:
        return {"rents": [], "amenities": []}
    if page.status == 429:
        print("  Rate limited, waiting 30s...")
        time.sleep(30)
        return {"rents": [], "amenities": []}
    if page.status and page.status >= 400:
        print(f"  HTTP {page.status}")
        return {"rents": [], "amenities": []}

    rent_data = {}  # beds -> [prices]
    full_text = page.get_all_text() if hasattr(page, "get_all_text") else str(page.text or "")

    # Method 1: listing cards (JS-rendered, so these should be populated)
    for card in page.css(
        '[data-testid="listing-card"], .listingCard, .listing-card, .SearchCardList .searchCard'
    ):
        card_text = card.text or ""
        price_match = re.search(r"\$([\d,]+)", card_text)
        if not price_match:
            continue
        price = int(price_match.group(1).replace(",", ""))
        if not valid_price(price):
            continue
        beds = parse_bedrooms(card_text)
        if beds < 0:
            continue
        rent_data.setdefault(beds, []).append(price)

    # Method 2: rental summary/stats
    for el in page.css(".building-stats, .rental-stats, [data-testid='rental-stats']"):
        text = el.text or ""
        for beds, pattern in BEDROOM_PATTERNS:
            for m in pattern.finditer(text):
                lo = int(m.group(1).replace(",", ""))
                hi = int(m.group(2).replace(",", "")) if m.group(2) else lo
                if valid_price(lo):
                    rent_data.setdefault(beds, []).append(lo)
                    if hi != lo and valid_price(hi):
                        rent_data[beds].append(hi)

    # Method 3: full-text scan
    for m in re.finditer(
        r"(?:studio|(\d)\s*(?:bed|br|bd))[^$\n]{0,40}\$\s*([\d,]+)", full_text, re.I
    ):
        beds = int(m.group(1)) if m.group(1) else 0
        price = int(m.group(2).replace(",", ""))
        if valid_price(price):
            rent_data.setdefault(beds, []).append(price)

    # Amenities
    amenities = extract_amenities_from_page(page, full_text, "streeteasy")

    return {"rents": aggregate_rent_data(rent_data, "streeteasy"), "amenities": amenities}


# ── ZILLOW SCRAPER ──────────────────────────────────────────────────────────

def walk_zillow_prices(obj, rent_data, depth=0):
    if depth > 10 or not obj or not isinstance(obj, (dict, list)):
        return
    if isinstance(obj, list):
        for item in obj:
            walk_zillow_prices(item, rent_data, depth + 1)
        return
    # dict
    rent_zest = obj.get("rentZestimate") or obj.get("rent_zestimate")
    if rent_zest:
        price = int(rent_zest) if str(rent_zest).isdigit() else 0
        if valid_price(price):
            beds = obj.get("bedrooms", obj.get("beds", -1))
            if beds is None:
                beds = -1
            rent_data.setdefault(beds, []).append(price)

    if obj.get("price") and obj.get("bedrooms") is not None:
        raw = obj["price"]
        price = int(re.sub(r"[^0-9]", "", str(raw))) if isinstance(raw, str) else int(raw)
        if valid_price(price):
            beds = int(obj["bedrooms"])
            rent_data.setdefault(beds, []).append(price)

    for val in obj.values():
        if isinstance(val, (dict, list)):
            walk_zillow_prices(val, rent_data, depth + 1)


def walk_zillow_amenities(obj, amenities, depth=0):
    if depth > 8 or not obj or not isinstance(obj, (dict, list)):
        return
    if isinstance(obj, list):
        for item in obj:
            if isinstance(item, str) and 1 < len(item) < 80:
                lower = item.lower()
                for kw in AMENITY_CATEGORIES:
                    if kw in lower:
                        amenities.add(normalize_amenity(item))
                        break
            walk_zillow_amenities(item, amenities, depth + 1)
        return
    for key, val in obj.items():
        lk = key.lower()
        if ("amenity" in lk or "feature" in lk) and isinstance(val, list):
            for item in val:
                text = item if isinstance(item, str) else (item.get("name") or item.get("text") if isinstance(item, dict) else None)
                if text and 1 < len(text) < 80:
                    amenities.add(normalize_amenity(text))
        if isinstance(val, (dict, list)):
            walk_zillow_amenities(val, amenities, depth + 1)


def scrape_zillow(building, fetcher):
    addr = slugify_for_zillow(building["full_address"])
    url = f"https://www.zillow.com/homes/{addr}_rb/"
    print(f"  Zillow: {url}")

    try:
        page = fetcher.fetch(url)
    except Exception as e:
        print(f"  Zillow fetch error: {e}")
        return {"rents": [], "amenities": []}

    if page.status in (404, 403):
        return {"rents": [], "amenities": []}
    if page.status == 429:
        print("  Rate limited, waiting 30s...")
        time.sleep(30)
        return {"rents": [], "amenities": []}
    if page.status and page.status >= 400:
        print(f"  HTTP {page.status}")
        return {"rents": [], "amenities": []}

    rent_data = {}
    full_text = page.get_all_text() if hasattr(page, "get_all_text") else str(page.text or "")

    # Method 1: JSON-LD / application/json script tags
    for script_el in page.css('script[type="application/ld+json"], script[type="application/json"]'):
        try:
            data = json.loads(script_el.text or "")
            walk_zillow_prices(data, rent_data)
        except (json.JSONDecodeError, ValueError):
            pass

    # Method 2: inline state / __NEXT_DATA__
    for script_el in page.css("script"):
        text = script_el.text or ""
        if "rentZestimate" in text or '"price"' in text:
            json_match = re.search(r"(\{.*\})", text, re.DOTALL)
            if json_match:
                try:
                    data = json.loads(json_match.group(1))
                    walk_zillow_prices(data, rent_data)
                except (json.JSONDecodeError, ValueError):
                    pass

    # Method 3: text patterns
    for m in re.finditer(
        r"(?:studio|(\d)\s*(?:bed|br|bd))[^$\n]{0,40}\$\s*([\d,]+)(?:\s*[-\u2013/]\s*\$?\s*([\d,]+))?(?:\s*/?mo)?",
        full_text, re.I,
    ):
        beds = int(m.group(1)) if m.group(1) else 0
        price = int(m.group(2).replace(",", ""))
        if valid_price(price):
            rent_data.setdefault(beds, []).append(price)
            if m.group(3):
                hi = int(m.group(3).replace(",", ""))
                if valid_price(hi):
                    rent_data[beds].append(hi)

    # Zestimate
    zest = re.search(r"(?:rent\s*zestimate|estimated\s*rent)[^$]*\$\s*([\d,]+)", full_text, re.I)
    if zest:
        price = int(zest.group(1).replace(",", ""))
        if valid_price(price):
            rent_data.setdefault(-1, []).append(price)

    # Amenities from JSON
    amenities_set = set()
    for script_el in page.css("script"):
        text = script_el.text or ""
        if "amenities" in text or "features" in text:
            json_match = re.search(r"(\{.*\})", text, re.DOTALL)
            if json_match:
                try:
                    data = json.loads(json_match.group(1))
                    walk_zillow_amenities(data, amenities_set)
                except (json.JSONDecodeError, ValueError):
                    pass

    # Amenities from DOM + keywords
    amenities = extract_amenities_from_page(page, full_text, "zillow", amenities_set)

    return {"rents": aggregate_rent_data(rent_data, "zillow"), "amenities": amenities}


# ── SHARED AMENITY EXTRACTION ───────────────────────────────────────────────

def extract_amenities_from_page(page, full_text, source, existing=None):
    amenities = existing or set()

    selectors = [
        ".amenities li", ".building-amenities li",
        '[data-testid="amenities"] li', ".BuildingAmenities li",
        ".amenities-list li", ".feature-list li",
        '[class*="amenit"] li', '[class*="Amenit"] li',
        '[class*="feature"] li', '[class*="Feature"] li',
        ".amenity-tag", ".amenity-badge",
        '[class*="amenity-tag"]', '[class*="AmenityTag"]',
        ".unit-features li",
    ]
    for sel in selectors:
        for el in page.css(sel):
            text = (el.text or "").strip()
            if 1 < len(text) < 80:
                amenities.add(normalize_amenity(text))

    # Keyword scan
    for kw in AMENITY_CATEGORIES:
        pattern = re.compile(rf"\b{re.escape(kw)}\b", re.I)
        if pattern.search(full_text):
            amenities.add(normalize_amenity(kw))

    return [{"amenity": a, "category": categorize_amenity(a), "source": source} for a in amenities]


# ── UPSERT ──────────────────────────────────────────────────────────────────

def upsert_rents(building_id, rent_rows):
    if not rent_rows:
        return 0
    now = datetime.now(timezone.utc).isoformat()
    rows = [{
        "building_id": building_id,
        "source": r["source"],
        "bedrooms": r["bedrooms"],
        "min_rent": r["min_rent"],
        "max_rent": r["max_rent"],
        "median_rent": r["median_rent"],
        "listing_count": r["listing_count"],
        "scraped_at": now,
        "updated_at": now,
    } for r in rent_rows]

    history_rows = [{
        "building_id": building_id,
        "source": r["source"],
        "bedrooms": r["bedrooms"],
        "rent": r["median_rent"],
        "observed_at": now,
    } for r in rent_rows]

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
    except Exception as e:
        print(f"  Rent history insert error: {e}")

    return len(rows)


def upsert_amenities(building_id, amenity_rows):
    if not amenity_rows:
        return 0
    now = datetime.now(timezone.utc).isoformat()
    rows = [{
        "building_id": building_id,
        "source": a["source"],
        "amenity": a["amenity"],
        "category": a["category"],
        "scraped_at": now,
    } for a in amenity_rows]

    try:
        supabase.table("building_amenities").upsert(
            rows, on_conflict="building_id,source,amenity"
        ).execute()
        return len(rows)
    except Exception as e:
        print(f"  Amenity upsert error: {e}")
        return 0


# ── MAIN ────────────────────────────────────────────────────────────────────

def main():
    metro = args.metro
    print(f"Scraping rents -- metro={metro}, limit={LIMIT}, borough={BOROUGH or 'all'}, source={SOURCE or 'both'}")

    # Fetch buildings ordered by review count
    query = supabase.table("buildings") \
        .select("id, full_address, borough, zip_code, slug, residential_units") \
        .gt("residential_units", 0) \
        .eq("metro", metro) \
        .order("review_count", desc=True) \
        .limit(LIMIT)

    if BOROUGH:
        query = query.eq("borough", BOROUGH)

    result = query.execute()
    buildings = result.data or []

    if not buildings:
        print("No buildings found.")
        return

    print(f"Found {len(buildings)} buildings to scrape\n")

    # Import Scrapling fetcher -- DynamicFetcher for JS rendering via Playwright
    from scrapling.fetchers import DynamicFetcher

    total_rents = 0
    total_amenities = 0

    fetcher = DynamicFetcher(headless=True)

    for i, building in enumerate(buildings, 1):
        print(f"[{i}/{len(buildings)}] {building['full_address']} ({building['borough']})")

        all_rents = []
        all_amenities = []

        if not SOURCE or SOURCE == "streeteasy":
            try:
                res = scrape_streeteasy(building, fetcher)
                if res["rents"]:
                    print(f"  StreetEasy: {len(res['rents'])} rent entries")
                    all_rents.extend(res["rents"])
                else:
                    print("  StreetEasy: no rent data")
                if res["amenities"]:
                    print(f"  StreetEasy: {len(res['amenities'])} amenities")
                    all_amenities.extend(res["amenities"])
            except Exception as e:
                print(f"  StreetEasy error: {e}")
            time.sleep(DELAY_SEC)

        if not SOURCE or SOURCE == "zillow":
            try:
                res = scrape_zillow(building, fetcher)
                if res["rents"]:
                    print(f"  Zillow: {len(res['rents'])} rent entries")
                    all_rents.extend(res["rents"])
                else:
                    print("  Zillow: no rent data")
                if res["amenities"]:
                    print(f"  Zillow: {len(res['amenities'])} amenities")
                    all_amenities.extend(res["amenities"])
            except Exception as e:
                print(f"  Zillow error: {e}")
            time.sleep(DELAY_SEC)

        total_rents += upsert_rents(building["id"], all_rents)
        total_amenities += upsert_amenities(building["id"], all_amenities)
        print()

    print(f"\nDone! {total_rents} rent records, {total_amenities} amenities for {len(buildings)} buildings.")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nInterrupted.")
    except Exception as e:
        print(f"Fatal error: {e}", file=sys.stderr)
        sys.exit(1)

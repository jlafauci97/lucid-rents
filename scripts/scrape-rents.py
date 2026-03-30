#!/usr/bin/env python3
"""
Scrape rent + amenity data from StreetEasy and Zillow using Scrapling.

Usage:
  python3 scripts/scrape-rents.py                             # scrape next 50 NYC buildings
  python3 scripts/scrape-rents.py --metro=los-angeles         # scrape LA buildings
  python3 scripts/scrape-rents.py --metro=chicago             # scrape Chicago buildings
  python3 scripts/scrape-rents.py --metro=miami               # scrape Miami buildings
  python3 scripts/scrape-rents.py --metro=houston             # scrape Houston buildings
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
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
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
# Also try .env.production.local if .env.local doesn't have the keys
if not env.get("NEXT_PUBLIC_SUPABASE_URL"):
    prod_path = os.path.join(os.path.dirname(__file__), "..", ".env.production.local")
    if os.path.exists(prod_path):
        with open(prod_path, "r") as f:
            for line in f:
                line = line.strip()
                m = re.match(r"^([^#=]+)=(.*)$", line)
                if m:
                    key = m.group(1).strip()
                    val = m.group(2).strip()
                    val = re.sub(r'^"|"$', "", val)
                    val = val.replace("\\n", "")
                    env[key] = val

SUPABASE_URL = (os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or env.get("NEXT_PUBLIC_SUPABASE_URL", "")).strip()
SERVICE_KEY = (os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("SUPABASE_SERVICE_ROLE_KEY", "")).strip()

if not SUPABASE_URL or not SERVICE_KEY:
    print("Missing SUPABASE_URL or SERVICE_KEY in .env.local", file=sys.stderr)
    sys.exit(1)

from supabase import create_client

supabase = create_client(SUPABASE_URL, SERVICE_KEY)

# ── CLI ARGS ─────────────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Scrape rent + amenity data")
parser.add_argument("--limit", type=int, default=50)
parser.add_argument("--borough", type=str, default="")
parser.add_argument("--metro", type=str, default="nyc", choices=["nyc", "los-angeles", "chicago", "miami", "houston"])
parser.add_argument("--source", type=str, default="", choices=["", "streeteasy", "zillow", "realtor", "trulia", "hotpads"])
parser.add_argument("--backfill", action="store_true", help="Backfill mode: skip buildings that already have rent data, order by unit count desc")
parser.add_argument("--offset", type=int, default=0, help="Skip first N buildings (for pagination)")
parser.add_argument("--min-units", type=int, default=0, help="Minimum residential units filter")
parser.add_argument("--threads", type=int, default=1, help="Number of concurrent workers (each gets its own browser)")
args = parser.parse_args()

LIMIT = args.limit if args.limit > 0 else 500  # 0 means unlimited, fetch in batches of 500
UNLIMITED = args.limit == 0
BOROUGH = args.borough
SOURCE = args.source
DELAY_SEC = 2
BACKFILL = args.backfill
OFFSET = args.offset
MIN_UNITS = args.min_units
NUM_THREADS = max(1, args.threads)

# Thread-safe lock for progress updates
progress_lock = threading.Lock()

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


# ── REALTOR.COM SCRAPER ───────────────────────────────────────────────────

def slugify_for_realtor(address, zip_code):
    """Build a Realtor.com rental search URL for a specific address."""
    # Realtor.com search: /apartments/{City}_{ST}/
    # But for per-building lookup, use their search with address query
    addr = address.split(",")[0].strip()
    return addr.replace(" ", "-").replace(",", "").lower()


def scrape_realtor(building, fetcher):
    addr = building["full_address"]
    zip_code = building.get("zip_code", "")
    # Realtor.com has a property search URL pattern
    addr_slug = addr.replace(",", "").replace(" ", "-").replace(".", "").lower()
    # Remove state/zip from slug for cleaner URL
    parts = addr.split(",")
    street = parts[0].strip()
    city = parts[1].strip() if len(parts) > 1 else ""
    state = parts[2].strip().split()[0] if len(parts) > 2 else ""
    street_slug = street.replace(" ", "-").replace(".", "").lower()
    city_slug = city.replace(" ", "-").lower()
    url = f"https://www.realtor.com/apartments/{street_slug}_{city_slug}_{state}"
    print(f"  Realtor: {url}")

    try:
        page = fetcher.fetch(url)
    except Exception as e:
        print(f"  Realtor fetch error: {e}")
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

    # Method 1: __NEXT_DATA__ JSON (Realtor.com uses Next.js)
    for script_el in page.css('script#__NEXT_DATA__'):
        try:
            data = json.loads(script_el.text or "")
            walk_realtor_prices(data, rent_data)
            walk_realtor_amenities(data, set())
        except (json.JSONDecodeError, ValueError):
            pass

    # Method 2: JSON-LD structured data
    for script_el in page.css('script[type="application/ld+json"]'):
        try:
            data = json.loads(script_el.text or "")
            if isinstance(data, dict):
                # ApartmentComplex or similar
                offers = data.get("containsPlace", data.get("hasOfferCatalog", {}).get("itemListElement", []))
                if isinstance(offers, list):
                    for offer in offers:
                        price = offer.get("floorSize", {}).get("value") or offer.get("price")
                        beds = offer.get("numberOfRooms") or offer.get("numberOfBedrooms")
                        if price and beds is not None:
                            p = int(re.sub(r"[^0-9]", "", str(price)))
                            if valid_price(p):
                                rent_data.setdefault(int(beds), []).append(p)
        except (json.JSONDecodeError, ValueError):
            pass

    # Method 3: DOM selectors for rent cards
    for card in page.css('[data-testid="property-detail-price"], .price, [class*="Price"], [class*="rent"]'):
        text = card.text or ""
        price_match = re.search(r"\$([\d,]+)", text)
        if price_match:
            price = int(price_match.group(1).replace(",", ""))
            if valid_price(price):
                # Try to find bedrooms nearby
                parent_text = card.parent.text if hasattr(card, "parent") and card.parent else text
                beds = parse_bedrooms(parent_text)
                if beds >= 0:
                    rent_data.setdefault(beds, []).append(price)

    # Method 4: full-text patterns
    for m in re.finditer(
        r"(?:studio|(\d)\s*(?:bed|br|bd))[^$\n]{0,40}\$\s*([\d,]+)(?:\s*[-\u2013/]\s*\$?\s*([\d,]+))?",
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

    amenities = extract_amenities_from_page(page, full_text, "realtor")
    return {"rents": aggregate_rent_data(rent_data, "realtor"), "amenities": amenities}


def walk_realtor_prices(obj, rent_data, depth=0):
    """Recursively walk Realtor.com JSON to extract rent prices."""
    if depth > 12 or not obj or not isinstance(obj, (dict, list)):
        return
    if isinstance(obj, list):
        for item in obj:
            walk_realtor_prices(item, rent_data, depth + 1)
        return

    # Look for price/rent fields
    price = obj.get("price") or obj.get("list_price") or obj.get("rent") or obj.get("monthly_rent")
    beds = obj.get("beds") or obj.get("bedrooms") or obj.get("bed")
    if price is not None and beds is not None and isinstance(beds, (int, float, str)) and isinstance(price, (int, float, str)):
        p = int(re.sub(r"[^0-9]", "", str(price))) if isinstance(price, str) else int(price)
        if valid_price(p):
            rent_data.setdefault(int(beds), []).append(p)

    # Check for units/floor_plans arrays
    for key in ("units", "floor_plans", "floorPlans", "rental_units", "listings"):
        items = obj.get(key)
        if isinstance(items, list):
            for item in items:
                walk_realtor_prices(item, rent_data, depth + 1)

    for val in obj.values():
        if isinstance(val, (dict, list)):
            walk_realtor_prices(val, rent_data, depth + 1)


def walk_realtor_amenities(obj, amenities, depth=0):
    """Recursively walk Realtor.com JSON to extract amenities."""
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
            walk_realtor_amenities(item, amenities, depth + 1)
        return
    for key, val in obj.items():
        lk = key.lower()
        if ("amenity" in lk or "feature" in lk or "detail" in lk) and isinstance(val, list):
            for item in val:
                text = item if isinstance(item, str) else (item.get("name") or item.get("text") or item.get("category") if isinstance(item, dict) else None)
                if text and 1 < len(text) < 80:
                    amenities.add(normalize_amenity(text))
        if isinstance(val, (dict, list)):
            walk_realtor_amenities(val, amenities, depth + 1)


# ── TRULIA SCRAPER ────────────────────────────────────────────────────────

def scrape_trulia(building, fetcher):
    addr = building["full_address"]
    # Trulia URL pattern: /for_rent/{address-slug}/{city},{state}
    parts = addr.split(",")
    street = parts[0].strip()
    city = parts[1].strip() if len(parts) > 1 else ""
    state_zip = parts[2].strip() if len(parts) > 2 else ""
    state = state_zip.split()[0] if state_zip else ""

    street_slug = re.sub(r"[^a-z0-9]+", "-", street.lower()).strip("-")
    city_slug = re.sub(r"[^a-z0-9]+", "-", city.lower()).strip("-")
    # Trulia uses /p/{state}/{city}/{street} for property pages
    url = f"https://www.trulia.com/p/{state.lower()}/{city_slug}/{street_slug}"
    print(f"  Trulia: {url}")

    try:
        page = fetcher.fetch(url)
    except Exception as e:
        print(f"  Trulia fetch error: {e}")
        return {"rents": [], "amenities": []}

    if page.status in (404, 403):
        # Try rental search URL as fallback
        zip_code = building.get("zip_code", "")
        url2 = f"https://www.trulia.com/for_rent/{street_slug}/{city_slug},{state.upper()}_{zip_code}/"
        print(f"  Trulia fallback: {url2}")
        try:
            page = fetcher.fetch(url2)
        except Exception as e:
            print(f"  Trulia fallback error: {e}")
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

    # Method 1: __NEXT_DATA__ (Trulia uses Next.js)
    for script_el in page.css('script#__NEXT_DATA__'):
        try:
            data = json.loads(script_el.text or "")
            walk_trulia_data(data, rent_data)
        except (json.JSONDecodeError, ValueError):
            pass

    # Method 2: JSON-LD
    for script_el in page.css('script[type="application/ld+json"]'):
        try:
            data = json.loads(script_el.text or "")
            if isinstance(data, dict) and data.get("@type") in ("ApartmentComplex", "Apartment", "Residence"):
                price = data.get("price") or data.get("offers", {}).get("price")
                if price:
                    p = int(re.sub(r"[^0-9]", "", str(price)))
                    if valid_price(p):
                        beds = data.get("numberOfBedrooms", -1)
                        rent_data.setdefault(int(beds) if beds is not None else -1, []).append(p)
        except (json.JSONDecodeError, ValueError):
            pass

    # Method 3: Trulia rent estimate element
    for el in page.css('[data-testid="rent-estimate"], [class*="RentEstimate"], [class*="rentEstimate"]'):
        text = el.text or ""
        m = re.search(r"\$([\d,]+)", text)
        if m:
            price = int(m.group(1).replace(",", ""))
            if valid_price(price):
                rent_data.setdefault(-1, []).append(price)

    # Method 4: DOM price cards
    for card in page.css('[data-testid="property-price"], .price, [class*="Price"]'):
        text = card.text or ""
        price_match = re.search(r"\$([\d,]+)", text)
        if price_match:
            price = int(price_match.group(1).replace(",", ""))
            if valid_price(price):
                parent_text = card.parent.text if hasattr(card, "parent") and card.parent else text
                beds = parse_bedrooms(parent_text)
                if beds >= 0:
                    rent_data.setdefault(beds, []).append(price)

    # Method 5: full-text patterns
    for m in re.finditer(
        r"(?:studio|(\d)\s*(?:bed|br|bd))[^$\n]{0,40}\$\s*([\d,]+)(?:\s*[-\u2013/]\s*\$?\s*([\d,]+))?",
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

    amenities = extract_amenities_from_page(page, full_text, "trulia")
    return {"rents": aggregate_rent_data(rent_data, "trulia"), "amenities": amenities}


def walk_trulia_data(obj, rent_data, depth=0):
    """Recursively walk Trulia JSON to extract rent data."""
    if depth > 12 or not obj or not isinstance(obj, (dict, list)):
        return
    if isinstance(obj, list):
        for item in obj:
            walk_trulia_data(item, rent_data, depth + 1)
        return

    # Trulia embeds rent estimates
    rent_est = obj.get("rentEstimate") or obj.get("rent_estimate") or obj.get("predictedRent")
    if rent_est:
        price = int(re.sub(r"[^0-9]", "", str(rent_est)))
        if valid_price(price):
            beds = obj.get("bedrooms", obj.get("beds", -1))
            rent_data.setdefault(int(beds) if beds is not None else -1, []).append(price)

    price = obj.get("price") or obj.get("listPrice") or obj.get("rent")
    beds = obj.get("bedrooms") or obj.get("beds")
    if price is not None and beds is not None and isinstance(beds, (int, float, str)) and isinstance(price, (int, float, str)):
        p = int(re.sub(r"[^0-9]", "", str(price))) if isinstance(price, str) else int(price)
        if valid_price(p):
            rent_data.setdefault(int(beds), []).append(p)

    # Floor plans
    for key in ("floorPlans", "floor_plans", "units", "rentalUnits"):
        items = obj.get(key)
        if isinstance(items, list):
            for item in items:
                walk_trulia_data(item, rent_data, depth + 1)

    for val in obj.values():
        if isinstance(val, (dict, list)):
            walk_trulia_data(val, rent_data, depth + 1)


# ── HOTPADS SCRAPER ───────────────────────────────────────────────────────

def scrape_hotpads(building, fetcher):
    addr = building["full_address"]
    zip_code = building.get("zip_code", "")
    # HotPads URL: /address-city-state-zip/{listingId}
    # For search: /pad-search/{city}-{state}/keyword-{address}
    parts = addr.split(",")
    street = parts[0].strip()
    city = parts[1].strip() if len(parts) > 1 else ""
    state_zip = parts[2].strip() if len(parts) > 2 else ""
    state = state_zip.split()[0] if state_zip else ""

    street_slug = re.sub(r"[^a-z0-9]+", "-", street.lower()).strip("-")
    city_slug = re.sub(r"[^a-z0-9]+", "-", city.lower()).strip("-")

    url = f"https://hotpads.com/{street_slug}-{city_slug}-{state.lower()}-{zip_code}/pad"
    print(f"  HotPads: {url}")

    try:
        page = fetcher.fetch(url)
    except Exception as e:
        print(f"  HotPads fetch error: {e}")
        return {"rents": [], "amenities": []}

    if page.status in (404, 403):
        # Try search URL as fallback
        search_query = f"{street} {city} {state}".replace(" ", "+")
        url2 = f"https://hotpads.com/search?q={search_query}&type=rental"
        print(f"  HotPads search fallback: {url2}")
        try:
            page = fetcher.fetch(url2)
        except Exception as e:
            print(f"  HotPads fallback error: {e}")
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

    # Method 1: Look for HotPads API JSON in page
    for script_el in page.css("script"):
        text = script_el.text or ""
        if "floorPlans" in text or "unitTypes" in text or "price" in text:
            json_match = re.search(r"(\{.*\})", text, re.DOTALL)
            if json_match:
                try:
                    data = json.loads(json_match.group(1))
                    walk_hotpads_data(data, rent_data)
                except (json.JSONDecodeError, ValueError):
                    pass

    # Method 2: JSON-LD
    for script_el in page.css('script[type="application/ld+json"]'):
        try:
            data = json.loads(script_el.text or "")
            if isinstance(data, dict):
                price = data.get("price") or data.get("offers", {}).get("price")
                beds = data.get("numberOfBedrooms")
                if price and beds is not None:
                    p = int(re.sub(r"[^0-9]", "", str(price)))
                    if valid_price(p):
                        rent_data.setdefault(int(beds), []).append(p)
        except (json.JSONDecodeError, ValueError):
            pass

    # Method 3: DOM — HotPads uses custom elements
    for card in page.css('[class*="FloorPlan"], [class*="floorPlan"], [class*="UnitType"], [class*="listing-price"], .price'):
        text = card.text or ""
        price_match = re.search(r"\$([\d,]+)", text)
        if price_match:
            price = int(price_match.group(1).replace(",", ""))
            if valid_price(price):
                beds = parse_bedrooms(text)
                if beds >= 0:
                    rent_data.setdefault(beds, []).append(price)

    # Method 4: full-text patterns
    for m in re.finditer(
        r"(?:studio|(\d)\s*(?:bed|br|bd))[^$\n]{0,40}\$\s*([\d,]+)(?:\s*[-\u2013/]\s*\$?\s*([\d,]+))?",
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

    amenities = extract_amenities_from_page(page, full_text, "hotpads")
    return {"rents": aggregate_rent_data(rent_data, "hotpads"), "amenities": amenities}


def walk_hotpads_data(obj, rent_data, depth=0):
    """Recursively walk HotPads JSON to extract rent data."""
    if depth > 12 or not obj or not isinstance(obj, (dict, list)):
        return
    if isinstance(obj, list):
        for item in obj:
            walk_hotpads_data(item, rent_data, depth + 1)
        return

    # HotPads uses floorPlans / unitTypes with price ranges
    price = obj.get("price") or obj.get("highPrice") or obj.get("lowPrice") or obj.get("rent")
    beds = obj.get("beds") or obj.get("bedrooms") or obj.get("numBedrooms")
    if price is not None and beds is not None and isinstance(beds, (int, float, str)) and isinstance(price, (int, float, str)):
        p = int(re.sub(r"[^0-9]", "", str(price))) if isinstance(price, str) else int(price)
        if valid_price(p):
            rent_data.setdefault(int(beds), []).append(p)

    # Also grab low/high separately
    lo = obj.get("lowPrice") or obj.get("minPrice") or obj.get("priceMin")
    hi = obj.get("highPrice") or obj.get("maxPrice") or obj.get("priceMax")
    if lo and hi and beds is not None and isinstance(beds, (int, float, str)) and isinstance(lo, (int, float, str)) and isinstance(hi, (int, float, str)):
        lo_p = int(re.sub(r"[^0-9]", "", str(lo))) if isinstance(lo, str) else int(lo)
        hi_p = int(re.sub(r"[^0-9]", "", str(hi))) if isinstance(hi, str) else int(hi)
        if valid_price(lo_p):
            rent_data.setdefault(int(beds), []).append(lo_p)
        if valid_price(hi_p) and hi_p != lo_p:
            rent_data.setdefault(int(beds), []).append(hi_p)

    for key in ("floorPlans", "floor_plans", "unitTypes", "units", "listings"):
        items = obj.get(key)
        if isinstance(items, list):
            for item in items:
                walk_hotpads_data(item, rent_data, depth + 1)

    for val in obj.values():
        if isinstance(val, (dict, list)):
            walk_hotpads_data(val, rent_data, depth + 1)


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


# ── RETRY HELPER ────────────────────────────────────────────────────────────

def retry_supabase(fn, max_retries=3, backoff=5):
    """Retry a Supabase call on transient errors (502, 503, timeout)."""
    for attempt in range(max_retries):
        try:
            return fn()
        except Exception as e:
            err_str = str(e)
            if any(code in err_str for code in ("502", "503", "504", "Bad gateway", "timeout")) and attempt < max_retries - 1:
                wait = backoff * (attempt + 1)
                print(f"  Supabase transient error, retrying in {wait}s (attempt {attempt + 1}/{max_retries})...")
                time.sleep(wait)
            else:
                raise


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
        retry_supabase(lambda: supabase.table("building_rents").upsert(
            rows, on_conflict="building_id,source,bedrooms"
        ).execute())
    except Exception as e:
        print(f"  Rent upsert error: {e}")
        return 0

    try:
        retry_supabase(lambda: supabase.table("unit_rent_history").upsert(
            history_rows, on_conflict="building_id,source,unit_number,bedrooms,rent,observed_at"
        ).execute())
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
        retry_supabase(lambda: supabase.table("building_amenities").upsert(
            rows, on_conflict="building_id,source,amenity"
        ).execute())
        return len(rows)
    except Exception as e:
        print(f"  Amenity upsert error: {e}")
        return 0


# ── PROGRESS TRACKING ──────────────────────────────────────────────────────

PROGRESS_FILE = os.path.join(os.path.dirname(__file__), f".scrape-rents-progress-{args.metro}.json")


def load_progress():
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE, "r") as f:
            return json.load(f)
    return {"scraped_ids": [], "total_rents": 0, "total_amenities": 0, "total_buildings": 0}


def save_progress(progress):
    with open(PROGRESS_FILE, "w") as f:
        json.dump(progress, f)


# ── FETCH BUILDINGS ────────────────────────────────────────────────────────

def fetch_buildings_backfill(metro, limit, offset):
    """Fetch buildings that DON'T already have rent data, ordered by unit count."""
    # Use RPC or raw query to exclude buildings with existing rents
    result = supabase.rpc("get_buildings_without_rents", {
        "p_metro": metro,
        "p_borough": BOROUGH or None,
        "p_limit": limit,
        "p_offset": offset,
        "p_min_units": MIN_UNITS,
    }).execute()
    return result.data or []


def fetch_buildings_normal(metro, limit):
    """Original building fetch — ordered by review count."""
    query = supabase.table("buildings") \
        .select("id, full_address, borough, zip_code, slug, residential_units") \
        .gt("residential_units", 0) \
        .eq("metro", metro) \
        .order("review_count", desc=True) \
        .limit(limit)

    if BOROUGH:
        query = query.eq("borough", BOROUGH)

    result = query.execute()
    return result.data or []


# ── MAIN ────────────────────────────────────────────────────────────────────

def process_one_building(building, metro, fetcher):
    """Process a single building. Returns (building_id, rents_count, amenities_count)."""
    addr = building['full_address']
    borough = building.get('borough', '?')
    units = building.get('residential_units', '?')

    all_rents = []
    all_amenities = []

    # StreetEasy is NYC-only
    if (not SOURCE or SOURCE == "streeteasy") and metro in ("nyc", "new-york"):
        try:
            res = scrape_streeteasy(building, fetcher)
            if res["rents"]:
                print(f"  [{addr}] StreetEasy: {len(res['rents'])} rent entries")
                all_rents.extend(res["rents"])
            if res["amenities"]:
                print(f"  [{addr}] StreetEasy: {len(res['amenities'])} amenities")
                all_amenities.extend(res["amenities"])
        except Exception as e:
            print(f"  [{addr}] StreetEasy error: {e}")
        time.sleep(DELAY_SEC)

    if not SOURCE or SOURCE == "zillow":
        try:
            res = scrape_zillow(building, fetcher)
            if res["rents"]:
                print(f"  [{addr}] Zillow: {len(res['rents'])} rent entries")
                all_rents.extend(res["rents"])
            if res["amenities"]:
                print(f"  [{addr}] Zillow: {len(res['amenities'])} amenities")
                all_amenities.extend(res["amenities"])
        except Exception as e:
            print(f"  [{addr}] Zillow error: {e}")
        time.sleep(DELAY_SEC)

    if not SOURCE or SOURCE == "realtor":
        try:
            res = scrape_realtor(building, fetcher)
            if res["rents"]:
                print(f"  [{addr}] Realtor: {len(res['rents'])} rent entries")
                all_rents.extend(res["rents"])
            if res["amenities"]:
                print(f"  [{addr}] Realtor: {len(res['amenities'])} amenities")
                all_amenities.extend(res["amenities"])
        except Exception as e:
            print(f"  [{addr}] Realtor error: {e}")
        time.sleep(DELAY_SEC)

    if not SOURCE or SOURCE == "trulia":
        try:
            res = scrape_trulia(building, fetcher)
            if res["rents"]:
                print(f"  [{addr}] Trulia: {len(res['rents'])} rent entries")
                all_rents.extend(res["rents"])
            if res["amenities"]:
                print(f"  [{addr}] Trulia: {len(res['amenities'])} amenities")
                all_amenities.extend(res["amenities"])
        except Exception as e:
            print(f"  [{addr}] Trulia error: {e}")
        time.sleep(DELAY_SEC)

    if not SOURCE or SOURCE == "hotpads":
        try:
            res = scrape_hotpads(building, fetcher)
            if res["rents"]:
                print(f"  [{addr}] HotPads: {len(res['rents'])} rent entries")
                all_rents.extend(res["rents"])
            if res["amenities"]:
                print(f"  [{addr}] HotPads: {len(res['amenities'])} amenities")
                all_amenities.extend(res["amenities"])
        except Exception as e:
            print(f"  [{addr}] HotPads error: {e}")
        time.sleep(DELAY_SEC)

    r = upsert_rents(building["id"], all_rents)
    a = upsert_amenities(building["id"], all_amenities)
    return building["id"], r, a


def process_batch(buildings, metro, fetchers, batch_progress):
    """Process a batch of buildings with thread pool. Returns (rents_count, amenities_count)."""
    total_rents = 0
    total_amenities = 0

    if NUM_THREADS <= 1:
        # Single-threaded path
        for building in buildings:
            bid, r, a = process_one_building(building, metro, fetchers[0])
            total_rents += r
            total_amenities += a
            if batch_progress is not None:
                with progress_lock:
                    batch_progress["scraped_ids"].append(bid)
                    batch_progress["total_rents"] += r
                    batch_progress["total_amenities"] += a
                    batch_progress["total_buildings"] += 1
                    if batch_progress["total_buildings"] % 10 == 0:
                        save_progress(batch_progress)
                        print(f"  [progress saved: {batch_progress['total_buildings']} buildings total]")
    else:
        # Multi-threaded path — round-robin fetchers to workers
        def worker(building, fetcher_idx):
            return process_one_building(building, metro, fetchers[fetcher_idx])

        with ThreadPoolExecutor(max_workers=NUM_THREADS) as pool:
            futures = {}
            for i, building in enumerate(buildings):
                fetcher_idx = i % len(fetchers)
                fut = pool.submit(worker, building, fetcher_idx)
                futures[fut] = building

            for fut in as_completed(futures):
                building = futures[fut]
                try:
                    bid, r, a = fut.result()
                    total_rents += r
                    total_amenities += a
                    if batch_progress is not None:
                        with progress_lock:
                            batch_progress["scraped_ids"].append(bid)
                            batch_progress["total_rents"] += r
                            batch_progress["total_amenities"] += a
                            batch_progress["total_buildings"] += 1
                            if batch_progress["total_buildings"] % 10 == 0:
                                save_progress(batch_progress)
                                print(f"  [progress saved: {batch_progress['total_buildings']} buildings total]")
                except Exception as e:
                    print(f"  Worker error for {building.get('full_address', '?')}: {e}")

    return total_rents, total_amenities


def main():
    metro = args.metro
    mode = "backfill" if BACKFILL else "normal"
    print(f"Scraping rents -- metro={metro}, limit={'unlimited' if UNLIMITED else LIMIT}, borough={BOROUGH or 'all'}, source={SOURCE or 'both'}, mode={mode}, threads={NUM_THREADS}")

    # Import Scrapling fetcher -- use StealthyFetcher for better anti-bot bypass
    use_stealth = SOURCE in ("realtor", "trulia", "hotpads", "")
    if use_stealth:
        from scrapling import StealthyFetcher
        print(f"Launching {NUM_THREADS} stealth browser(s)...")
        fetchers = [StealthyFetcher(headless=True) for _ in range(NUM_THREADS)]
    else:
        from scrapling.fetchers import DynamicFetcher
        print(f"Launching {NUM_THREADS} browser(s)...")
        fetchers = [DynamicFetcher(headless=True) for _ in range(NUM_THREADS)]

    grand_total_rents = 0
    grand_total_amenities = 0
    batch_progress = load_progress() if BACKFILL else None
    current_offset = OFFSET

    if batch_progress:
        print(f"Resuming: {batch_progress['total_buildings']} buildings done so far, {batch_progress['total_rents']} rents, {batch_progress['total_amenities']} amenities")

    while True:
        if BACKFILL:
            buildings = fetch_buildings_backfill(metro, LIMIT, current_offset)
            scraped_set = set(batch_progress["scraped_ids"]) if batch_progress else set()
            buildings = [b for b in buildings if b["id"] not in scraped_set]
            print(f"\nBatch: {len(buildings)} unscraped buildings (offset={current_offset}, min_units={MIN_UNITS})")
        else:
            buildings = fetch_buildings_normal(metro, LIMIT)

        if not buildings:
            print("No more buildings to process.")
            break

        r, a = process_batch(buildings, metro, fetchers, batch_progress)
        grand_total_rents += r
        grand_total_amenities += a

        # If not unlimited, stop after one batch
        if not UNLIMITED:
            break

        # Advance offset for next batch
        current_offset += LIMIT
        print(f"\n--- Batch complete. Fetching next {LIMIT} buildings (offset={current_offset}) ---\n")

    # Final progress save
    if BACKFILL and batch_progress is not None:
        save_progress(batch_progress)

    print(f"\nDone! {grand_total_rents} rent records, {grand_total_amenities} amenities.")
    if BACKFILL and batch_progress:
        print(f"Cumulative: {batch_progress['total_buildings']} buildings, {batch_progress['total_rents']} rents, {batch_progress['total_amenities']} amenities")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nInterrupted.")
    except Exception as e:
        print(f"Fatal error: {e}", file=sys.stderr)
        sys.exit(1)

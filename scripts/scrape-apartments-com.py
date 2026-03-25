#!/usr/bin/env python3
"""
Scrape rent and amenity data from apartments.com for NYC, LA, and Chicago using Scrapling.

Uses StealthyFetcher with real_chrome=True to bypass anti-bot protection,
then extracts structured data from HTML article elements.

Usage:
    python3 scripts/scrape-apartments-com.py                            # all NYC boroughs, 5 pages each
    python3 scripts/scrape-apartments-com.py --metro=los-angeles        # all LA areas
    python3 scripts/scrape-apartments-com.py --metro=chicago            # all Chicago areas
    python3 scripts/scrape-apartments-com.py --borough=Manhattan        # single borough/area
    python3 scripts/scrape-apartments-com.py --pages=18                 # more pages per area
    python3 scripts/scrape-apartments-com.py --dry-run                  # preview without DB writes
"""

import json
import os
import re
import sys
import time
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

supabase = create_client(SUPABASE_URL, SERVICE_KEY)

# ── CONSTANTS ────────────────────────────────────────────────────────────────
METRO_AREA_URLS = {
    "nyc": {
        "Manhattan": "https://www.apartments.com/manhattan-ny/",
        "Brooklyn": "https://www.apartments.com/brooklyn-ny/",
        "Queens": "https://www.apartments.com/queens-ny/",
        "Bronx": "https://www.apartments.com/bronx-ny/",
        "Staten Island": "https://www.apartments.com/staten-island-ny/",
    },
    "los-angeles": {
        "Downtown LA": "https://www.apartments.com/downtown-los-angeles-ca/",
        "Hollywood": "https://www.apartments.com/hollywood-los-angeles-ca/",
        "West Hollywood": "https://www.apartments.com/west-hollywood-ca/",
        "Santa Monica": "https://www.apartments.com/santa-monica-ca/",
        "Venice": "https://www.apartments.com/venice-los-angeles-ca/",
        "Silver Lake": "https://www.apartments.com/silver-lake-los-angeles-ca/",
        "Echo Park": "https://www.apartments.com/echo-park-los-angeles-ca/",
        "Los Feliz": "https://www.apartments.com/los-feliz-los-angeles-ca/",
        "Koreatown": "https://www.apartments.com/koreatown-los-angeles-ca/",
        "Mid-Wilshire": "https://www.apartments.com/mid-wilshire-los-angeles-ca/",
        "Westwood": "https://www.apartments.com/westwood-los-angeles-ca/",
        "Culver City": "https://www.apartments.com/culver-city-ca/",
        "Glendale": "https://www.apartments.com/glendale-ca/",
        "Burbank": "https://www.apartments.com/burbank-ca/",
        "Pasadena": "https://www.apartments.com/pasadena-ca/",
        "Long Beach": "https://www.apartments.com/long-beach-ca/",
        "Inglewood": "https://www.apartments.com/inglewood-ca/",
        "North Hollywood": "https://www.apartments.com/north-hollywood-los-angeles-ca/",
        "Studio City": "https://www.apartments.com/studio-city-los-angeles-ca/",
        "Sherman Oaks": "https://www.apartments.com/sherman-oaks-los-angeles-ca/",
        "Encino": "https://www.apartments.com/encino-los-angeles-ca/",
        "Woodland Hills": "https://www.apartments.com/woodland-hills-los-angeles-ca/",
        "Mar Vista": "https://www.apartments.com/mar-vista-los-angeles-ca/",
        "Palms": "https://www.apartments.com/palms-los-angeles-ca/",
        "Playa Vista": "https://www.apartments.com/playa-vista-los-angeles-ca/",
        "Torrance": "https://www.apartments.com/torrance-ca/",
        "El Segundo": "https://www.apartments.com/el-segundo-ca/",
        "Hawthorne": "https://www.apartments.com/hawthorne-ca/",
        "Redondo Beach": "https://www.apartments.com/redondo-beach-ca/",
        "Hermosa Beach": "https://www.apartments.com/hermosa-beach-ca/",
    },
    "chicago": {
        "Loop": "https://www.apartments.com/the-loop-chicago-il/",
        "Lincoln Park": "https://www.apartments.com/lincoln-park-chicago-il/",
        "Lakeview": "https://www.apartments.com/lakeview-chicago-il/",
        "Wicker Park": "https://www.apartments.com/wicker-park-chicago-il/",
        "Logan Square": "https://www.apartments.com/logan-square-chicago-il/",
        "Bucktown": "https://www.apartments.com/bucktown-chicago-il/",
        "River North": "https://www.apartments.com/river-north-chicago-il/",
        "Gold Coast": "https://www.apartments.com/gold-coast-chicago-il/",
        "Old Town": "https://www.apartments.com/old-town-chicago-il/",
        "Uptown": "https://www.apartments.com/uptown-chicago-il/",
        "Edgewater": "https://www.apartments.com/edgewater-chicago-il/",
        "Rogers Park": "https://www.apartments.com/rogers-park-chicago-il/",
        "Hyde Park": "https://www.apartments.com/hyde-park-chicago-il/",
        "South Loop": "https://www.apartments.com/south-loop-chicago-il/",
        "West Loop": "https://www.apartments.com/west-loop-chicago-il/",
        "Streeterville": "https://www.apartments.com/streeterville-chicago-il/",
        "Ravenswood": "https://www.apartments.com/ravenswood-chicago-il/",
        "Andersonville": "https://www.apartments.com/andersonville-chicago-il/",
        "Pilsen": "https://www.apartments.com/pilsen-chicago-il/",
        "Bridgeport": "https://www.apartments.com/bridgeport-chicago-il/",
        "Humboldt Park": "https://www.apartments.com/humboldt-park-chicago-il/",
        "Ukrainian Village": "https://www.apartments.com/ukrainian-village-chicago-il/",
        "Albany Park": "https://www.apartments.com/albany-park-chicago-il/",
        "Irving Park": "https://www.apartments.com/irving-park-chicago-il/",
        "Avondale": "https://www.apartments.com/avondale-chicago-il/",
        "Bronzeville": "https://www.apartments.com/bronzeville-chicago-il/",
        "Evanston": "https://www.apartments.com/evanston-il/",
        "Oak Park": "https://www.apartments.com/oak-park-il/",
    },
}

# Backward compat
BOROUGH_URLS = METRO_AREA_URLS["nyc"]

MAX_RETRIES = 5
RETRY_DELAY = 3  # seconds between retries
PAGE_DELAY = 4  # seconds between page fetches
LISTINGS_PER_PAGE = 40
MAX_RESULTS = 700  # apartments.com caps at ~700 results
SOURCE = "apartments_com"

# ── AMENITY CATEGORIZATION ───────────────────────────────────────────────────
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
    "air conditioning": "building", "a/c": "building", "central air": "building",
    "dishwasher": "building", "microwave": "building", "stainless steel": "building",
    "hardwood": "building", "hardwood flooring": "building",
    "high ceilings": "building", "walk-in closet": "building",
    "controlled access": "building", "gated": "building",
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
    "washer and dryer": "laundry",
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


def categorize_amenity(text: str) -> str:
    lower = text.lower().strip()
    for keyword, category in AMENITY_CATEGORIES.items():
        if keyword in lower:
            return category
    return "other"


def normalize_amenity(text: str) -> str:
    return " ".join(w.capitalize() for w in text.strip().split())


# ── ADDRESS NORMALIZATION ────────────────────────────────────────────────────
STREET_ABBREVS = {
    "street": "ST", "st": "ST",
    "avenue": "AVE", "ave": "AVE", "av": "AVE",
    "boulevard": "BLVD", "blvd": "BLVD",
    "drive": "DR", "dr": "DR",
    "place": "PL", "pl": "PL",
    "road": "RD", "rd": "RD",
    "lane": "LN", "ln": "LN",
    "court": "CT", "ct": "CT",
    "terrace": "TER", "ter": "TER",
    "circle": "CIR", "cir": "CIR",
    "way": "WAY",
    "north": "N", "south": "S", "east": "E", "west": "W",
}


def normalize_address(address: str) -> str:
    """Normalize an address for fuzzy matching against buildings table."""
    addr = address.upper().strip()
    # Remove apartment/unit suffixes
    for sep in [" APT ", " UNIT ", " #", " STE "]:
        if sep in addr:
            addr = addr.split(sep)[0]
    # Normalize street type abbreviations
    parts = addr.split()
    normalized = []
    for part in parts:
        lower = part.lower().rstrip(".,")
        if lower in STREET_ABBREVS:
            normalized.append(STREET_ABBREVS[lower])
        else:
            normalized.append(part.rstrip(".,"))
    return " ".join(normalized)


# ── PRICE PARSING ────────────────────────────────────────────────────────────
def parse_price_text(text: str) -> tuple[int | None, int | None]:
    """Parse price text like '$2,500 - $3,000' or '$1,800' into (min, max) integers."""
    if not text:
        return None, None

    # Remove non-price text
    text = text.strip()

    # Find all dollar amounts
    amounts = re.findall(r'\$[\d,]+', text)
    if not amounts:
        return None, None

    prices = []
    for amt in amounts:
        try:
            price = int(amt.replace("$", "").replace(",", ""))
            if 500 <= price <= 50000:
                prices.append(price)
        except ValueError:
            continue

    if not prices:
        return None, None

    return min(prices), max(prices)


# ── BED PARSING ──────────────────────────────────────────────────────────────
def parse_bed_text(text: str) -> list[int]:
    """Parse bed text like 'Studio, 1 Bed, 2 Beds' into list of bedroom counts."""
    if not text:
        return []

    beds = []
    text_lower = text.lower()

    if "studio" in text_lower:
        beds.append(0)

    # Match patterns like "1 Bed", "2 Beds", "3 Bed", "1-2 Beds", "1 bd"
    bed_matches = re.findall(r'(\d+)\s*(?:bed|bd)', text_lower)
    for m in bed_matches:
        try:
            count = int(m)
            if 0 <= count <= 10 and count not in beds:
                beds.append(count)
        except ValueError:
            continue

    return sorted(beds)


# ── FETCHING ─────────────────────────────────────────────────────────────────
def fetch_page(url: str):
    """Fetch an apartments.com page and return the Scrapling page object."""
    for attempt in range(MAX_RETRIES):
        try:
            page = StealthyFetcher.fetch(
                url,
                headless=True,
                real_chrome=True,
                network_idle=True,
                timeout=45000,
                wait=5000,
            )

            if page.status != 200:
                print(f"    Attempt {attempt + 1}: HTTP {page.status}")
                time.sleep(RETRY_DELAY * (attempt + 1))
                continue

            return page

        except Exception as e:
            print(f"    Attempt {attempt + 1}: Error - {e}")
            time.sleep(RETRY_DELAY * (attempt + 1))

    return None


def extract_listings_from_html(page) -> list[dict]:
    """Extract listing data from apartments.com HTML article elements."""
    listings = []

    articles = page.css("article[data-listingid]")
    if not articles:
        return []

    for article in articles:
        try:
            listing_id = article.attrib.get("data-listingid", "")
            detail_url = article.attrib.get("data-url", "")
            street_address = article.attrib.get("data-streetaddress", "")

            # Property name
            name_els = article.css(".js-placardTitle.title")
            name = name_els[0].text.strip() if name_els else ""

            # Address
            addr_els = article.css(".property-address.js-url")
            if not addr_els:
                addr_els = article.css(".property-address")
            address_text = addr_els[0].text.strip() if addr_els else street_address

            # Extract bed/price pairs from all child elements
            # Pattern: .bedTextBox elements followed by sibling with price text
            rent_by_beds = {}
            all_price_min = None
            all_price_max = None
            all_children = article.css("*")
            bed_counts = []
            for i, child in enumerate(all_children):
                cls = child.attrib.get("class", "")
                text = (child.text or "").strip()
                if "bedTextBox" in cls and text:
                    beds_parsed = parse_bed_text(text)
                    # Look at next siblings for price
                    for j in range(i + 1, min(i + 4, len(all_children))):
                        sib_text = (all_children[j].text or "").strip()
                        sib_cls = all_children[j].attrib.get("class", "")
                        if sib_text and "$" in sib_text:
                            p_min, p_max = parse_price_text(sib_text)
                            if p_min is not None:
                                for b in beds_parsed:
                                    bed_counts.append(b)
                                    rent_by_beds[b] = {
                                        "min_rent": p_min,
                                        "max_rent": p_max if p_max else p_min,
                                        "sqft_min": None,
                                        "sqft_max": None,
                                    }
                                    if all_price_min is None or p_min < all_price_min:
                                        all_price_min = p_min
                                    if all_price_max is None or (p_max or p_min) > all_price_max:
                                        all_price_max = p_max or p_min
                            break
                        if "bedTextBox" in sib_cls:
                            break  # hit next bed type, no price found

            # Extract amenities from text elements (no class, amenity-like text)
            amenities = []
            known_non_amenities = {"email", "call", "tours", "videos", "virtual tours",
                                   "3d tours", "specials", "new", "verified"}
            for child in all_children:
                cls = child.attrib.get("class", "")
                text = (child.text or "").strip()
                if not cls and text and len(text) > 2 and len(text) < 50 and "$" not in text:
                    if text.lower() not in known_non_amenities and not text[0].isdigit():
                        if any(kw in text.lower() for kw in [
                            "pet", "fitness", "pool", "parking", "laundry", "gym",
                            "doorman", "elevator", "roof", "balcon", "storage",
                            "concierge", "club", "lounge", "internet", "bath",
                            "bedroom", "dishwasher", "air", "a/c",
                        ]):
                            amenities.append(text)

            # Skip listings with no price data
            if all_price_min is None:
                continue

            # Parse address components
            addr_parts = address_text.split(",")
            street = addr_parts[0].strip() if addr_parts else address_text
            city = addr_parts[1].strip() if len(addr_parts) >= 2 else ""
            state_zip = addr_parts[2].strip() if len(addr_parts) >= 3 else ""
            zip_match = re.search(r'(\d{5})', state_zip)
            zip_code = zip_match.group(1) if zip_match else ""
            address_full = address_text

            # Determine bed_min / bed_max
            valid_beds = [b for b in bed_counts if b >= 0]
            bed_min = min(valid_beds) if valid_beds else None
            bed_max = max(valid_beds) if valid_beds else None

            listings.append({
                # Identity
                "listing_id": listing_id,
                "name": name,
                "address": street,
                "address_full": address_full,
                "zip_code": zip_code,
                "city": city,
                "latitude": None,
                "longitude": None,
                "property_type": "",
                "listing_url": detail_url,
                # Amenities
                "amenities": amenities,
                # Rent data
                "rent_by_beds": rent_by_beds,
                # Full listing data
                "listing_name": name,
                "price_min": all_price_min,
                "price_max": all_price_max,
                "price_text": f"${all_price_min:,}" + (f" - ${all_price_max:,}" if all_price_max and all_price_max != all_price_min else "") if all_price_min else "",
                "bed_min": bed_min,
                "bed_max": bed_max,
                "bath_min": None,
                "bath_max": None,
                "sqft_min": None,
                "sqft_max": None,
                "bed_text": ", ".join(f"{b} Bed" if b > 0 else "Studio" for b in bed_counts) if bed_counts else "",
                "bath_text": "",
                "sqft_text": "",
                "units_available": 0,
                "units_available_text": "",
                "availability_status": "",
                "management_company": None,
                "verified": False,
                "has_price_drops": False,
                "listing_views": None,
                "updated_at_source": None,
                "floor_plans": [],
                "bed_price_data": [],
                "office_hours": [],
            })

        except Exception as e:
            print(f"    Error parsing article: {e}")
            continue

    return listings


# ── BOROUGH / AREA DETECTION ─────────────────────────────────────────────────
CITY_TO_BOROUGH = {
    # NYC
    "new york": "Manhattan", "manhattan": "Manhattan",
    "brooklyn": "Brooklyn", "bronx": "Bronx",
    "queens": "Queens", "long island city": "Queens",
    "astoria": "Queens", "flushing": "Queens",
    "jamaica": "Queens", "jackson heights": "Queens",
    "woodside": "Queens", "sunnyside": "Queens",
    "forest hills": "Queens", "rego park": "Queens",
    "staten island": "Staten Island",
    # LA
    "los angeles": "Los Angeles", "la": "Los Angeles",
    "hollywood": "Hollywood", "west hollywood": "West Hollywood",
    "santa monica": "Santa Monica", "venice": "Venice",
    "silver lake": "Silver Lake", "echo park": "Echo Park",
    "los feliz": "Los Feliz", "koreatown": "Koreatown",
    "culver city": "Culver City", "glendale": "Glendale",
    "burbank": "Burbank", "pasadena": "Pasadena",
    "long beach": "Long Beach", "inglewood": "Inglewood",
    "torrance": "Torrance", "el segundo": "El Segundo",
    "hawthorne": "Hawthorne", "redondo beach": "Redondo Beach",
    "hermosa beach": "Hermosa Beach",
    # Chicago
    "chicago": "Chicago", "evanston": "Evanston", "oak park": "Oak Park",
}

METRO_INFO = {
    "nyc": {"city": "New York", "state": "NY"},
    "los-angeles": {"city": "Los Angeles", "state": "CA"},
    "chicago": {"city": "Chicago", "state": "IL"},
}


def detect_borough(listing: dict, default_area: str = "Manhattan") -> str:
    """Detect borough/area from listing city/address."""
    city = listing.get("city", "").strip().lower()
    if city and city in CITY_TO_BOROUGH:
        return CITY_TO_BOROUGH[city]

    addr_parts = listing.get("address_full", "").split(",")
    if len(addr_parts) >= 2:
        city_name = addr_parts[1].strip().lower()
        if city_name in CITY_TO_BOROUGH:
            return CITY_TO_BOROUGH[city_name]

    # Fall back to zip code prefix for NYC
    zc = listing.get("zip_code", "")
    if zc.startswith("100") or zc.startswith("101") or zc.startswith("102"):
        return "Manhattan"
    if zc.startswith("112") or zc.startswith("113") or zc.startswith("114"):
        return "Brooklyn"
    if zc.startswith("104"):
        return "Bronx"
    if zc.startswith("110") or zc.startswith("111") or zc.startswith("116"):
        return "Queens"
    if zc.startswith("103"):
        return "Staten Island"
    # LA zip prefixes
    if zc.startswith("900") or zc.startswith("901") or zc.startswith("902"):
        return "Los Angeles"
    # Chicago zip prefixes
    if zc.startswith("606") or zc.startswith("607") or zc.startswith("608"):
        return "Chicago"
    return default_area


def generate_slug(full_address: str) -> str:
    """Generate a URL slug from a full address (matches seo.ts logic)."""
    return re.sub(r'(^-+|-+$)', '', re.sub(r'[^a-z0-9]+', '-', full_address.lower()))


# ── BUILDING MATCHING ────────────────────────────────────────────────────────
def match_building(listing: dict) -> str | None:
    """Try to match an apartments.com listing to an existing building by address + zip."""
    addr = listing.get("address_full", "")
    zip_code = listing.get("zip_code", "")

    if not addr or not zip_code:
        return None

    # Normalize the address for matching
    street = addr.split(",")[0].strip() if "," in addr else addr
    normalized = normalize_address(street)

    try:
        # Try exact match on full_address containing the street + zip
        result = supabase.table("buildings") \
            .select("id") \
            .eq("zip_code", zip_code) \
            .ilike("full_address", f"%{normalized}%") \
            .limit(1) \
            .execute()

        if result.data and len(result.data) > 0:
            return result.data[0]["id"]

        # Try matching with just house number + zip
        parts = normalized.split()
        if len(parts) >= 2:
            house_num = parts[0]
            result = supabase.table("buildings") \
                .select("id") \
                .eq("zip_code", zip_code) \
                .eq("house_number", house_num) \
                .limit(1) \
                .execute()

            if result.data and len(result.data) > 0:
                return result.data[0]["id"]

    except Exception as e:
        print(f"    DB match error (will create new): {e}")

    return None


# ── DATABASE WRITES ──────────────────────────────────────────────────────────
def upsert_rents(building_id: str, rent_by_beds: dict) -> int:
    """Upsert rent data for a building and append to rent history."""
    if not rent_by_beds:
        return 0

    now = datetime.now(timezone.utc).isoformat()
    rows = []
    history_rows = []
    for beds, data in rent_by_beds.items():
        if beds < 0:
            continue  # skip unknown bed counts
        min_r = data["min_rent"]
        max_r = data["max_rent"]
        median = (min_r + max_r) // 2
        rows.append({
            "building_id": building_id,
            "source": SOURCE,
            "bedrooms": beds,
            "min_rent": min_r,
            "max_rent": max_r,
            "median_rent": median,
            "listing_count": 1,
            "scraped_at": now,
            "updated_at": now,
        })
        history_rows.append({
            "building_id": building_id,
            "source": SOURCE,
            "unit_number": "",
            "bedrooms": beds,
            "rent": median,
            "sqft": data.get("sqft_min"),
            "observed_at": now,
        })

    if not rows:
        return 0

    try:
        supabase.table("building_rents") \
            .upsert(rows, on_conflict="building_id,source,bedrooms") \
            .execute()
    except Exception as e:
        print(f"    Rent upsert error: {e}")
        return 0

    try:
        supabase.table("unit_rent_history") \
            .upsert(history_rows, on_conflict="building_id,source,unit_number,bedrooms,rent,observed_at") \
            .execute()
    except Exception as e:
        print(f"    Rent history insert error: {e}")

    return len(rows)


def upsert_amenities(building_id: str, amenities: list[str], metro: str = "nyc") -> int:
    """Upsert amenity data for a building."""
    if not amenities:
        return 0

    now = datetime.now(timezone.utc).isoformat()
    rows = []
    seen = set()
    for a in amenities:
        normalized = normalize_amenity(a)
        key = normalized.lower()
        if key in seen:
            continue
        seen.add(key)
        rows.append({
            "building_id": building_id,
            "source": SOURCE,
            "amenity": normalized,
            "category": categorize_amenity(a),
            "scraped_at": now,
            "metro": metro,
        })

    try:
        supabase.table("building_amenities") \
            .upsert(rows, on_conflict="building_id,source,amenity") \
            .execute()
        return len(rows)
    except Exception as e:
        print(f"    Amenity upsert error: {e}")
        return 0


def create_building(listing: dict, metro: str = "nyc") -> str | None:
    """Create a new building record from an apartments.com listing. Returns building ID."""
    addr_full = listing.get("address_full", "")
    if not addr_full:
        return None

    borough = detect_borough(listing, default_area=list(METRO_AREA_URLS.get(metro, BOROUGH_URLS).keys())[0])
    street = addr_full.split(",")[0].strip() if "," in addr_full else addr_full
    parts = street.split(None, 1)
    house_number = parts[0].upper() if parts else ""
    street_name = parts[1].upper() if len(parts) > 1 else ""
    zip_code = listing.get("zip_code", "")

    info = METRO_INFO.get(metro, METRO_INFO["nyc"])
    state = info["state"]

    full_address = f"{street.upper()}, {borough}, {state}"
    if zip_code:
        full_address += f", {zip_code}"

    slug = generate_slug(full_address)

    row = {
        "full_address": full_address,
        "house_number": house_number,
        "street_name": street_name,
        "borough": borough,
        "city": info["city"],
        "state": state,
        "zip_code": zip_code or None,
        "slug": slug,
        "metro": metro,
        "latitude": listing.get("latitude"),
        "longitude": listing.get("longitude"),
        "overall_score": 0,
        "review_count": 0,
        "violation_count": 0,
        "complaint_count": 0,
        "litigation_count": 0,
        "dob_violation_count": 0,
        "crime_count": 0,
        "bedbug_report_count": 0,
        "eviction_count": 0,
        "permit_count": 0,
        "sidewalk_shed_count": 0,
        "lead_violation_count": 0,
    }

    try:
        result = supabase.table("buildings").insert(row).execute()
        if result.data and len(result.data) > 0:
            return result.data[0]["id"]
    except Exception as e:
        # Might already exist (duplicate slug)
        err_msg = str(e)
        if "duplicate" in err_msg.lower() or "unique" in err_msg.lower():
            # Try to fetch existing
            existing = supabase.table("buildings") \
                .select("id") \
                .eq("slug", slug) \
                .limit(1) \
                .execute()
            if existing.data and len(existing.data) > 0:
                return existing.data[0]["id"]
        print(f"    Building creation error: {e}")
    return None


def upsert_listing(building_id: str, listing: dict) -> bool:
    """Upsert full listing data into building_listings table."""
    now = datetime.now(timezone.utc).isoformat()

    row = {
        "building_id": building_id,
        "source": SOURCE,
        "listing_name": listing.get("listing_name"),
        "listing_url": listing.get("listing_url"),
        "property_type": listing.get("property_type"),
        "price_min": listing.get("price_min"),
        "price_max": listing.get("price_max"),
        "price_text": listing.get("price_text"),
        "bed_min": listing.get("bed_min"),
        "bed_max": listing.get("bed_max"),
        "bath_min": listing.get("bath_min"),
        "bath_max": listing.get("bath_max"),
        "sqft_min": listing.get("sqft_min"),
        "sqft_max": listing.get("sqft_max"),
        "bed_text": listing.get("bed_text"),
        "bath_text": listing.get("bath_text"),
        "sqft_text": listing.get("sqft_text"),
        "units_available": listing.get("units_available", 0),
        "units_available_text": listing.get("units_available_text"),
        "availability_status": listing.get("availability_status"),
        "management_company": listing.get("management_company"),
        "verified": listing.get("verified", False),
        "has_price_drops": listing.get("has_price_drops", False),
        "listing_views": listing.get("listing_views"),
        "updated_at_source": listing.get("updated_at_source"),
        "floor_plans": json.dumps(listing.get("floor_plans", [])),
        "bed_price_data": json.dumps(listing.get("bed_price_data", [])),
        "office_hours": json.dumps(listing.get("office_hours", [])),
        "scraped_at": now,
    }

    try:
        supabase.table("building_listings") \
            .upsert(row, on_conflict="building_id,source") \
            .execute()
        return True
    except Exception as e:
        print(f"    Listing upsert error: {e}")
        return False


# ── MAIN ─────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Scrape apartments.com for rent data")
    parser.add_argument("--metro", type=str, default="nyc", choices=["nyc", "los-angeles", "chicago"], help="Metro area")
    parser.add_argument("--borough", type=str, default="", help="Single borough/area to scrape")
    parser.add_argument("--pages", type=int, default=5, help="Pages per area (40 listings/page)")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing to DB")
    parser.add_argument("--start-page", type=int, default=1, help="Starting page number")
    args = parser.parse_args()

    metro = args.metro
    area_urls = METRO_AREA_URLS.get(metro, BOROUGH_URLS)
    boroughs = {args.borough: area_urls[args.borough]} if args.borough else area_urls
    max_pages = min(args.pages, 18)  # apartments.com caps at 18 pages (~700 results)
    dry_run = args.dry_run

    total_matched = 0
    total_created = 0
    total_failed = 0
    total_rents = 0
    total_amenities = 0
    total_listings_saved = 0
    total_listings = 0

    print(f"Scraping apartments.com — metro={metro}, areas={list(boroughs.keys())}, pages={max_pages}, dry_run={dry_run}")
    print(f"Start time: {datetime.now()}\n")

    for borough, base_url in boroughs.items():
        print(f"\n{'='*60}")
        print(f"BOROUGH: {borough}")
        print(f"{'='*60}")

        for page_num in range(args.start_page, args.start_page + max_pages):
            # apartments.com pagination: base URL for page 1, base_url + {page}/ for page 2+
            if page_num == 1:
                url = base_url
            else:
                url = f"{base_url}{page_num}/"
            print(f"\n  Page {page_num}: {url}")

            page = fetch_page(url)
            if page is None:
                print(f"    FAILED to fetch page {page_num} after {MAX_RETRIES} retries. Skipping.")
                continue

            listings = extract_listings_from_html(page)
            print(f"    Got {len(listings)} listings")

            if len(listings) == 0:
                print(f"    No more listings. Moving to next borough.")
                break

            total_listings += len(listings)

            for listing in listings:
                addr = listing["address_full"] or listing["address"]
                beds_available = list(listing["rent_by_beds"].keys())
                amenity_count = len(listing["amenities"])

                if dry_run:
                    price_str = listing.get("price_text", "")
                    print(f"    [DRY RUN] {addr} | {price_str} | beds={beds_available} | amenities={amenity_count}")
                    continue

                # Try to match existing building
                building_id = match_building(listing)

                if building_id:
                    total_matched += 1
                    label = "MATCHED"
                else:
                    # Create new building
                    building_id = create_building(listing, metro=metro)
                    if building_id:
                        total_created += 1
                        label = "CREATED"
                    else:
                        total_failed += 1
                        print(f"    SKIP {addr} (could not match or create)")
                        continue

                # Upsert all data for this building
                rents_added = upsert_rents(building_id, listing["rent_by_beds"])
                amenities_added = upsert_amenities(building_id, listing["amenities"], metro)
                listing_saved = upsert_listing(building_id, listing)

                total_rents += rents_added
                total_amenities += amenities_added
                if listing_saved:
                    total_listings_saved += 1

                print(f"    {label} {addr} -> {rents_added} rents, {amenities_added} amenities, listing={'OK' if listing_saved else 'FAIL'}")

            # Check if we've likely hit the cap
            if page_num * LISTINGS_PER_PAGE >= MAX_RESULTS:
                print(f"    Reached apartments.com result cap (~{MAX_RESULTS}). Moving to next borough.")
                break

            # Polite delay between pages
            print(f"    Waiting {PAGE_DELAY}s...")
            time.sleep(PAGE_DELAY)

    print(f"\n{'='*60}")
    print(f"SUMMARY")
    print(f"{'='*60}")
    print(f"Total listings scraped:  {total_listings}")
    print(f"Matched to buildings:    {total_matched}")
    print(f"New buildings created:   {total_created}")
    print(f"Failed (no match/create):{total_failed}")
    print(f"Rent records upserted:   {total_rents}")
    print(f"Amenity records upserted:{total_amenities}")
    print(f"Full listings saved:     {total_listings_saved}")
    print(f"End time: {datetime.now()}")


if __name__ == "__main__":
    main()

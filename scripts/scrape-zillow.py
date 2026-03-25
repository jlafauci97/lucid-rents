#!/usr/bin/env python3
"""
Scrape rent data from zillow.com for NYC, LA, and Chicago neighborhoods using Scrapling.

Uses StealthyFetcher with real_chrome=True to bypass anti-bot protection,
then extracts structured JSON from Next.js __NEXT_DATA__ payload.

Scrapes neighborhood-by-neighborhood to bypass Zillow's 820-result
cap per search, capturing far more listings than borough-level scraping.

Usage:
    python3 scripts/scrape-zillow.py                              # all NYC neighborhoods, 20 pages each
    python3 scripts/scrape-zillow.py --metro=los-angeles          # all LA neighborhoods
    python3 scripts/scrape-zillow.py --metro=chicago              # all Chicago neighborhoods
    python3 scripts/scrape-zillow.py --borough=Manhattan          # all Manhattan neighborhoods
    python3 scripts/scrape-zillow.py --neighborhood="Upper East Side"  # single neighborhood
    python3 scripts/scrape-zillow.py --pages=5                    # limit pages per neighborhood
    python3 scripts/scrape-zillow.py --start-index=10             # start from 10th neighborhood (resume)
    python3 scripts/scrape-zillow.py --dry-run                    # preview without DB writes
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

supabase = create_client(SUPABASE_URL, SERVICE_KEY)

# ── NEIGHBORHOOD IMPORT ──────────────────────────────────────────────────────
sys.path.insert(0, str(Path(__file__).parent))
from importlib import import_module
_nbhd_mod = import_module("zillow-neighborhoods")
ALL_BOROUGHS = _nbhd_mod.ALL_BOROUGHS
METRO_NEIGHBORHOODS = _nbhd_mod.METRO_NEIGHBORHOODS
get_url = _nbhd_mod.get_url

METRO_INFO = {
    "nyc": {"city": "New York", "state": "NY"},
    "los-angeles": {"city": "Los Angeles", "state": "CA"},
    "chicago": {"city": "Chicago", "state": "IL"},
    "miami": {"city": "Miami", "state": "FL"},
}

MAX_RETRIES = 3
RETRY_DELAY = 5  # seconds between retries
PAGE_DELAY_MIN = 6  # randomized delay range between pages
PAGE_DELAY_MAX = 12
NEIGHBORHOOD_DELAY_MIN = 8  # randomized delay range between neighborhoods
NEIGHBORHOOD_DELAY_MAX = 20
LISTINGS_PER_PAGE = 41
SOURCE = "zillow"

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
# Matches how buildings.full_address is stored (e.g. "400 W 61ST ST, NEW YORK, NY 10023")
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


def parse_unit_number(address_street: str) -> str | None:
    """Extract unit/apartment number from a Zillow address street string.
    Examples:
      '91 Attorney St #5H' -> '5H'
      '23-10 42nd Rd # 19D' -> '19D'
      '138 E 94th St APT 6W' -> '6W'
      '1503 Lexington Ave Unit 2' -> '2'
      '400 W 61st St' -> None
    """
    if not address_street:
        return None

    # Try matching common patterns: #, APT, UNIT, STE
    patterns = [
        r'#\s*(\w+)',
        r'\bAPT\.?\s*(\w+)',
        r'\bUNIT\s+(\w+)',
        r'\bSTE\.?\s+(\w+)',
    ]
    for pat in patterns:
        m = re.search(pat, address_street, re.IGNORECASE)
        if m:
            val = m.group(1).upper()
            # Reject values that are clearly not unit numbers:
            # - "PENTHOUSE" or other full words that aren't unit IDs
            # - Hex-like strings > 6 chars (Zillow listing IDs)
            # - Pure numeric strings > 5 digits (Zillow zpids)
            if val in ("PENTHOUSE", "BSMT", "BASEMENT", "GARDEN", "LOBBY"):
                return None
            if len(val) > 6:
                return None
            if val.isdigit() and len(val) > 5:
                return None
            return val
    return None


# ── BOROUGH DETECTION ────────────────────────────────────────────────────────
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
    "arverne": "Queens", "far rockaway": "Queens",
    "woodhaven": "Queens", "ridgewood": "Queens",
    "bayside": "Queens", "elmhurst": "Queens",
    "corona": "Queens", "kew gardens": "Queens",
    "ozone park": "Queens", "howard beach": "Queens",
    "fresh meadows": "Queens", "whitestone": "Queens",
    "college point": "Queens", "maspeth": "Queens",
    "middle village": "Queens", "glendale queens": "Queens",
    "east elmhurst": "Queens", "south ozone park": "Queens",
    "south richmond hill": "Queens", "richmond hill": "Queens",
    "springfield gardens": "Queens", "laurelton": "Queens",
    "rosedale": "Queens", "cambria heights": "Queens",
    "st. albans": "Queens", "hollis": "Queens",
    "floral park": "Queens", "little neck": "Queens",
    "douglaston": "Queens", "glen oaks": "Queens",
    "bellerose": "Queens", "briarwood": "Queens",
    # LA
    "los angeles": "Los Angeles", "hollywood": "Hollywood",
    "west hollywood": "West Hollywood", "santa monica": "Santa Monica",
    "culver city": "Culver City", "glendale": "Glendale",
    "burbank": "Burbank", "pasadena": "Pasadena",
    "long beach": "Long Beach", "inglewood": "Inglewood",
    "torrance": "Torrance", "el segundo": "El Segundo",
    "redondo beach": "Redondo Beach", "hermosa beach": "Hermosa Beach",
    "beverly hills": "Beverly Hills", "venice": "Venice",
    "marina del rey": "Marina Del Rey",
    # Chicago
    "chicago": "Chicago", "evanston": "Evanston", "oak park": "Oak Park",
    "skokie": "Skokie",
    # Miami
    "miami": "Miami", "miami beach": "Miami Beach", "coral gables": "Coral Gables",
    "doral": "Doral", "hialeah": "Hialeah", "aventura": "Aventura",
    "coconut grove": "Coconut Grove", "brickell": "Brickell", "wynwood": "Wynwood",
}


def detect_borough(listing: dict, default_area: str = "Manhattan") -> str:
    """Detect borough/area from listing city/address."""
    city = listing.get("address_city", "").strip().lower()
    if city and city in CITY_TO_BOROUGH:
        return CITY_TO_BOROUGH[city]

    # Fall back to full address parsing
    addr = listing.get("address", "")
    parts = addr.split(",")
    if len(parts) >= 2:
        city_name = parts[1].strip().lower()
        if city_name in CITY_TO_BOROUGH:
            return CITY_TO_BOROUGH[city_name]

    # Fall back to zip code prefix
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
    if zc.startswith("900") or zc.startswith("901") or zc.startswith("902"):
        return "Los Angeles"
    if zc.startswith("606") or zc.startswith("607") or zc.startswith("608"):
        return "Chicago"
    return default_area


def generate_slug(full_address: str) -> str:
    """Generate a URL slug from a full address (matches seo.ts logic)."""
    return re.sub(r'(^-+|-+$)', '', re.sub(r'[^a-z0-9]+', '-', full_address.lower()))


def parse_price(price_str: str) -> int | None:
    """Parse a Zillow price string like '$3,917+' to integer 3917."""
    if not price_str:
        return None
    cleaned = re.sub(r'[^\d]', '', price_str)
    if not cleaned:
        return None
    val = int(cleaned)
    if 500 <= val <= 50000:
        return val
    return None


# ── FETCHING ─────────────────────────────────────────────────────────────────
def fetch_page(url: str) -> dict | None:
    """Fetch a Zillow page and extract __NEXT_DATA__ JSON."""
    for attempt in range(MAX_RETRIES):
        try:
            page = StealthyFetcher.fetch(
                url,
                headless=True,
                real_chrome=True,
                network_idle=True,
                timeout=30000,
                wait=5000,
                block_webrtc=True,
                hide_canvas=True,
                disable_resources=True,
                google_search=True,
            )

            if page.status != 200:
                print(f"    Attempt {attempt + 1}: HTTP {page.status}")
                time.sleep(RETRY_DELAY * (attempt + 1))
                continue

            next_data = page.css("script#__NEXT_DATA__")
            if not next_data or len(next_data) == 0:
                print(f"    Attempt {attempt + 1}: No __NEXT_DATA__ found")
                time.sleep(RETRY_DELAY * (attempt + 1))
                continue

            data = json.loads(next_data[0].text)
            return data

        except Exception as e:
            print(f"    Attempt {attempt + 1}: Error - {e}")
            time.sleep(RETRY_DELAY * (attempt + 1))

    return None


def extract_listings(data: dict) -> tuple[list[dict], int]:
    """Extract listing data and total count from Zillow __NEXT_DATA__."""
    try:
        search_results = data["props"]["pageProps"]["searchPageState"]["cat1"]["searchResults"]
        list_results = search_results.get("listResults", [])

        # Total result count
        total = search_results.get("totalResultCount", 0)

        listings = []
        for item in list_results:
            # Skip non-rental items
            if item.get("statusType") != "FOR_RENT":
                continue

            address = item.get("address", "")
            address_street = item.get("addressStreet", "")
            address_city = item.get("addressCity", "")
            address_state = item.get("addressState", "")
            address_zipcode = item.get("addressZipcode", "")
            lat_long = item.get("latLong", {}) or {}
            latitude = lat_long.get("latitude")
            longitude = lat_long.get("longitude")
            building_name = item.get("buildingName", "")
            detail_url = item.get("detailUrl", "")
            units = item.get("units", []) or []
            availability_count = item.get("availabilityCount", 0)

            # Build full address: "23-10 42nd Rd, Long Island City, NY"
            # The address field already contains city + state but no zip
            address_full = address
            if address_zipcode and address_zipcode not in address:
                address_full = f"{address} {address_zipcode}"

            # Extract street part (before city) for normalization
            # addressStreet may contain unit info like "23-10 42nd Rd # 19D"
            unit_number = parse_unit_number(address_street) or parse_unit_number(address)
            street = address_street.split("#")[0].strip() if address_street else ""
            # Also strip APT/UNIT from street for matching
            for sep in [" APT ", " apt ", " Apt ", " UNIT ", " unit ", " Unit "]:
                if sep in street:
                    street = street.split(sep)[0].strip()
            if not street:
                street = address.split(",")[0].strip() if "," in address else address
                # Strip unit from address-derived street too
                for sep in [" APT ", " apt ", " Apt ", " UNIT ", " unit ", " Unit ", " #"]:
                    if sep in street:
                        street = street.split(sep)[0].strip()

            # Parse units into rent_by_beds
            rent_by_beds = {}
            for unit in units:
                if unit.get("roomForRent"):
                    continue
                price = parse_price(unit.get("price", ""))
                if price is None:
                    continue
                beds_str = unit.get("beds", "")
                try:
                    beds = int(beds_str)
                except (ValueError, TypeError):
                    continue
                if beds in rent_by_beds:
                    entry = rent_by_beds[beds]
                    if price < entry["min_rent"]:
                        entry["min_rent"] = price
                    if price > entry["max_rent"]:
                        entry["max_rent"] = price
                else:
                    rent_by_beds[beds] = {
                        "min_rent": price,
                        "max_rent": price,
                        "sqft_min": None,
                        "sqft_max": None,
                    }

            # Fallback: if no units array, extract top-level price/beds
            if not rent_by_beds:
                top_price = parse_price(item.get("price", "") or item.get("unformattedPrice", "") or "")
                if top_price is None:
                    # Try hdpData for price
                    hdp = item.get("hdpData", {}) or {}
                    home_info = hdp.get("homeInfo", {}) or {}
                    top_price = home_info.get("price")
                    if top_price and isinstance(top_price, (int, float)) and 500 <= top_price <= 50000:
                        top_price = int(top_price)
                    else:
                        top_price = None

                if top_price:
                    # Get beds from top-level or hdpData
                    top_beds = None
                    hdp = item.get("hdpData", {}) or {}
                    home_info = hdp.get("homeInfo", {}) or {}
                    beds_val = home_info.get("bedrooms") or item.get("beds")
                    if beds_val is not None:
                        try:
                            top_beds = int(beds_val)
                        except (ValueError, TypeError):
                            top_beds = None

                    if top_beds is not None:
                        rent_by_beds[top_beds] = {
                            "min_rent": top_price,
                            "max_rent": top_price,
                            "sqft_min": None,
                            "sqft_max": None,
                        }

            # Compute overall price range from units
            all_prices = [parse_price(u.get("price", "")) for u in units if not u.get("roomForRent")]
            all_prices = [p for p in all_prices if p is not None]
            # Include top-level price if no units
            if not all_prices and rent_by_beds:
                all_prices = [v["min_rent"] for v in rent_by_beds.values()]
            price_min = min(all_prices) if all_prices else None
            price_max = max(all_prices) if all_prices else None

            # Bed range
            all_beds = []
            for u in units:
                if u.get("roomForRent"):
                    continue
                try:
                    all_beds.append(int(u.get("beds", "")))
                except (ValueError, TypeError):
                    pass
            # Include top-level beds if no units
            if not all_beds and rent_by_beds:
                all_beds = list(rent_by_beds.keys())
            bed_min = min(all_beds) if all_beds else None
            bed_max = max(all_beds) if all_beds else None

            # Price text for display
            if price_min and price_max and price_min != price_max:
                price_text = f"${price_min:,} - ${price_max:,}"
            elif price_min:
                price_text = f"${price_min:,}+"
            else:
                price_text = ""

            # Bed text
            if bed_min is not None and bed_max is not None and bed_min != bed_max:
                bed_text = f"{bed_min}-{bed_max} beds"
            elif bed_min is not None:
                bed_text = f"{'Studio' if bed_min == 0 else f'{bed_min} bed'}"
            else:
                bed_text = ""

            # Extract amenity hints from listCardRecommendation flexFieldRecommendations
            amenities = []
            rec = item.get("listCardRecommendation", {}) or {}
            flex_recs = rec.get("flexFieldRecommendations", []) or []
            for fr in flex_recs:
                content_type = fr.get("contentType", "")
                display_str = fr.get("displayString", "")
                if content_type == "homeInsight" and display_str:
                    amenities.append(display_str)
            # Also check zovInsight
            zov = rec.get("zovInsight", {}) or {}
            if zov.get("displayString"):
                amenities.append(zov["displayString"])

            # Make detail URL absolute
            if detail_url and not detail_url.startswith("http"):
                detail_url = f"https://www.zillow.com{detail_url}"

            listings.append({
                # Identity
                "name": building_name or street,
                "address": address,
                "address_street": street,
                "address_city": address_city,
                "address_state": address_state,
                "address_full": address_full,
                "zip_code": address_zipcode,
                "latitude": latitude,
                "longitude": longitude,
                "property_type": "MULTI_FAMILY" if item.get("isBuilding") else "APARTMENT",
                "listing_url": detail_url,
                # Unit-level data
                "unit_number": unit_number,
                # Amenities (limited from search results)
                "amenities": amenities,
                # Rent data (aggregated for building_rents)
                "rent_by_beds": rent_by_beds,
                # Full listing data (for building_listings)
                "listing_name": building_name or street,
                "price_min": price_min,
                "price_max": price_max,
                "price_text": price_text,
                "bed_min": bed_min,
                "bed_max": bed_max,
                "bath_min": None,
                "bath_max": None,
                "sqft_min": None,
                "sqft_max": None,
                "bed_text": bed_text,
                "bath_text": "",
                "sqft_text": "",
                "units_available": availability_count or len(units),
                "units_available_text": f"{availability_count} available" if availability_count else "",
                "availability_status": item.get("statusText", ""),
                "management_company": None,
                "verified": False,
                "has_price_drops": False,
                "listing_views": None,
                "updated_at_source": None,
                "floor_plans": [],
                "bed_price_data": [],
                "office_hours": [],
            })

        return listings, total

    except (KeyError, TypeError) as e:
        print(f"    Error extracting listings: {e}")
        return [], 0


# ── BUILDING MATCHING ────────────────────────────────────────────────────────
def match_building(listing: dict) -> str | None:
    """Try to match a Zillow listing to an existing building by address + zip."""
    street = listing.get("address_street", "")
    zip_code = listing.get("zip_code", "")

    if not street or not zip_code:
        return None

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
    """Create a new building record from a Zillow listing. Returns building ID."""
    street = listing.get("address_street", "")
    if not street:
        return None

    borough = detect_borough(listing)
    parts = street.upper().split(None, 1)
    house_number = parts[0] if parts else ""
    street_name = parts[1] if len(parts) > 1 else ""
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


def find_or_create_unit(building_id: str, unit_number: str, bedrooms: int | None = None) -> str | None:
    """Find an existing unit or create a new one. Returns unit ID."""
    if not unit_number:
        return None

    try:
        # Try to find existing unit
        result = supabase.table("units") \
            .select("id") \
            .eq("building_id", building_id) \
            .eq("unit_number", unit_number) \
            .limit(1) \
            .execute()

        if result.data and len(result.data) > 0:
            return result.data[0]["id"]

        # Create new unit
        row = {
            "building_id": building_id,
            "unit_number": unit_number,
            "bedrooms": bedrooms,
            "review_count": 0,
        }
        result = supabase.table("units").insert(row).execute()
        if result.data and len(result.data) > 0:
            return result.data[0]["id"]
    except Exception as e:
        err_msg = str(e).lower()
        if "duplicate" in err_msg or "unique" in err_msg:
            # Race condition: another insert happened; fetch it
            try:
                result = supabase.table("units") \
                    .select("id") \
                    .eq("building_id", building_id) \
                    .eq("unit_number", unit_number) \
                    .limit(1) \
                    .execute()
                if result.data and len(result.data) > 0:
                    return result.data[0]["id"]
            except Exception:
                pass
        print(f"    Unit find/create error for {unit_number}: {e}")
    return None


def upsert_unit_listing(building_id: str, unit_id: str, unit_number: str,
                        listing: dict, price: int | None = None,
                        bedrooms: int | None = None) -> bool:
    """Upsert a unit-level listing into unit_listings table."""
    now = datetime.now(timezone.utc).isoformat()

    row = {
        "unit_id": unit_id,
        "building_id": building_id,
        "source": SOURCE,
        "unit_number": unit_number,
        "price": price,
        "bedrooms": bedrooms,
        "bathrooms": None,
        "sqft": None,
        "listing_url": listing.get("listing_url"),
        "available": True,
        "scraped_at": now,
        "updated_at": now,
    }

    try:
        supabase.table("unit_listings") \
            .upsert(row, on_conflict="unit_id,source") \
            .execute()
        return True
    except Exception as e:
        print(f"    Unit listing upsert error for {unit_number}: {e}")
        return False


# ── MAIN ─────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Scrape zillow.com for rent data by neighborhood")
    parser.add_argument("--metro", type=str, default="nyc", choices=["nyc", "los-angeles", "chicago", "miami"], help="Metro area")
    parser.add_argument("--borough", type=str, default="", help="Single borough/area to scrape")
    parser.add_argument("--neighborhood", type=str, default="", help="Single neighborhood name (e.g. 'Upper East Side')")
    parser.add_argument("--pages", type=int, default=20, help="Max pages per neighborhood (41 listings/page)")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing to DB")
    parser.add_argument("--start-index", type=int, default=0, help="Skip first N neighborhoods (for resuming)")
    args = parser.parse_args()

    metro = args.metro
    metro_areas = METRO_NEIGHBORHOODS.get(metro, ALL_BOROUGHS)

    # Build neighborhood list
    neighborhoods = []
    if args.neighborhood:
        # Find specific neighborhood
        for area, nbhds in metro_areas.items():
            for name, slug in nbhds:
                if name.lower() == args.neighborhood.lower():
                    neighborhoods.append((area, name, slug))
                    break
        if not neighborhoods:
            print(f"ERROR: Neighborhood '{args.neighborhood}' not found in {metro}")
            sys.exit(1)
    elif args.borough:
        if args.borough not in metro_areas:
            print(f"ERROR: Area '{args.borough}' not found. Choose from: {list(metro_areas.keys())}")
            sys.exit(1)
        for name, slug in metro_areas[args.borough]:
            neighborhoods.append((args.borough, name, slug))
    else:
        for area, nbhds in metro_areas.items():
            for name, slug in nbhds:
                neighborhoods.append((area, name, slug))

    max_pages = args.pages
    dry_run = args.dry_run

    # Apply start_index for resuming
    if args.start_index > 0:
        neighborhoods = neighborhoods[args.start_index:]

    total_matched = 0
    total_created = 0
    total_failed = 0
    total_rents = 0
    total_amenities = 0
    total_listings_saved = 0
    total_listings = 0
    total_units_linked = 0
    neighborhoods_scraped = 0
    neighborhoods_empty = 0

    print(f"Scraping zillow.com — metro={metro}, {len(neighborhoods)} neighborhoods, max {max_pages} pages each, dry_run={dry_run}")
    if args.start_index > 0:
        print(f"Resuming from index {args.start_index}")
    print(f"Start time: {datetime.now()}\n")

    for idx, (borough, nbhd_name, slug) in enumerate(neighborhoods):
        global_idx = idx + args.start_index
        base_url = get_url(slug)

        print(f"\n{'='*60}")
        print(f"[{global_idx}] {nbhd_name}, {borough}")
        print(f"{'='*60}")

        nbhd_listings = 0

        for page_num in range(1, max_pages + 1):
            if page_num == 1:
                url = base_url
            else:
                url = f"{base_url}{page_num}_p/"

            print(f"\n  Page {page_num}: {url}")

            data = fetch_page(url)
            if data is None:
                print(f"    FAILED to fetch page {page_num} after {MAX_RETRIES} retries. Skipping.")
                if page_num == 1:
                    neighborhoods_empty += 1
                break

            listings, total_results = extract_listings(data)
            print(f"    Got {len(listings)} listings (total available: {total_results})")

            if len(listings) == 0:
                if page_num == 1:
                    neighborhoods_empty += 1
                    print(f"    No listings in {nbhd_name}. Skipping.")
                else:
                    print(f"    No more listings.")
                break

            nbhd_listings += len(listings)
            total_listings += len(listings)

            for listing in listings:
                addr = listing["address_full"] or listing["address"]
                beds_available = list(listing["rent_by_beds"].keys())
                amenity_count = len(listing["amenities"])

                if dry_run:
                    print(f"    [DRY RUN] {addr} | beds={beds_available} | amenities={amenity_count} | rents={listing['rent_by_beds']}")
                    continue

                try:
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

                    # Link to specific unit if we have a unit number
                    unit_linked = False
                    unit_num = listing.get("unit_number")
                    if unit_num and building_id:
                        # Get the best price/beds for this unit
                        unit_beds = None
                        unit_price = None
                        if listing["rent_by_beds"]:
                            # Use the first (usually only) bed count
                            first_bed = next(iter(listing["rent_by_beds"]))
                            unit_beds = first_bed
                            unit_price = listing["rent_by_beds"][first_bed]["min_rent"]
                        elif listing.get("price_min"):
                            unit_price = listing["price_min"]
                            unit_beds = listing.get("bed_min")

                        unit_id = find_or_create_unit(building_id, unit_num, bedrooms=unit_beds)
                        if unit_id:
                            unit_linked = upsert_unit_listing(
                                building_id, unit_id, unit_num, listing,
                                price=unit_price, bedrooms=unit_beds
                            )
                            if unit_linked:
                                total_units_linked += 1

                    total_rents += rents_added
                    total_amenities += amenities_added
                    if listing_saved:
                        total_listings_saved += 1

                    unit_str = f", unit={unit_num}" if unit_linked else ""
                    print(f"    {label} {addr} -> {rents_added} rents, {amenities_added} amenities, listing={'OK' if listing_saved else 'FAIL'}{unit_str}")
                except Exception as e:
                    total_failed += 1
                    print(f"    ERROR processing {addr}: {e}")
                    continue

            # Check if we've gone past the total
            if page_num * LISTINGS_PER_PAGE >= total_results:
                print(f"    Reached end of results ({total_results} total).")
                break

            # Randomized delay between pages to avoid detection
            delay = random.uniform(PAGE_DELAY_MIN, PAGE_DELAY_MAX)
            print(f"    Waiting {delay:.1f}s...")
            time.sleep(delay)

        if nbhd_listings > 0:
            neighborhoods_scraped += 1
        print(f"  {nbhd_name} total: {nbhd_listings} listings")

        # Randomized delay between neighborhoods to avoid detection
        delay = random.uniform(NEIGHBORHOOD_DELAY_MIN, NEIGHBORHOOD_DELAY_MAX)
        print(f"  Neighborhood delay: {delay:.1f}s...")
        time.sleep(delay)

    print(f"\n{'='*60}")
    print(f"SUMMARY")
    print(f"{'='*60}")
    print(f"Neighborhoods scraped:   {neighborhoods_scraped}")
    print(f"Neighborhoods empty:     {neighborhoods_empty}")
    print(f"Total listings scraped:  {total_listings}")
    print(f"Matched to buildings:    {total_matched}")
    print(f"New buildings created:   {total_created}")
    print(f"Failed (no match/create):{total_failed}")
    print(f"Rent records upserted:   {total_rents}")
    print(f"Amenity records upserted:{total_amenities}")
    print(f"Full listings saved:     {total_listings_saved}")
    print(f"Units linked:            {total_units_linked}")
    print(f"End time: {datetime.now()}")


if __name__ == "__main__":
    main()

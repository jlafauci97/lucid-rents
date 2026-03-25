#!/usr/bin/env python3
"""
Scrape rent and amenity data from rent.com for NYC, LA, and Chicago using Scrapling.

Uses StealthyFetcher with real_chrome=True to bypass anti-bot protection,
then extracts structured JSON from Next.js __NEXT_DATA__ payload.

Usage:
    python3 scripts/scrape-rent-com.py                            # all NYC boroughs, 5 pages each
    python3 scripts/scrape-rent-com.py --metro=los-angeles        # all LA areas
    python3 scripts/scrape-rent-com.py --metro=chicago            # all Chicago areas
    python3 scripts/scrape-rent-com.py --borough=Manhattan        # single borough/area
    python3 scripts/scrape-rent-com.py --pages=20                 # more pages per area
    python3 scripts/scrape-rent-com.py --dry-run                  # preview without DB writes
"""

import json
import os
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
        "Manhattan": "https://www.rent.com/new-york/new-york-apartments",
        "Brooklyn": "https://www.rent.com/new-york/brooklyn-apartments",
        "Queens": "https://www.rent.com/new-york/queens-apartments",
        "Bronx": "https://www.rent.com/new-york/bronx-apartments",
        "Staten Island": "https://www.rent.com/new-york/staten-island-apartments",
    },
    "los-angeles": {
        "Downtown LA": "https://www.rent.com/california/los-angeles-apartments",
        "Hollywood": "https://www.rent.com/california/hollywood-apartments",
        "West Hollywood": "https://www.rent.com/california/west-hollywood-apartments",
        "Santa Monica": "https://www.rent.com/california/santa-monica-apartments",
        "Culver City": "https://www.rent.com/california/culver-city-apartments",
        "Glendale": "https://www.rent.com/california/glendale-apartments",
        "Burbank": "https://www.rent.com/california/burbank-apartments",
        "Pasadena": "https://www.rent.com/california/pasadena-apartments",
        "Long Beach": "https://www.rent.com/california/long-beach-apartments",
        "Inglewood": "https://www.rent.com/california/inglewood-apartments",
        "Torrance": "https://www.rent.com/california/torrance-apartments",
        "El Segundo": "https://www.rent.com/california/el-segundo-apartments",
        "Redondo Beach": "https://www.rent.com/california/redondo-beach-apartments",
        "Venice": "https://www.rent.com/california/los-angeles-apartments/neighborhoods/venice",
        "Silver Lake": "https://www.rent.com/california/los-angeles-apartments/neighborhoods/silver-lake",
        "Echo Park": "https://www.rent.com/california/los-angeles-apartments/neighborhoods/echo-park",
        "Koreatown": "https://www.rent.com/california/los-angeles-apartments/neighborhoods/koreatown",
        "North Hollywood": "https://www.rent.com/california/north-hollywood-apartments",
        "Studio City": "https://www.rent.com/california/studio-city-apartments",
        "Sherman Oaks": "https://www.rent.com/california/sherman-oaks-apartments",
    },
    "chicago": {
        "Chicago": "https://www.rent.com/illinois/chicago-apartments",
        "Loop": "https://www.rent.com/illinois/chicago-apartments/neighborhoods/loop",
        "Lincoln Park": "https://www.rent.com/illinois/chicago-apartments/neighborhoods/lincoln-park",
        "Lakeview": "https://www.rent.com/illinois/chicago-apartments/neighborhoods/lakeview",
        "Wicker Park": "https://www.rent.com/illinois/chicago-apartments/neighborhoods/wicker-park",
        "Logan Square": "https://www.rent.com/illinois/chicago-apartments/neighborhoods/logan-square",
        "River North": "https://www.rent.com/illinois/chicago-apartments/neighborhoods/river-north",
        "Gold Coast": "https://www.rent.com/illinois/chicago-apartments/neighborhoods/gold-coast",
        "Hyde Park": "https://www.rent.com/illinois/chicago-apartments/neighborhoods/hyde-park",
        "South Loop": "https://www.rent.com/illinois/chicago-apartments/neighborhoods/south-loop",
        "West Loop": "https://www.rent.com/illinois/chicago-apartments/neighborhoods/west-loop",
        "Evanston": "https://www.rent.com/illinois/evanston-apartments",
        "Oak Park": "https://www.rent.com/illinois/oak-park-apartments",
    },
    "miami": {
        "Miami": "https://www.rent.com/florida/miami-apartments",
        "Brickell": "https://www.rent.com/florida/miami-apartments/neighborhoods/brickell",
        "Downtown Miami": "https://www.rent.com/florida/miami-apartments/neighborhoods/downtown-miami",
        "Wynwood": "https://www.rent.com/florida/miami-apartments/neighborhoods/wynwood",
        "Miami Beach": "https://www.rent.com/florida/miami-apartments/neighborhoods/miami-beach",
        "Coral Gables": "https://www.rent.com/florida/coral-gables-apartments",
        "Coconut Grove": "https://www.rent.com/florida/miami-apartments/neighborhoods/coconut-grove",
        "Doral": "https://www.rent.com/florida/doral-apartments",
        "Kendall": "https://www.rent.com/florida/miami-apartments/neighborhoods/kendall",
        "Aventura": "https://www.rent.com/florida/aventura-apartments",
        "Edgewater": "https://www.rent.com/florida/miami-apartments/neighborhoods/edgewater",
        "Little Havana": "https://www.rent.com/florida/miami-apartments/neighborhoods/little-havana",
    },
}

# Backward compat
BOROUGH_URLS = METRO_AREA_URLS["nyc"]

METRO_INFO = {
    "nyc": {"city": "New York", "state": "NY"},
    "los-angeles": {"city": "Los Angeles", "state": "CA"},
    "chicago": {"city": "Chicago", "state": "IL"},
    "miami": {"city": "Miami", "state": "FL"},
}

MAX_RETRIES = 3
RETRY_DELAY = 5  # seconds between retries
PAGE_DELAY = 4  # seconds between page fetches
SOURCE = "rent_com"

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


# ── FETCHING ─────────────────────────────────────────────────────────────────
def fetch_page(url: str) -> dict | None:
    """Fetch a rent.com page and extract __NEXT_DATA__ JSON."""
    for attempt in range(MAX_RETRIES):
        try:
            page = StealthyFetcher.fetch(
                url,
                headless=True,
                real_chrome=True,
                network_idle=True,
                timeout=30000,
                wait=5000,
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
    """Extract full listing data and total count from __NEXT_DATA__."""
    try:
        page_data = data["props"]["pageProps"]["pageData"]
        listings_raw = page_data["location"]["listingSearch"]["listings"]
        filters = page_data["location"]["listingSearch"]["filterMatchResults"]
        total = page_data.get("numResults", 0)

        filter_by_id = {f["listingId"]: f for f in filters}

        listings = []
        for l in listings_raw:
            listing_id = l.get("id", "")
            filt = filter_by_id.get(listing_id, {})
            bed_count_data = filt.get("bedCountData", [])

            # Per-bedroom price breakdown
            bed_price_data = []
            for bcd in bed_count_data:
                beds = bcd.get("beds", -1)
                if beds < 0:
                    continue
                prices = bcd.get("prices", {})
                sqft = bcd.get("squareFeet", {})
                lo = prices.get("low")
                hi = prices.get("high")
                if lo is not None and 500 <= lo <= 50000:
                    bed_price_data.append({
                        "beds": beds,
                        "priceMin": lo,
                        "priceMax": hi if (hi and 500 <= hi <= 50000) else lo,
                        "sqftMin": sqft.get("low"),
                        "sqftMax": sqft.get("high"),
                    })

            # Floor plans
            floor_plans = []
            for fp in l.get("floorPlans", []):
                beds = fp.get("bedCount", -1)
                if beds < 0:
                    continue
                pr = fp.get("priceRange", {})
                sq = fp.get("sqFtRange", {})
                floor_plans.append({
                    "bedCount": beds,
                    "bathCount": fp.get("bathCount"),
                    "availableCount": fp.get("availableCount", 0),
                    "priceMin": pr.get("min"),
                    "priceMax": pr.get("max"),
                    "sqftMin": sq.get("min"),
                    "sqftMax": sq.get("max"),
                })

            # Build rent_by_beds for building_rents table (aggregated)
            rent_by_beds = {}
            for bpd in bed_price_data:
                rent_by_beds[bpd["beds"]] = {
                    "min_rent": bpd["priceMin"],
                    "max_rent": bpd["priceMax"],
                    "sqft_min": bpd["sqftMin"],
                    "sqft_max": bpd["sqftMax"],
                }
            # Supplement from floor plans
            for fp in floor_plans:
                beds = fp["bedCount"]
                lo = fp["priceMin"]
                hi = fp["priceMax"]
                if lo is None and hi is None:
                    continue
                price = lo or hi
                if not (500 <= price <= 50000):
                    continue
                if beds not in rent_by_beds:
                    rent_by_beds[beds] = {"min_rent": price, "max_rent": price, "sqft_min": None, "sqft_max": None}
                else:
                    entry = rent_by_beds[beds]
                    if lo and lo < entry["min_rent"]:
                        entry["min_rent"] = lo
                    if hi and hi > entry["max_rent"]:
                        entry["max_rent"] = hi

            # Office hours
            office_hours = []
            for oh in l.get("officeHours", []):
                for t in oh.get("times", []):
                    office_hours.append({
                        "day": oh.get("day", ""),
                        "open": t.get("open", ""),
                        "close": t.get("close", ""),
                    })

            # Price range
            pr = l.get("priceRange", {})
            bed_range = l.get("bedRange", {})

            # Management company
            mgmt = l.get("propertyManagementCompany", {}) or {}

            listings.append({
                # Identity
                "name": l.get("name", ""),
                "address": l.get("address", ""),
                "address_full": l.get("addressFull", ""),
                "zip_code": l.get("zipCode", ""),
                "latitude": l.get("location", {}).get("lat"),
                "longitude": l.get("location", {}).get("lng"),
                "property_type": l.get("propertyType", ""),
                "listing_url": l.get("urlPathname", ""),
                # Amenities
                "amenities": l.get("amenitiesHighlighted", []),
                # Rent data (aggregated for building_rents)
                "rent_by_beds": rent_by_beds,
                # Full listing data (for building_listings)
                "listing_name": l.get("name"),
                "price_min": pr.get("min"),
                "price_max": pr.get("max"),
                "price_text": l.get("priceText", ""),
                "bed_min": bed_range.get("min"),
                "bed_max": bed_range.get("max"),
                "bath_min": filt.get("baths", {}).get("low"),
                "bath_max": filt.get("baths", {}).get("high"),
                "sqft_min": filt.get("sqFtRange", {}).get("min"),
                "sqft_max": filt.get("sqFtRange", {}).get("max"),
                "bed_text": l.get("bedText", ""),
                "bath_text": l.get("bathText", ""),
                "sqft_text": l.get("squareFeetText", ""),
                "units_available": filt.get("totalAvailable", 0),
                "units_available_text": l.get("unitsAvailableText") or filt.get("unitsAvailableText", ""),
                "availability_status": l.get("availabilityStatus", ""),
                "management_company": mgmt.get("name"),
                "verified": l.get("verified", False),
                "has_price_drops": l.get("hasPriceDrops", False),
                "listing_views": l.get("pdpViews"),
                "updated_at_source": l.get("updatedAt"),
                "floor_plans": floor_plans,
                "bed_price_data": bed_price_data,
                "office_hours": office_hours,
            })

        return listings, total

    except (KeyError, TypeError) as e:
        print(f"    Error extracting listings: {e}")
        return [], 0


# ── BOROUGH DETECTION ────────────────────────────────────────────────────────
# rent.com uses city names like "New York", "Brooklyn", "Bronx", etc.
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
    "culver city": "Culver City", "glendale": "Glendale",
    "burbank": "Burbank", "pasadena": "Pasadena",
    "long beach": "Long Beach", "inglewood": "Inglewood",
    "torrance": "Torrance", "el segundo": "El Segundo",
    "redondo beach": "Redondo Beach",
    # Chicago
    "chicago": "Chicago", "evanston": "Evanston", "oak park": "Oak Park",
    # Miami
    "miami": "Miami", "miami beach": "Miami Beach", "coral gables": "Coral Gables",
    "doral": "Doral", "hialeah": "Hialeah", "aventura": "Aventura",
    "coconut grove": "Coconut Grove", "brickell": "Brickell", "wynwood": "Wynwood",
}


def detect_borough(listing: dict, default_area: str = "Manhattan") -> str:
    """Detect borough/area from listing city/address."""
    city = listing.get("address_full", "").split(",")
    if len(city) >= 2:
        city_name = city[1].strip().lower()
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
    import re
    return re.sub(r'(^-+|-+$)', '', re.sub(r'[^a-z0-9]+', '-', full_address.lower()))


# ── BUILDING MATCHING ────────────────────────────────────────────────────────
def match_building(listing: dict) -> str | None:
    """Try to match a rent.com listing to an existing building by address + zip."""
    addr = listing.get("address_full", "")
    zip_code = listing.get("zip_code", "")

    if not addr or not zip_code:
        return None

    # Normalize the address for matching
    # Extract just the street address (before the city/state/zip part)
    street = addr.split(",")[0].strip() if "," in addr else addr
    normalized = normalize_address(street)

    # Try exact match on full_address containing the street + zip
    result = supabase.table("buildings") \
        .select("id") \
        .eq("zip_code", zip_code) \
        .ilike("full_address", f"%{normalized}%") \
        .limit(1) \
        .execute()

    if result.data and len(result.data) > 0:
        return result.data[0]["id"]

    # Try matching with just house number + street name
    parts = normalized.split()
    if len(parts) >= 2:
        house_num = parts[0]
        # Try matching house_number + zip
        result = supabase.table("buildings") \
            .select("id") \
            .eq("zip_code", zip_code) \
            .eq("house_number", house_num) \
            .limit(1) \
            .execute()

        if result.data and len(result.data) > 0:
            return result.data[0]["id"]

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


def upsert_amenities(building_id: str, amenities: list[str]) -> int:
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
    """Create a new building record from a rent.com listing. Returns building ID."""
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
    parser = argparse.ArgumentParser(description="Scrape rent.com for rent & amenity data")
    parser.add_argument("--metro", type=str, default="nyc", choices=["nyc", "los-angeles", "chicago", "miami"], help="Metro area")
    parser.add_argument("--borough", type=str, default="", help="Single borough/area to scrape")
    parser.add_argument("--pages", type=int, default=5, help="Pages per area (30 listings/page)")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing to DB")
    parser.add_argument("--start-page", type=int, default=1, help="Starting page number")
    args = parser.parse_args()

    metro = args.metro
    area_urls = METRO_AREA_URLS.get(metro, BOROUGH_URLS)
    boroughs = {args.borough: area_urls[args.borough]} if args.borough else area_urls
    max_pages = args.pages
    dry_run = args.dry_run

    total_matched = 0
    total_created = 0
    total_failed = 0
    total_rents = 0
    total_amenities = 0
    total_listings_saved = 0
    total_listings = 0

    print(f"Scraping rent.com — metro={metro}, areas={list(boroughs.keys())}, pages={max_pages}, dry_run={dry_run}")
    print(f"Start time: {datetime.now()}\n")

    for borough, base_url in boroughs.items():
        print(f"\n{'='*60}")
        print(f"BOROUGH: {borough}")
        print(f"{'='*60}")

        for page_num in range(args.start_page, args.start_page + max_pages):
            url = base_url if page_num == 1 else f"{base_url}/page-{page_num}"
            print(f"\n  Page {page_num}: {url}")

            data = fetch_page(url)
            if data is None:
                print(f"    FAILED to fetch page {page_num} after {MAX_RETRIES} retries. Skipping.")
                continue

            listings, total_results = extract_listings(data)
            print(f"    Got {len(listings)} listings (total available: {total_results})")

            if len(listings) == 0:
                print(f"    No more listings. Moving to next borough.")
                break

            total_listings += len(listings)

            for listing in listings:
                addr = listing["address_full"] or listing["address"]
                beds_available = list(listing["rent_by_beds"].keys())
                amenity_count = len(listing["amenities"])

                if dry_run:
                    print(f"    [DRY RUN] {addr} | beds={beds_available} | amenities={amenity_count}")
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
                amenities_added = upsert_amenities(building_id, listing["amenities"])
                listing_saved = upsert_listing(building_id, listing)

                total_rents += rents_added
                total_amenities += amenities_added
                if listing_saved:
                    total_listings_saved += 1

                print(f"    {label} {addr} -> {rents_added} rents, {amenities_added} amenities, listing={'OK' if listing_saved else 'FAIL'}")

            # Check if we've gone past the total
            if page_num * 30 >= total_results:
                print(f"    Reached end of results ({total_results} total). Moving to next borough.")
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

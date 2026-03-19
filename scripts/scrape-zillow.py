#!/usr/bin/env python3
"""
Scrape rent data from zillow.com for NYC's five boroughs using Scrapling.

Uses StealthyFetcher with real_chrome=True to bypass anti-bot protection,
then extracts structured JSON from Next.js __NEXT_DATA__ payload.

Usage:
    python3 scripts/scrape-zillow.py                        # all boroughs, 5 pages each
    python3 scripts/scrape-zillow.py --borough=Manhattan    # single borough
    python3 scripts/scrape-zillow.py --pages=20             # more pages per borough
    python3 scripts/scrape-zillow.py --start-page=3         # start from page 3
    python3 scripts/scrape-zillow.py --dry-run              # preview without DB writes
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

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or env.get("NEXT_PUBLIC_SUPABASE_URL", "")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("SUPABASE_SERVICE_ROLE_KEY", "")

if not SUPABASE_URL or not SERVICE_KEY:
    print("ERROR: Missing SUPABASE_URL or SERVICE_KEY in .env.local or environment")
    sys.exit(1)

# Late imports so env check fails fast
from scrapling import StealthyFetcher
from supabase import create_client

supabase = create_client(SUPABASE_URL, SERVICE_KEY)

# ── CONSTANTS ────────────────────────────────────────────────────────────────
BOROUGH_URLS = {
    "Manhattan": "https://www.zillow.com/manhattan-new-york-ny/rentals/",
    "Brooklyn": "https://www.zillow.com/brooklyn-new-york-ny/rentals/",
    "Queens": "https://www.zillow.com/queens-new-york-ny/rentals/",
    "Bronx": "https://www.zillow.com/bronx-new-york-ny/rentals/",
    "Staten Island": "https://www.zillow.com/staten-island-new-york-ny/rentals/",
}

MAX_RETRIES = 3
RETRY_DELAY = 5  # seconds between retries
PAGE_DELAY = 4  # seconds between page fetches
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


# ── BOROUGH DETECTION ────────────────────────────────────────────────────────
CITY_TO_BOROUGH = {
    "new york": "Manhattan",
    "manhattan": "Manhattan",
    "brooklyn": "Brooklyn",
    "bronx": "Bronx",
    "queens": "Queens",
    "long island city": "Queens",
    "astoria": "Queens",
    "flushing": "Queens",
    "jamaica": "Queens",
    "jackson heights": "Queens",
    "woodside": "Queens",
    "sunnyside": "Queens",
    "forest hills": "Queens",
    "rego park": "Queens",
    "staten island": "Staten Island",
    "arverne": "Queens",
    "far rockaway": "Queens",
    "woodhaven": "Queens",
    "ridgewood": "Queens",
    "bayside": "Queens",
    "elmhurst": "Queens",
    "corona": "Queens",
    "kew gardens": "Queens",
    "ozone park": "Queens",
    "howard beach": "Queens",
    "fresh meadows": "Queens",
    "whitestone": "Queens",
    "college point": "Queens",
    "maspeth": "Queens",
    "middle village": "Queens",
    "glendale": "Queens",
    "woodside": "Queens",
    "east elmhurst": "Queens",
    "south ozone park": "Queens",
    "south richmond hill": "Queens",
    "richmond hill": "Queens",
    "springfield gardens": "Queens",
    "laurelton": "Queens",
    "rosedale": "Queens",
    "cambria heights": "Queens",
    "st. albans": "Queens",
    "hollis": "Queens",
    "floral park": "Queens",
    "little neck": "Queens",
    "douglaston": "Queens",
    "glen oaks": "Queens",
    "bellerose": "Queens",
    "briarwood": "Queens",
}


def detect_borough(listing: dict) -> str:
    """Detect NYC borough from listing city/address."""
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
    return "Manhattan"  # default


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
            street = address_street.split("#")[0].strip() if address_street else ""
            if not street:
                street = address.split(",")[0].strip() if "," in address else address

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

            # Compute overall price range from units
            all_prices = [parse_price(u.get("price", "")) for u in units if not u.get("roomForRent")]
            all_prices = [p for p in all_prices if p is not None]
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


def create_building(listing: dict) -> str | None:
    """Create a new building record from a Zillow listing. Returns building ID."""
    street = listing.get("address_street", "")
    if not street:
        return None

    borough = detect_borough(listing)
    parts = street.upper().split(None, 1)
    house_number = parts[0] if parts else ""
    street_name = parts[1] if len(parts) > 1 else ""
    zip_code = listing.get("zip_code", "")

    # Build full_address in the same format as the sync: "23-10 42ND RD, Queens, NY, 11101"
    full_address = f"{street.upper()}, {borough}, NY"
    if zip_code:
        full_address += f", {zip_code}"

    slug = generate_slug(full_address)

    row = {
        "full_address": full_address,
        "house_number": house_number,
        "street_name": street_name,
        "borough": borough,
        "city": "New York",
        "state": "NY",
        "zip_code": zip_code or None,
        "slug": slug,
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
    parser = argparse.ArgumentParser(description="Scrape zillow.com for NYC rent data")
    parser.add_argument("--borough", type=str, default="", help="Single borough to scrape")
    parser.add_argument("--pages", type=int, default=5, help="Pages per borough (41 listings/page)")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing to DB")
    parser.add_argument("--start-page", type=int, default=1, help="Starting page number")
    args = parser.parse_args()

    boroughs = {args.borough: BOROUGH_URLS[args.borough]} if args.borough else BOROUGH_URLS
    max_pages = args.pages
    dry_run = args.dry_run

    total_matched = 0
    total_created = 0
    total_failed = 0
    total_rents = 0
    total_amenities = 0
    total_listings_saved = 0
    total_listings = 0

    print(f"Scraping zillow.com — boroughs={list(boroughs.keys())}, pages={max_pages}, dry_run={dry_run}")
    print(f"Start time: {datetime.now()}\n")

    for borough, base_url in boroughs.items():
        print(f"\n{'='*60}")
        print(f"BOROUGH: {borough}")
        print(f"{'='*60}")

        for page_num in range(args.start_page, args.start_page + max_pages):
            if page_num == 1:
                url = base_url
            else:
                url = f"{base_url}{page_num}_p/"

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
                    print(f"    [DRY RUN] {addr} | beds={beds_available} | amenities={amenity_count} | rents={listing['rent_by_beds']}")
                    continue

                # Try to match existing building
                building_id = match_building(listing)

                if building_id:
                    total_matched += 1
                    label = "MATCHED"
                else:
                    # Create new building
                    building_id = create_building(listing)
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
            if page_num * LISTINGS_PER_PAGE >= total_results:
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

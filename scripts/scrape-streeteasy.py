#!/usr/bin/env python3
"""
Scrape rental listing data from StreetEasy for NYC's five boroughs using Scrapling.

Uses StealthyFetcher with real_chrome=True to bypass anti-bot protection,
then extracts listing data from HTML listing cards.

StreetEasy is NYC-only: 14 listings per page, max 500 shown per borough search.

Usage:
    python3 scripts/scrape-streeteasy.py                        # all boroughs, 36 pages each
    python3 scripts/scrape-streeteasy.py --borough=Manhattan    # single borough
    python3 scripts/scrape-streeteasy.py --pages=10             # fewer pages per borough
    python3 scripts/scrape-streeteasy.py --dry-run              # preview without DB writes
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
BOROUGH_URLS = {
    "Manhattan": "https://streeteasy.com/for-rent/manhattan",
    "Brooklyn": "https://streeteasy.com/for-rent/brooklyn",
    "Queens": "https://streeteasy.com/for-rent/queens",
    "Bronx": "https://streeteasy.com/for-rent/bronx",
    "Staten Island": "https://streeteasy.com/for-rent/staten-island",
}

MAX_RETRIES = 3
RETRY_DELAY = 5  # seconds between retries
PAGE_DELAY = 4  # seconds between page fetches
LISTINGS_PER_PAGE = 14
MAX_SHOWN = 500  # StreetEasy caps at 500 visible listings per search
SOURCE = "streeteasy"

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


# ── BOROUGH DETECTION ────────────────────────────────────────────────────────
# StreetEasy is NYC-only; borough is known from the search URL.
# This is used as fallback for listings that may appear in cross-borough results.
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
}


def detect_borough(listing: dict, default_borough: str = "Manhattan") -> str:
    """Detect NYC borough from listing data. Uses default_borough from search context."""
    # Check neighborhood text for borough hints
    neighborhood = listing.get("neighborhood", "").lower()
    for key, boro in CITY_TO_BOROUGH.items():
        if key in neighborhood:
            return boro

    # Check address for borough hints
    address = listing.get("address", "").lower()
    for key, boro in CITY_TO_BOROUGH.items():
        if key in address:
            return boro

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

    return default_borough


def generate_slug(full_address: str) -> str:
    """Generate a URL slug from a full address (matches seo.ts logic)."""
    return re.sub(r'(^-+|-+$)', '', re.sub(r'[^a-z0-9]+', '-', full_address.lower()))


# ── PARSING HELPERS ──────────────────────────────────────────────────────────
def parse_price(text: str) -> int | None:
    """Extract integer price from text like '$3,500/mo' or '$3,500'."""
    if not text:
        return None
    match = re.search(r'\$?([\d,]+)', text.replace(",", "").replace(" ", ""))
    if not match:
        # Try with commas preserved for the regex
        match = re.search(r'\$?([\d,]+)', text)
    if match:
        raw = match.group(1).replace(",", "")
        try:
            val = int(raw)
            if 200 <= val <= 100000:
                return val
        except ValueError:
            pass
    return None


def parse_beds(text: str) -> int | None:
    """Extract bed count from text like '2 bed', 'Studio', '1 BR'."""
    if not text:
        return None
    lower = text.lower().strip()
    if "studio" in lower:
        return 0
    match = re.search(r'(\d+)\s*(?:bed|br|bd)', lower)
    if match:
        return int(match.group(1))
    # Just a bare number at start
    match = re.match(r'^(\d+)$', lower.strip())
    if match:
        return int(match.group(1))
    return None


def parse_baths(text: str) -> float | None:
    """Extract bath count from text like '1 bath', '1.5 ba'."""
    if not text:
        return None
    lower = text.lower().strip()
    match = re.search(r'([\d.]+)\s*(?:bath|ba)', lower)
    if match:
        try:
            return float(match.group(1))
        except ValueError:
            pass
    return None


def parse_sqft(text: str) -> int | None:
    """Extract sqft from text like '750 ft²', '1,200 sq ft'."""
    if not text:
        return None
    cleaned = text.replace(",", "")
    match = re.search(r'([\d]+)\s*(?:ft|sf|sq)', cleaned.lower())
    if match:
        try:
            val = int(match.group(1))
            if 50 <= val <= 50000:
                return val
        except ValueError:
            pass
    return None


# ── FETCHING ─────────────────────────────────────────────────────────────────
def fetch_page(url: str):
    """Fetch a StreetEasy page and return the Scrapling page object."""
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

            return page

        except Exception as e:
            print(f"    Attempt {attempt + 1}: Error - {e}")
            time.sleep(RETRY_DELAY * (attempt + 1))

    return None


def extract_listings_from_html(page, default_borough: str) -> list[dict]:
    """Extract listing data from StreetEasy HTML listing cards."""
    listings = []

    # StreetEasy listing cards use data-testid attributes containing "listing"
    cards = page.css('[data-testid*="listing"]')

    if not cards or len(cards) == 0:
        # Fallback: try common StreetEasy listing container selectors
        cards = page.css('.listingCard, .listing-card, [class*="ListingCard"], [class*="searchCardList"] > li, [class*="listing-card"]')

    if not cards or len(cards) == 0:
        print("    No listing cards found on page.")
        return []

    for card in cards:
        try:
            listing = parse_listing_card(card, default_borough)
            if listing and listing.get("address"):
                listings.append(listing)
        except Exception as e:
            print(f"    Error parsing listing card: {e}")
            continue

    return listings


def parse_listing_card(card, default_borough: str) -> dict | None:
    """Parse a single StreetEasy listing card element into a dict."""

    # ── Address ──────────────────────────────────────────────────────────
    address = ""
    # Try multiple selectors for the address
    addr_el = card.css('[data-testid*="address"], [class*="address"], .listingCard-address, address')
    if addr_el and len(addr_el) > 0:
        address = addr_el[0].text.strip()

    if not address:
        # Try looking for a link that contains the address (common SE pattern)
        links = card.css("a")
        for link in links:
            href = link.attrib.get("href", "")
            text = link.text.strip()
            # StreetEasy listing links often contain the address
            if href and "/building/" in href or "/rental/" in href:
                if text and not text.startswith("$"):
                    address = text
                    break

    if not address:
        # Try heading elements
        headings = card.css("h2, h3, h4, .title, [class*='title']")
        for h in headings:
            text = h.text.strip()
            if text and not text.startswith("$") and any(c.isdigit() for c in text[:5]):
                address = text
                break

    if not address:
        return None

    # ── Listing URL ──────────────────────────────────────────────────────
    listing_url = ""
    links = card.css("a")
    for link in links:
        href = link.attrib.get("href", "")
        if href and ("/rental/" in href or "/building/" in href or "/for-rent/" in href):
            if not href.startswith("http"):
                listing_url = f"https://streeteasy.com{href}"
            else:
                listing_url = href
            break

    if not listing_url and links and len(links) > 0:
        href = links[0].attrib.get("href", "")
        if href:
            if not href.startswith("http"):
                listing_url = f"https://streeteasy.com{href}"
            else:
                listing_url = href

    # ── Price ────────────────────────────────────────────────────────────
    price = None
    price_text = ""
    # Use span-specific selector first to avoid matching wrapper divs with empty text
    price_el = card.css('span[class*="price"], span[class*="Price"]')
    if not price_el:
        price_el = card.css('[data-testid*="price"], [class*="price"], .listingCard-price, .price')
    # Iterate all matches to find one with actual price text (skip empty wrappers)
    if price_el:
        for pel in price_el:
            t = pel.text.strip() if pel.text else ""
            if t and "$" in t:
                price_text = t
                price = parse_price(price_text)
                break

    if price is None:
        # Scan all child elements for dollar amounts
        all_els = card.css("span, p, div")
        for el in all_els:
            t = el.text.strip() if el.text else ""
            if t and "$" in t:
                price_match = re.search(r'\$[\d,]+', t)
                if price_match:
                    price_text = price_match.group(0)
                    price = parse_price(price_text)
                    if price is not None:
                        break

    # ── Beds / Baths / Sqft ──────────────────────────────────────────────
    beds = None
    baths = None
    sqft = None
    beds_text = ""
    baths_text = ""
    sqft_text = ""

    # Try specific data-testid selectors
    bed_el = card.css('[data-testid*="bed"], [class*="bed"]')
    if bed_el and len(bed_el) > 0:
        beds_text = bed_el[0].text.strip()
        beds = parse_beds(beds_text)

    bath_el = card.css('[data-testid*="bath"], [class*="bath"]')
    if bath_el and len(bath_el) > 0:
        baths_text = bath_el[0].text.strip()
        baths = parse_baths(baths_text)

    sqft_el = card.css('[data-testid*="sqft"], [data-testid*="size"], [class*="sqft"], [class*="size"]')
    if sqft_el and len(sqft_el) > 0:
        sqft_text = sqft_el[0].text.strip()
        sqft = parse_sqft(sqft_text)

    # Fallback: parse from combined detail text
    if beds is None or baths is None:
        detail_els = card.css('[class*="detail"], [class*="info"], .listingCard-details, li, span')
        for el in detail_els:
            text = el.text.strip().lower()
            if beds is None and ("bed" in text or "studio" in text or "br" in text):
                beds_text = el.text.strip()
                beds = parse_beds(beds_text)
            if baths is None and ("bath" in text or "ba" in text):
                baths_text = el.text.strip()
                baths = parse_baths(baths_text)
            if sqft is None and ("ft" in text or "sq" in text or "sf" in text):
                sqft_text = el.text.strip()
                sqft = parse_sqft(sqft_text)

    # Last resort: parse the full card text with regex
    if beds is None or baths is None or sqft is None:
        full_text = card.text
        if beds is None:
            if "studio" in full_text.lower():
                beds = 0
                beds_text = "Studio"
            else:
                m = re.search(r'(\d+)\s*(?:bed|br|bd)', full_text, re.IGNORECASE)
                if m:
                    beds = int(m.group(1))
                    beds_text = m.group(0)
        if baths is None:
            m = re.search(r'([\d.]+)\s*(?:bath|ba)', full_text, re.IGNORECASE)
            if m:
                try:
                    baths = float(m.group(1))
                    baths_text = m.group(0)
                except ValueError:
                    pass
        if sqft is None:
            m = re.search(r'([\d,]+)\s*(?:ft|sf|sq)', full_text, re.IGNORECASE)
            if m:
                sqft = parse_sqft(m.group(0))
                sqft_text = m.group(0)

    # ── Neighborhood ─────────────────────────────────────────────────────
    neighborhood = ""
    nbhd_el = card.css('[data-testid*="neighborhood"], [class*="neighborhood"], [class*="subtitle"], .listingCard-neighborhood')
    if nbhd_el and len(nbhd_el) > 0:
        neighborhood = nbhd_el[0].text.strip()

    # ── Amenities (from card-level tags/badges) ──────────────────────────
    amenities = []
    amenity_els = card.css('[data-testid*="amenity"], [class*="amenity"], [class*="tag"], [class*="badge"], [class*="perk"]')
    for el in amenity_els:
        text = el.text.strip()
        if text and len(text) < 60:
            amenities.append(text)

    # ── No-fee badge ─────────────────────────────────────────────────────
    no_fee = False
    fee_els = card.css('[class*="no-fee"], [class*="noFee"], [data-testid*="no-fee"]')
    if fee_els and len(fee_els) > 0:
        no_fee = True
    elif "no fee" in card.text.lower():
        no_fee = True

    # ── Build rent_by_beds ───────────────────────────────────────────────
    rent_by_beds = {}
    if price and beds is not None:
        rent_by_beds[beds] = {
            "min_rent": price,
            "max_rent": price,
            "sqft_min": sqft,
            "sqft_max": sqft,
        }

    # ── Build zip_code from address (StreetEasy sometimes includes it) ──
    zip_code = ""
    zip_match = re.search(r'\b(\d{5})\b', address)
    if zip_match:
        zip_code = zip_match.group(1)

    # Clean address: remove trailing zip if present
    clean_address = address
    if zip_code:
        clean_address = address.replace(zip_code, "").strip().rstrip(",").strip()

    borough = detect_borough({
        "neighborhood": neighborhood,
        "address": address,
        "zip_code": zip_code,
    }, default_borough)

    return {
        # Identity
        "address": clean_address,
        "address_full": address,
        "zip_code": zip_code,
        "neighborhood": neighborhood,
        "borough": borough,
        "latitude": None,
        "longitude": None,
        "property_type": "apartment",
        "listing_url": listing_url,
        # Amenities
        "amenities": amenities,
        # Rent data
        "rent_by_beds": rent_by_beds,
        # Listing details
        "listing_name": clean_address,
        "price_min": price,
        "price_max": price,
        "price_text": price_text,
        "bed_min": beds,
        "bed_max": beds,
        "bath_min": baths,
        "bath_max": baths,
        "sqft_min": sqft,
        "sqft_max": sqft,
        "bed_text": beds_text,
        "bath_text": baths_text,
        "sqft_text": sqft_text,
        "units_available": 1,
        "units_available_text": "1 unit",
        "availability_status": "available",
        "management_company": None,
        "verified": False,
        "has_price_drops": False,
        "listing_views": None,
        "updated_at_source": None,
        "floor_plans": [],
        "bed_price_data": [],
        "office_hours": [],
        "no_fee": no_fee,
    }


# ── BUILDING MATCHING ────────────────────────────────────────────────────────
def match_building(listing: dict) -> str | None:
    """Try to match a StreetEasy listing to an existing building by address + zip."""
    addr = listing.get("address", "")
    zip_code = listing.get("zip_code", "")

    if not addr:
        return None

    # Normalize the address for matching
    street = addr.split(",")[0].strip() if "," in addr else addr
    normalized = normalize_address(street)

    try:
        if zip_code:
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
            if zip_code:
                result = supabase.table("buildings") \
                    .select("id") \
                    .eq("zip_code", zip_code) \
                    .eq("house_number", house_num) \
                    .limit(1) \
                    .execute()

                if result.data and len(result.data) > 0:
                    return result.data[0]["id"]

        # Try without zip code: match on full_address + borough
        borough = listing.get("borough", "")
        if borough:
            result = supabase.table("buildings") \
                .select("id") \
                .eq("borough", borough) \
                .ilike("full_address", f"%{normalized}%") \
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
    """Create a new building record from a StreetEasy listing. Returns building ID."""
    addr = listing.get("address", "")
    if not addr:
        return None

    borough = listing.get("borough", "Manhattan")
    street = addr.split(",")[0].strip() if "," in addr else addr
    parts = street.split(None, 1)
    house_number = parts[0].upper() if parts else ""
    street_name = parts[1].upper() if len(parts) > 1 else ""
    zip_code = listing.get("zip_code", "")

    # Build full_address in the same format as the sync
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
        "bath_min": int(listing["bath_min"]) if listing.get("bath_min") is not None else None,
        "bath_max": int(listing["bath_max"]) if listing.get("bath_max") is not None else None,
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
    parser = argparse.ArgumentParser(description="Scrape StreetEasy for NYC rent & amenity data")
    parser.add_argument("--borough", type=str, default="", help="Single borough to scrape")
    parser.add_argument("--pages", type=int, default=36, help="Pages per borough (14 listings/page, max ~36)")
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

    print(f"Scraping StreetEasy -- boroughs={list(boroughs.keys())}, pages={max_pages}, dry_run={dry_run}")
    print(f"Start time: {datetime.now()}\n")

    for borough, base_url in boroughs.items():
        print(f"\n{'='*60}")
        print(f"BOROUGH: {borough}")
        print(f"{'='*60}")

        for page_num in range(args.start_page, args.start_page + max_pages):
            url = base_url if page_num == 1 else f"{base_url}?page={page_num}"
            print(f"\n  Page {page_num}: {url}")

            page = fetch_page(url)
            if page is None:
                print(f"    FAILED to fetch page {page_num} after {MAX_RETRIES} retries. Skipping.")
                continue

            listings = extract_listings_from_html(page, borough)
            print(f"    Got {len(listings)} listings")

            if len(listings) == 0:
                print(f"    No more listings. Moving to next borough.")
                break

            total_listings += len(listings)

            for listing in listings:
                addr = listing["address"]
                beds = listing.get("bed_min")
                price = listing.get("price_min")
                beds_display = "Studio" if beds == 0 else f"{beds}BR" if beds is not None else "?"
                price_display = f"${price:,}" if price else "?"

                if dry_run:
                    print(f"    [DRY RUN] {addr} | {beds_display} | {price_display} | amenities={len(listing['amenities'])}")
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

            # Check if we've hit the StreetEasy cap (500 listings max shown)
            if page_num * LISTINGS_PER_PAGE >= MAX_SHOWN:
                print(f"    Reached StreetEasy display limit ({MAX_SHOWN} listings). Moving to next borough.")
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

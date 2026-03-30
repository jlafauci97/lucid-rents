#!/usr/bin/env python3
"""
Scrape rent and amenity data from zumper.com for NYC, LA, and Chicago metros
using Scrapling.

Uses StealthyFetcher with real_chrome=True to bypass anti-bot protection,
then extracts structured JSON-LD (ApartmentComplex items) from page source.

Usage:
    python3 scripts/scrape-zumper.py                              # NYC (default), all areas, 5 pages each
    python3 scripts/scrape-zumper.py --metro=los-angeles          # LA metro
    python3 scripts/scrape-zumper.py --metro=chicago              # Chicago metro
    python3 scripts/scrape-zumper.py --borough=Manhattan          # single area within metro
    python3 scripts/scrape-zumper.py --metro=chicago --borough=Loop
    python3 scripts/scrape-zumper.py --pages=10                   # more pages per area
    python3 scripts/scrape-zumper.py --dry-run                    # preview without DB writes
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

# ── CONSTANTS ────────────────────────────────────────────────────────────────
METRO_AREA_URLS = {
    "nyc": {
        "Manhattan": "https://www.zumper.com/apartments-for-rent/manhattan-ny",
        "Brooklyn": "https://www.zumper.com/apartments-for-rent/brooklyn-ny",
        "Queens": "https://www.zumper.com/apartments-for-rent/queens-ny",
        "Bronx": "https://www.zumper.com/apartments-for-rent/bronx-ny",
        "Staten Island": "https://www.zumper.com/apartments-for-rent/staten-island-ny",
    },
    "los-angeles": {
        "Downtown LA": "https://www.zumper.com/apartments-for-rent/los-angeles-ca",
        "Hollywood": "https://www.zumper.com/apartments-for-rent/hollywood-los-angeles-ca",
        "West Hollywood": "https://www.zumper.com/apartments-for-rent/west-hollywood-ca",
        "Santa Monica": "https://www.zumper.com/apartments-for-rent/santa-monica-ca",
        "Silver Lake": "https://www.zumper.com/apartments-for-rent/silver-lake-los-angeles-ca",
        "Culver City": "https://www.zumper.com/apartments-for-rent/culver-city-ca",
        "Glendale": "https://www.zumper.com/apartments-for-rent/glendale-ca",
        "Burbank": "https://www.zumper.com/apartments-for-rent/burbank-ca",
        "Pasadena": "https://www.zumper.com/apartments-for-rent/pasadena-ca",
        "Long Beach": "https://www.zumper.com/apartments-for-rent/long-beach-ca",
        "Torrance": "https://www.zumper.com/apartments-for-rent/torrance-ca",
    },
    "chicago": {
        "Loop": "https://www.zumper.com/apartments-for-rent/the-loop-chicago-il",
        "Lincoln Park": "https://www.zumper.com/apartments-for-rent/lincoln-park-chicago-il",
        "Lakeview": "https://www.zumper.com/apartments-for-rent/lakeview-chicago-il",
        "Wicker Park": "https://www.zumper.com/apartments-for-rent/wicker-park-chicago-il",
        "Logan Square": "https://www.zumper.com/apartments-for-rent/logan-square-chicago-il",
        "River North": "https://www.zumper.com/apartments-for-rent/river-north-chicago-il",
        "Gold Coast": "https://www.zumper.com/apartments-for-rent/gold-coast-chicago-il",
        "Hyde Park": "https://www.zumper.com/apartments-for-rent/hyde-park-chicago-il",
        "South Loop": "https://www.zumper.com/apartments-for-rent/south-loop-chicago-il",
        "West Loop": "https://www.zumper.com/apartments-for-rent/west-loop-chicago-il",
        "Uptown": "https://www.zumper.com/apartments-for-rent/uptown-chicago-il",
        "Evanston": "https://www.zumper.com/apartments-for-rent/evanston-il",
    },
    "miami": {
        "Miami": "https://www.zumper.com/apartments-for-rent/miami-fl",
        "Brickell": "https://www.zumper.com/apartments-for-rent/brickell-miami-fl",
        "Miami Beach": "https://www.zumper.com/apartments-for-rent/miami-beach-fl",
        "Coral Gables": "https://www.zumper.com/apartments-for-rent/coral-gables-fl",
        "Doral": "https://www.zumper.com/apartments-for-rent/doral-fl",
        "Coconut Grove": "https://www.zumper.com/apartments-for-rent/coconut-grove-miami-fl",
        "Wynwood": "https://www.zumper.com/apartments-for-rent/wynwood-miami-fl",
        "Aventura": "https://www.zumper.com/apartments-for-rent/aventura-fl",
        "Kendall": "https://www.zumper.com/apartments-for-rent/kendall-miami-fl",
        "Edgewater": "https://www.zumper.com/apartments-for-rent/edgewater-miami-fl",
    },
}

# Backward compatibility
BOROUGH_URLS = METRO_AREA_URLS["nyc"]

METRO_INFO = {
    "nyc": {"city": "New York", "state": "NY"},
    "los-angeles": {"city": "Los Angeles", "state": "CA"},
    "chicago": {"city": "Chicago", "state": "IL"},
    "miami": {"city": "Miami", "state": "FL"},
    "houston": {"city": "Houston", "state": "TX"},
}

MAX_RETRIES = 3
RETRY_DELAY = 5  # seconds between retries
PAGE_DELAY_MIN = 4
PAGE_DELAY_MAX = 8
SOURCE = "zumper"

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
    for sep in [" APT ", " UNIT ", " #", " STE "]:
        if sep in addr:
            addr = addr.split(sep)[0]
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
CITY_TO_AREA = {
    # NYC
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
    # LA
    "los angeles": "Downtown LA",
    "hollywood": "Hollywood",
    "west hollywood": "West Hollywood",
    "santa monica": "Santa Monica",
    "silver lake": "Silver Lake",
    "culver city": "Culver City",
    "glendale": "Glendale",
    "burbank": "Burbank",
    "pasadena": "Pasadena",
    "long beach": "Long Beach",
    "torrance": "Torrance",
    # Chicago
    "chicago": "Loop",
    "the loop": "Loop",
    "lincoln park": "Lincoln Park",
    "lakeview": "Lakeview",
    "wicker park": "Wicker Park",
    "logan square": "Logan Square",
    "river north": "River North",
    "gold coast": "Gold Coast",
    "hyde park": "Hyde Park",
    "south loop": "South Loop",
    "west loop": "West Loop",
    "uptown": "Uptown",
    "evanston": "Evanston",
    # Miami
    "miami": "Brickell",
    "miami beach": "Miami Beach",
    "coral gables": "Coral Gables",
    "doral": "Doral",
    "coconut grove": "Coconut Grove",
    "brickell": "Brickell",
    "wynwood": "Wynwood",
    "aventura": "Aventura",
    "kendall": "Kendall",
    "edgewater": "Edgewater",
}

# Keep old name for backward compat
CITY_TO_BOROUGH = CITY_TO_AREA


GENERIC_CITY_NAMES = {"chicago", "los angeles", "new york", "new york city", "miami"}


def detect_borough(listing: dict, default_area: str = "Manhattan") -> str:
    """Detect area/borough from listing data (works for NYC, LA, Chicago)."""
    # Check locality
    locality = listing.get("locality", "").strip().lower()

    # If the city is a generic metro-level name and we have a specific default
    # from the scrape URL, prefer the default to avoid misattribution.
    if default_area and locality in GENERIC_CITY_NAMES:
        return default_area

    if locality and locality in CITY_TO_AREA:
        return CITY_TO_AREA[locality]

    # Check address
    address = listing.get("address", "").lower()
    for key, area in CITY_TO_AREA.items():
        if key in address:
            return area

    # Fall back to zip code prefix
    zc = listing.get("zip_code", "")
    # NYC
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
    # LA (900xx-961xx)
    if zc.startswith("900") or zc.startswith("901") or zc.startswith("902") \
            or zc.startswith("903") or zc.startswith("904") or zc.startswith("906") \
            or zc.startswith("907") or zc.startswith("908") or zc.startswith("910") \
            or zc.startswith("911") or zc.startswith("912") or zc.startswith("913") \
            or zc.startswith("914") or zc.startswith("915") or zc.startswith("916") \
            or zc.startswith("917") or zc.startswith("918"):
        return "Downtown LA"
    # Chicago (606xx)
    if zc.startswith("606"):
        return "Loop"

    return default_area


def generate_slug(full_address: str) -> str:
    """Generate a URL slug from a full address."""
    return re.sub(r'(^-+|-+$)', '', re.sub(r'[^a-z0-9]+', '-', full_address.lower()))


# ── FETCHING ─────────────────────────────────────────────────────────────────
def fetch_page(url: str):
    """Fetch a Zumper page and return the Scrapling page object."""
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


def extract_listings_from_jsonld(page, default_borough: str) -> list[dict]:
    """Extract listing data from JSON-LD ApartmentComplex items on Zumper pages."""
    listings = []

    # Zumper embeds JSON-LD with @type: ItemList containing ApartmentComplex items
    scripts = page.css('script[type="application/ld+json"]')
    for script in scripts:
        try:
            data = json.loads(script.text)
        except (json.JSONDecodeError, TypeError):
            continue

        items = []
        if isinstance(data, list):
            items = data
        elif isinstance(data, dict):
            if data.get("@type") == "ItemList":
                items = data.get("itemListElement", [])
            elif data.get("@type") == "ApartmentComplex":
                items = [data]
            elif data.get("@type") == "SearchResultsPage":
                main_entity = data.get("mainEntity", {})
                if isinstance(main_entity, dict) and main_entity.get("@type") == "ItemList":
                    items = main_entity.get("itemListElement", [])

        for item in items:
            # Handle ItemList wrapping
            if item.get("@type") == "ListItem":
                item = item.get("item", item)

            if item.get("@type") not in ("ApartmentComplex", "Apartment", "Residence"):
                continue

            listing = parse_jsonld_item(item, default_borough)
            if listing and listing.get("address"):
                listings.append(listing)

    # Fallback: try parsing listing cards from HTML if JSON-LD is empty
    if not listings:
        listings = extract_listings_from_html(page, default_borough)

    return listings


def extract_listings_from_html(page, default_borough: str) -> list[dict]:
    """Fallback: extract listings from HTML card elements."""
    listings = []

    # Try common Zumper card selectors
    cards = page.css('[data-testid*="listing"], [class*="ListingCard"], [class*="listingCard"]')
    if not cards:
        # Try broader selectors
        cards = page.css('a[href*="/apartment-buildings/"], a[href*="/apartments-for-rent/"]')

    for card in cards:
        try:
            listing = parse_html_card(card, default_borough)
            if listing and listing.get("address"):
                listings.append(listing)
        except Exception as e:
            continue

    return listings


def parse_jsonld_item(item: dict, default_borough: str) -> dict | None:
    """Parse a JSON-LD ApartmentComplex item into a listing dict."""
    address_data = item.get("address", {})
    if isinstance(address_data, str):
        street = address_data
        locality = ""
        region = ""
        postal = ""
    else:
        street = address_data.get("streetAddress", "")
        locality = address_data.get("addressLocality", "")
        region = address_data.get("addressRegion", "")
        postal = address_data.get("postalCode", "")

    if not street:
        name = item.get("name", "")
        if name and any(c.isdigit() for c in name[:5]):
            street = name
        else:
            return None

    # Build full address
    address_parts = [street]
    if locality:
        address_parts.append(locality)
    if region:
        address_parts.append(region)
    address_full = ", ".join(address_parts)
    if postal:
        address_full += f" {postal}"

    # Parse beds from numberOfBedrooms
    beds_raw = item.get("numberOfBedrooms")
    beds = None
    bed_min = None
    bed_max = None
    if beds_raw is not None:
        if isinstance(beds_raw, dict):
            bed_min = beds_raw.get("minValue")
            bed_max = beds_raw.get("maxValue")
            if bed_min is not None:
                bed_min = int(bed_min)
            if bed_max is not None:
                bed_max = int(bed_max)
            beds = bed_min
        elif isinstance(beds_raw, (int, float)):
            beds = int(beds_raw)
            bed_min = beds
            bed_max = beds
        elif isinstance(beds_raw, str):
            try:
                beds = int(beds_raw)
                bed_min = beds
                bed_max = beds
            except ValueError:
                if "studio" in beds_raw.lower():
                    beds = 0
                    bed_min = 0
                    bed_max = 0

    # Amenities from amenityFeature
    amenities = []
    for af in item.get("amenityFeature", []):
        if isinstance(af, dict):
            name = af.get("name", "")
        elif isinstance(af, str):
            name = af
        else:
            continue
        if name and len(name) < 60:
            amenities.append(name)

    # Pets
    pets = item.get("petsAllowed")
    if pets:
        if isinstance(pets, str) and pets.lower() not in ("false", "no", "none"):
            amenities.append("Pet Friendly")
        elif isinstance(pets, bool) and pets:
            amenities.append("Pet Friendly")

    # Geo
    geo = item.get("geo", {})
    lat = geo.get("latitude") if isinstance(geo, dict) else None
    lng = geo.get("longitude") if isinstance(geo, dict) else None

    # Listing URL
    listing_url = item.get("url", "")
    if listing_url and not listing_url.startswith("http"):
        listing_url = f"https://www.zumper.com{listing_url}"

    borough = detect_borough({
        "locality": locality,
        "address": address_full,
        "zip_code": postal,
    }, default_borough)

    # Rent data from offers or containsPlace
    rent_by_beds = {}
    offers = item.get("offers") or item.get("containsPlace", [])
    if isinstance(offers, dict):
        offers = [offers]
    if isinstance(offers, list):
        for offer in offers:
            if not isinstance(offer, dict):
                continue
            # Try price from offer
            price_raw = offer.get("price") or offer.get("lowPrice")
            if price_raw:
                try:
                    price_val = int(str(price_raw).replace(",", "").replace("$", "").split(".")[0])
                    if 200 <= price_val <= 100000:
                        offer_beds = offer.get("numberOfBedrooms") or offer.get("numberOfRooms")
                        if offer_beds is not None:
                            try:
                                offer_beds = int(offer_beds)
                            except (ValueError, TypeError):
                                offer_beds = beds
                        else:
                            offer_beds = beds
                        if offer_beds is not None and offer_beds not in rent_by_beds:
                            rent_by_beds[offer_beds] = {
                                "min_rent": price_val,
                                "max_rent": price_val,
                                "sqft_min": None,
                                "sqft_max": None,
                            }
                        elif offer_beds is not None:
                            existing = rent_by_beds[offer_beds]
                            existing["min_rent"] = min(existing["min_rent"], price_val)
                            existing["max_rent"] = max(existing["max_rent"], price_val)
                except (ValueError, TypeError):
                    pass

    # Also try top-level offers
    top_offers = item.get("offers")
    if isinstance(top_offers, dict) and not rent_by_beds:
        low = top_offers.get("lowPrice") or top_offers.get("price")
        high = top_offers.get("highPrice") or low
        if low:
            try:
                low_val = int(str(low).replace(",", "").replace("$", "").split(".")[0])
                high_val = int(str(high).replace(",", "").replace("$", "").split(".")[0]) if high else low_val
                if 200 <= low_val <= 100000:
                    bed_key = beds if beds is not None else 0
                    rent_by_beds[bed_key] = {
                        "min_rent": low_val,
                        "max_rent": high_val,
                        "sqft_min": None,
                        "sqft_max": None,
                    }
            except (ValueError, TypeError):
                pass

    return {
        "address": street,
        "address_full": address_full,
        "zip_code": postal,
        "borough": borough,
        "locality": locality,
        "latitude": lat,
        "longitude": lng,
        "property_type": "apartment",
        "listing_url": listing_url,
        "amenities": amenities,
        "rent_by_beds": rent_by_beds,
        "listing_name": item.get("name") or street,
        "price_min": None,
        "price_max": None,
        "price_text": "",
        "bed_min": bed_min,
        "bed_max": bed_max,
        "bath_min": None,
        "bath_max": None,
        "sqft_min": None,
        "sqft_max": None,
        "bed_text": "",
        "bath_text": "",
        "sqft_text": "",
        "units_available": 0,
        "units_available_text": "",
        "availability_status": "available",
        "management_company": None,
        "verified": False,
        "has_price_drops": False,
        "listing_views": None,
        "updated_at_source": None,
        "floor_plans": [],
        "bed_price_data": [],
        "office_hours": [],
    }


def parse_price(text: str) -> int | None:
    """Extract integer price from text like '$3,500/mo' or '$3,500'."""
    if not text:
        return None
    match = re.search(r'\$?([\d,]+)', text.replace(",", "").replace(" ", ""))
    if not match:
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
    """Extract bed count from text."""
    if not text:
        return None
    lower = text.lower().strip()
    if "studio" in lower:
        return 0
    match = re.search(r'(\d+)\s*(?:bed|br|bd)', lower)
    if match:
        return int(match.group(1))
    match = re.match(r'^(\d+)$', lower.strip())
    if match:
        return int(match.group(1))
    return None


def parse_html_card(card, default_borough: str) -> dict | None:
    """Parse a Zumper HTML listing card into a listing dict."""
    # Extract address from card text
    address = ""
    all_text = card.text.strip() if card.text else ""

    # Try to find address in links
    links = card.css("a")
    for link in links:
        href = link.attrib.get("href", "")
        text = link.text.strip() if link.text else ""
        if text and any(c.isdigit() for c in text[:5]) and not text.startswith("$"):
            address = text
            break

    if not address:
        # Try heading elements
        headings = card.css("h2, h3, h4, [class*='address'], [class*='title']")
        for h in headings:
            text = h.text.strip() if h.text else ""
            if text and any(c.isdigit() for c in text[:5]) and not text.startswith("$"):
                address = text
                break

    if not address:
        return None

    # Price
    price = None
    price_text = ""
    price_match = re.search(r'\$[\d,]+', all_text)
    if price_match:
        price_text = price_match.group(0)
        price = parse_price(price_text)

    # Beds
    beds = parse_beds(all_text)

    # Listing URL
    listing_url = ""
    for link in links:
        href = link.attrib.get("href", "")
        if href and "/apartment-buildings/" in href:
            if not href.startswith("http"):
                listing_url = f"https://www.zumper.com{href}"
            else:
                listing_url = href
            break

    # Zip code
    zip_code = ""
    zip_match = re.search(r'\b(\d{5})\b', address)
    if zip_match:
        zip_code = zip_match.group(1)

    borough = detect_borough({
        "address": address,
        "zip_code": zip_code,
    }, default_borough)

    rent_by_beds = {}
    if price and beds is not None:
        rent_by_beds[beds] = {
            "min_rent": price,
            "max_rent": price,
            "sqft_min": None,
            "sqft_max": None,
        }

    return {
        "address": address,
        "address_full": address,
        "zip_code": zip_code,
        "borough": borough,
        "locality": "",
        "latitude": None,
        "longitude": None,
        "property_type": "apartment",
        "listing_url": listing_url,
        "amenities": [],
        "rent_by_beds": rent_by_beds,
        "listing_name": address,
        "price_min": price,
        "price_max": price,
        "price_text": price_text,
        "bed_min": beds,
        "bed_max": beds,
        "bath_min": None,
        "bath_max": None,
        "sqft_min": None,
        "sqft_max": None,
        "bed_text": "",
        "bath_text": "",
        "sqft_text": "",
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
    }


# ── BUILDING MATCHING ────────────────────────────────────────────────────────
def match_building(listing: dict) -> str | None:
    """Try to match a listing to an existing building by address + zip."""
    addr = listing.get("address", "")
    zip_code = listing.get("zip_code", "")

    if not addr:
        return None

    street = addr.split(",")[0].strip() if "," in addr else addr
    normalized = normalize_address(street)

    try:
        if zip_code:
            result = supabase.table("buildings") \
                .select("id") \
                .eq("zip_code", zip_code) \
                .ilike("full_address", f"%{normalized}%") \
                .limit(1) \
                .execute()

            if result.data and len(result.data) > 0:
                return result.data[0]["id"]

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
    addr = listing.get("address", "")
    if not addr:
        return None

    borough = listing.get("borough", "Manhattan")
    street = addr.split(",")[0].strip() if "," in addr else addr
    parts = street.split(None, 1)
    house_number = parts[0].upper() if parts else ""
    street_name = parts[1].upper() if len(parts) > 1 else ""
    zip_code = listing.get("zip_code", "")

    info = METRO_INFO.get(metro, METRO_INFO["nyc"])
    city = info["city"]
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
        "city": city,
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
    parser = argparse.ArgumentParser(description="Scrape zumper.com for rent & amenity data")
    parser.add_argument("--metro", type=str, default="nyc", choices=["nyc", "los-angeles", "chicago", "miami", "houston"], help="Metro area")
    parser.add_argument("--borough", type=str, default="", help="Single borough/area to scrape")
    parser.add_argument("--pages", type=int, default=5, help="Pages per area")
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

    print(f"Scraping zumper.com — metro={metro}, areas={list(boroughs.keys())}, pages={max_pages}, dry_run={dry_run}")
    print(f"Start time: {datetime.now()}\n")

    for borough, base_url in boroughs.items():
        print(f"\n{'='*60}")
        print(f"BOROUGH: {borough}")
        print(f"{'='*60}")

        for page_num in range(args.start_page, args.start_page + max_pages):
            url = base_url if page_num == 1 else f"{base_url}/{page_num}"
            print(f"\n  Page {page_num}: {url}")

            page = fetch_page(url)
            if page is None:
                print(f"    FAILED to fetch page {page_num} after {MAX_RETRIES} retries. Skipping.")
                continue

            listings = extract_listings_from_jsonld(page, borough)
            print(f"    Got {len(listings)} listings")

            if len(listings) == 0:
                print(f"    No more listings. Moving to next borough.")
                break

            total_listings += len(listings)

            for listing in listings:
                addr = listing["address"]

                if dry_run:
                    print(f"    [DRY RUN] {addr} | beds={listing.get('bed_min')} | amenities={len(listing['amenities'])}")
                    continue

                building_id = match_building(listing)

                if building_id:
                    total_matched += 1
                    label = "MATCHED"
                else:
                    building_id = create_building(listing, metro=metro)
                    if building_id:
                        total_created += 1
                        label = "CREATED"
                    else:
                        total_failed += 1
                        print(f"    SKIP {addr} (could not match or create)")
                        continue

                rents_added = upsert_rents(building_id, listing["rent_by_beds"])
                amenities_added = upsert_amenities(building_id, listing["amenities"], metro)
                listing_saved = upsert_listing(building_id, listing)

                total_rents += rents_added
                total_amenities += amenities_added
                if listing_saved:
                    total_listings_saved += 1

                print(f"    {label} {addr} -> {rents_added} rents, {amenities_added} amenities, listing={'OK' if listing_saved else 'FAIL'}")

            # Polite delay between pages
            delay = random.uniform(PAGE_DELAY_MIN, PAGE_DELAY_MAX)
            print(f"    Waiting {delay:.1f}s...")
            time.sleep(delay)

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

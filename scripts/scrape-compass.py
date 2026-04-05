#!/usr/bin/env python3
"""
Scrape rent data from compass.com for NYC, LA, and Chicago metros using Scrapling.

Uses StealthyFetcher with real_chrome=True to bypass anti-bot protection,
then extracts structured JSON from the embedded window.uc.sharedReactAppProps
payload containing listing data.

Usage:
    python3 scripts/scrape-compass.py                              # NYC (default), all boroughs, 5 pages each
    python3 scripts/scrape-compass.py --metro=los-angeles          # LA metro areas
    python3 scripts/scrape-compass.py --metro=chicago              # Chicago metro areas
    python3 scripts/scrape-compass.py --borough=Manhattan          # single area within metro
    python3 scripts/scrape-compass.py --metro=los-angeles --borough="Santa Monica"
    python3 scripts/scrape-compass.py --pages=10                   # more pages per area
    python3 scripts/scrape-compass.py --dry-run                    # preview without DB writes
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
        "Manhattan": "https://www.compass.com/homes-for-rent/manhattan-ny/",
        "Brooklyn": "https://www.compass.com/homes-for-rent/brooklyn-ny/",
        "Queens": "https://www.compass.com/homes-for-rent/queens-ny/",
        "Bronx": "https://www.compass.com/homes-for-rent/bronx-ny/",
        "Staten Island": "https://www.compass.com/homes-for-rent/staten-island-ny/",
    },
    "los-angeles": {
        "Los Angeles": "https://www.compass.com/homes-for-rent/los-angeles-ca/",
        "West Hollywood": "https://www.compass.com/homes-for-rent/west-hollywood-ca/",
        "Santa Monica": "https://www.compass.com/homes-for-rent/santa-monica-ca/",
        "Culver City": "https://www.compass.com/homes-for-rent/culver-city-ca/",
        "Glendale": "https://www.compass.com/homes-for-rent/glendale-ca/",
        "Burbank": "https://www.compass.com/homes-for-rent/burbank-ca/",
        "Pasadena": "https://www.compass.com/homes-for-rent/pasadena-ca/",
        "Long Beach": "https://www.compass.com/homes-for-rent/long-beach-ca/",
    },
    "chicago": {
        "Chicago": "https://www.compass.com/homes-for-rent/chicago-il/",
        "Lincoln Park": "https://www.compass.com/homes-for-rent/lincoln-park-chicago-il/",
        "Lakeview": "https://www.compass.com/homes-for-rent/lakeview-chicago-il/",
        "Wicker Park": "https://www.compass.com/homes-for-rent/wicker-park-chicago-il/",
        "Logan Square": "https://www.compass.com/homes-for-rent/logan-square-chicago-il/",
        "River North": "https://www.compass.com/homes-for-rent/river-north-chicago-il/",
        "Gold Coast": "https://www.compass.com/homes-for-rent/gold-coast-chicago-il/",
        "Evanston": "https://www.compass.com/homes-for-rent/evanston-il/",
        "Oak Park": "https://www.compass.com/homes-for-rent/oak-park-il/",
    },
    "miami": {
        "Miami": "https://www.compass.com/homes-for-rent/miami-fl/",
        "Brickell": "https://www.compass.com/homes-for-rent/brickell-miami-fl/",
        "Miami Beach": "https://www.compass.com/homes-for-rent/miami-beach-fl/",
        "Coral Gables": "https://www.compass.com/homes-for-rent/coral-gables-fl/",
        "Coconut Grove": "https://www.compass.com/homes-for-rent/coconut-grove-miami-fl/",
        "Wynwood": "https://www.compass.com/homes-for-rent/wynwood-miami-fl/",
        "Doral": "https://www.compass.com/homes-for-rent/doral-fl/",
        "Aventura": "https://www.compass.com/homes-for-rent/aventura-fl/",
    },
    "houston": {
        "Houston": "https://www.compass.com/homes-for-rent/houston-tx/",
        "Midtown": "https://www.compass.com/homes-for-rent/midtown-houston-tx/",
        "Montrose": "https://www.compass.com/homes-for-rent/montrose-houston-tx/",
        "Heights": "https://www.compass.com/homes-for-rent/the-heights-houston-tx/",
        "Galleria": "https://www.compass.com/homes-for-rent/galleria-houston-tx/",
        "Medical Center": "https://www.compass.com/homes-for-rent/medical-center-houston-tx/",
        "Rice Village": "https://www.compass.com/homes-for-rent/rice-village-houston-tx/",
        "Downtown": "https://www.compass.com/homes-for-rent/downtown-houston-tx/",
        "Memorial": "https://www.compass.com/homes-for-rent/memorial-houston-tx/",
        "Katy": "https://www.compass.com/homes-for-rent/katy-tx/",
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
RETRY_DELAY = 5
PAGE_DELAY_MIN = 5
PAGE_DELAY_MAX = 10
SOURCE = "compass"

# ── AMENITY CATEGORIZATION ───────────────────────────────────────────────────
AMENITY_CATEGORIES = {
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
    "roof deck": "outdoor", "rooftop": "outdoor", "terrace": "outdoor",
    "balcony": "outdoor", "patio": "outdoor", "garden": "outdoor",
    "courtyard": "outdoor", "backyard": "outdoor", "outdoor space": "outdoor",
    "bbq": "outdoor", "grill": "outdoor", "sun deck": "outdoor", "pool": "outdoor",
    "swimming pool": "outdoor",
    "gym": "fitness", "fitness center": "fitness", "fitness room": "fitness",
    "yoga studio": "fitness", "yoga room": "fitness", "sauna": "fitness",
    "spa": "fitness", "steam room": "fitness", "basketball court": "fitness",
    "tennis court": "fitness", "rock climbing": "fitness",
    "parking": "parking", "garage": "parking", "bike room": "parking",
    "bike storage": "parking", "bicycle storage": "parking",
    "valet parking": "parking", "ev charging": "parking",
    "laundry in unit": "laundry", "washer/dryer": "laundry",
    "in-unit laundry": "laundry", "laundry room": "laundry",
    "laundry in building": "laundry", "washer dryer": "laundry",
    "washer and dryer": "laundry",
    "security": "security", "video intercom": "security",
    "surveillance": "security", "key fob": "security", "cctv": "security",
    "security camera": "security", "24-hour security": "security",
    "pet friendly": "pet", "pets allowed": "pet", "dog friendly": "pet",
    "cat friendly": "pet", "pet spa": "pet", "dog run": "pet",
    "dog grooming": "pet", "pet grooming": "pet",
    "storage": "storage", "storage room": "storage", "private storage": "storage",
    "wine storage": "storage", "cellar": "storage",
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


CITY_TO_BOROUGH = {
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
    # Los Angeles
    "los angeles": "Los Angeles",
    "west hollywood": "West Hollywood",
    "santa monica": "Santa Monica",
    "culver city": "Culver City",
    "glendale": "Glendale",
    "burbank": "Burbank",
    "pasadena": "Pasadena",
    "long beach": "Long Beach",
    "beverly hills": "Los Angeles",
    "silver lake": "Los Angeles",
    "echo park": "Los Angeles",
    "koreatown": "Los Angeles",
    "hollywood": "Los Angeles",
    # Chicago
    "chicago": "Chicago",
    "lincoln park": "Lincoln Park",
    "lakeview": "Lakeview",
    "wicker park": "Wicker Park",
    "logan square": "Logan Square",
    "river north": "River North",
    "gold coast": "Gold Coast",
    "evanston": "Evanston",
    "oak park": "Oak Park",
    "bucktown": "Wicker Park",
    "old town": "Lincoln Park",
    "streeterville": "River North",
    "loop": "Chicago",
    "south loop": "Chicago",
    "west loop": "Chicago",
    # Miami
    "miami": "Miami",
    "miami beach": "Miami Beach",
    "coral gables": "Coral Gables",
    "doral": "Doral",
    "aventura": "Aventura",
    "coconut grove": "Coconut Grove",
    "brickell": "Brickell",
    "wynwood": "Wynwood",
}


def detect_borough(listing: dict, default_area: str = "Manhattan") -> str:
    address = listing.get("address", "").lower()
    for key, boro in CITY_TO_BOROUGH.items():
        if key in address:
            return boro

    zc = listing.get("zip_code", "")
    # NYC zip codes
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
    # LA zip codes (900xx-961xx)
    if zc.startswith("900") or zc.startswith("901") or zc.startswith("902") or zc.startswith("906") or zc.startswith("910") or zc.startswith("911") or zc.startswith("912") or zc.startswith("913") or zc.startswith("914") or zc.startswith("915") or zc.startswith("916") or zc.startswith("917") or zc.startswith("918"):
        return "Los Angeles"
    # Chicago zip codes (606xx-608xx)
    if zc.startswith("606") or zc.startswith("607") or zc.startswith("608"):
        return "Chicago"

    return default_area


def generate_slug(full_address: str) -> str:
    return re.sub(r'(^-+|-+$)', '', re.sub(r'[^a-z0-9]+', '-', full_address.lower()))


def parse_price(text: str) -> int | None:
    if not text:
        return None
    cleaned = re.sub(r'[^\d]', '', str(text))
    if not cleaned:
        return None
    val = int(cleaned)
    if 200 <= val <= 100000:
        return val
    return None


# ── FETCHING ─────────────────────────────────────────────────────────────────
def fetch_page(url: str):
    """Fetch a Compass page and return the Scrapling page object."""
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


def extract_listings_from_embedded_json(page, default_borough: str) -> list[dict]:
    """Extract listings from Compass's embedded window.uc JSON data."""
    listings = []

    # Compass embeds listing data in window.uc.sharedReactAppProps.initialResults
    scripts = page.css("script")
    embedded_data = None

    for script in scripts:
        text = script.text or ""
        if "sharedReactAppProps" in text or "initialResults" in text or "lolResults" in text:
            # Try to extract the JSON object
            # Pattern: window.uc = {...} or window.uc.sharedReactAppProps = {...}
            for pattern in [
                r'window\.uc\s*=\s*(\{.*?\});?\s*(?:</script>|$)',
                r'sharedReactAppProps\s*[=:]\s*(\{.*?\});?\s*(?:</script>|$)',
                r'initialResults\s*[=:]\s*(\{.*?\});?\s*(?:</script>|$)',
            ]:
                match = re.search(pattern, text, re.DOTALL)
                if match:
                    try:
                        embedded_data = json.loads(match.group(1))
                        break
                    except json.JSONDecodeError:
                        continue
            if embedded_data:
                break

    if embedded_data:
        # Navigate to listing data
        results = None
        # Try various paths where Compass stores listing data
        try:
            results = embedded_data.get("sharedReactAppProps", {}).get("initialResults", {}).get("lolResults", {}).get("data", [])
        except (AttributeError, TypeError):
            pass
        if not results:
            try:
                results = embedded_data.get("initialResults", {}).get("lolResults", {}).get("data", [])
            except (AttributeError, TypeError):
                pass
        if not results:
            try:
                results = embedded_data.get("lolResults", {}).get("data", [])
            except (AttributeError, TypeError):
                pass

        if results and isinstance(results, list):
            for item in results:
                listing_data = item.get("listing", item)
                listing = parse_compass_listing(listing_data, default_borough)
                if listing and listing.get("address"):
                    listings.append(listing)

    # Fallback: try JSON-LD
    if not listings:
        scripts = page.css('script[type="application/ld+json"]')
        for script in scripts:
            try:
                data = json.loads(script.text)
            except (json.JSONDecodeError, TypeError):
                continue

            if isinstance(data, list):
                for item in data:
                    if item.get("@type") in ("Apartment", "Residence", "RealEstateListing"):
                        listing = parse_jsonld_listing(item, default_borough)
                        if listing and listing.get("address"):
                            listings.append(listing)
            elif isinstance(data, dict) and data.get("@type") == "ItemList":
                for item in data.get("itemListElement", []):
                    actual = item.get("item", item)
                    listing = parse_jsonld_listing(actual, default_borough)
                    if listing and listing.get("address"):
                        listings.append(listing)

    # Fallback: HTML parsing
    if not listings:
        listings = extract_listings_from_html(page, default_borough)

    return listings


def parse_compass_listing(item: dict, default_borough: str) -> dict | None:
    """Parse a Compass listing from embedded JSON data."""
    # Address from subtitles or address fields
    address = ""
    subtitles = item.get("subtitles", [])
    if subtitles and isinstance(subtitles, list):
        address = subtitles[0] if subtitles else ""

    if not address:
        address = item.get("address", "") or item.get("streetAddress", "")

    if not address:
        return None

    # Price
    price = None
    price_text = item.get("title", "") or ""
    if price_text and "$" in str(price_text):
        price = parse_price(price_text)
    if not price:
        price = parse_price(str(item.get("price", "")))

    # Beds / Baths / Sqft from subStats
    beds = None
    baths = None
    sqft = None
    sub_stats = item.get("subStats", [])
    if isinstance(sub_stats, list):
        for stat in sub_stats:
            val = stat.get("value") or stat.get("displayValue") or ""
            label = (stat.get("label") or stat.get("displayLabel") or "").lower()
            val_str = str(val)

            if "bed" in label or "br" in label:
                if "studio" in val_str.lower():
                    beds = 0
                else:
                    try:
                        beds = int(re.sub(r'[^\d]', '', val_str))
                    except (ValueError, TypeError):
                        pass
            elif "bath" in label or "ba" in label:
                try:
                    baths = float(re.sub(r'[^\d.]', '', val_str))
                except (ValueError, TypeError):
                    pass
            elif "sq" in label or "ft" in label or "sf" in label:
                try:
                    sqft = int(re.sub(r'[^\d]', '', val_str.replace(",", "")))
                except (ValueError, TypeError):
                    pass

    # Listing URL
    listing_url = item.get("navigationPageLink", "") or item.get("url", "") or item.get("detailUrl", "")
    if listing_url and not listing_url.startswith("http"):
        listing_url = f"https://www.compass.com{listing_url}"

    # Zip code from address
    zip_code = ""
    zip_match = re.search(r'\b(\d{5})\b', address)
    if zip_match:
        zip_code = zip_match.group(1)

    # Clean address
    clean_address = address
    if zip_code:
        clean_address = address.replace(zip_code, "").strip().rstrip(",").strip()

    borough = detect_borough({
        "address": address,
        "zip_code": zip_code,
    }, default_borough)

    # Rent data
    rent_by_beds = {}
    if price and beds is not None:
        rent_by_beds[beds] = {
            "min_rent": price,
            "max_rent": price,
            "sqft_min": sqft,
            "sqft_max": sqft,
        }

    return {
        "address": clean_address,
        "address_full": address,
        "zip_code": zip_code,
        "borough": borough,
        "latitude": None,
        "longitude": None,
        "property_type": "apartment",
        "listing_url": listing_url,
        "amenities": [],
        "rent_by_beds": rent_by_beds,
        "listing_name": clean_address,
        "price_min": price,
        "price_max": price,
        "price_text": price_text if "$" in str(price_text) else "",
        "bed_min": beds,
        "bed_max": beds,
        "bath_min": int(baths) if baths is not None else None,
        "bath_max": int(baths) if baths is not None else None,
        "sqft_min": sqft,
        "sqft_max": sqft,
        "bed_text": f"{'Studio' if beds == 0 else f'{beds} bed'}" if beds is not None else "",
        "bath_text": f"{baths} bath" if baths else "",
        "sqft_text": f"{sqft:,} sqft" if sqft else "",
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


def parse_jsonld_listing(item: dict, default_borough: str) -> dict | None:
    """Parse a JSON-LD listing item."""
    address_data = item.get("address", {})
    if isinstance(address_data, str):
        street = address_data
        postal = ""
    else:
        street = address_data.get("streetAddress", "")
        postal = address_data.get("postalCode", "")

    if not street:
        return None

    price = None
    offers = item.get("offers", {})
    if isinstance(offers, dict):
        price = parse_price(str(offers.get("price", "")))

    beds = item.get("numberOfBedrooms")
    if beds is not None:
        try:
            beds = int(beds)
        except (ValueError, TypeError):
            beds = None

    baths = item.get("numberOfBathroomsTotal")
    if baths is not None:
        try:
            baths = int(float(baths))
        except (ValueError, TypeError):
            baths = None

    borough = detect_borough({
        "address": street,
        "zip_code": postal,
    }, default_borough)

    rent_by_beds = {}
    if price and beds is not None:
        rent_by_beds[beds] = {
            "min_rent": price,
            "max_rent": price,
            "sqft_min": None,
            "sqft_max": None,
        }

    listing_url = item.get("url", "")
    if listing_url and not listing_url.startswith("http"):
        listing_url = f"https://www.compass.com{listing_url}"

    return {
        "address": street,
        "address_full": f"{street}, {postal}" if postal else street,
        "zip_code": postal,
        "borough": borough,
        "latitude": None,
        "longitude": None,
        "property_type": "apartment",
        "listing_url": listing_url,
        "amenities": [],
        "rent_by_beds": rent_by_beds,
        "listing_name": street,
        "price_min": price,
        "price_max": price,
        "price_text": f"${price:,}" if price else "",
        "bed_min": beds,
        "bed_max": beds,
        "bath_min": baths,
        "bath_max": baths,
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


def extract_listings_from_html(page, default_borough: str) -> list[dict]:
    """Fallback: extract listings from Compass HTML cards."""
    listings = []

    # Compass uses cx-react-listingCard classes
    cards = page.css('[class*="listingCard"], [class*="ListingCard"], [data-tn*="listing"]')

    for card in cards:
        try:
            listing = parse_html_card(card, default_borough)
            if listing and listing.get("address"):
                listings.append(listing)
        except Exception:
            continue

    return listings


def parse_html_card(card, default_borough: str) -> dict | None:
    """Parse a Compass HTML listing card."""
    all_text = card.text.strip() if card.text else ""
    address = ""

    # Look for address-like text
    addr_els = card.css('[class*="subtitle"], [class*="address"], [class*="Address"]')
    for el in addr_els:
        text = el.text.strip() if el.text else ""
        if text and any(c.isdigit() for c in text[:5]) and not text.startswith("$"):
            address = text
            break

    if not address:
        links = card.css("a")
        for link in links:
            text = link.text.strip() if link.text else ""
            if text and any(c.isdigit() for c in text[:5]) and not text.startswith("$"):
                address = text
                break

    if not address:
        return None

    # Price
    price = None
    price_text = ""
    price_els = card.css('[class*="price"], [class*="Price"], [class*="title"]')
    for el in price_els:
        text = el.text.strip() if el.text else ""
        if text and "$" in text:
            price_text = text
            price = parse_price(price_text)
            break

    if price is None:
        price_match = re.search(r'\$[\d,]+', all_text)
        if price_match:
            price_text = price_match.group(0)
            price = parse_price(price_text)

    # Beds from card text
    beds = None
    if "studio" in all_text.lower():
        beds = 0
    else:
        beds_match = re.search(r'(\d+)\s*(?:bed|br|bd)', all_text, re.IGNORECASE)
        if beds_match:
            beds = int(beds_match.group(1))

    # Listing URL
    listing_url = ""
    links = card.css("a")
    for link in links:
        href = link.attrib.get("href", "")
        if href and ("/listing/" in href or "/homes-for-rent/" in href):
            if not href.startswith("http"):
                listing_url = f"https://www.compass.com{href}"
            else:
                listing_url = href
            break

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
def extract_unit_number(listing: dict) -> str | None:
    """Extract unit/apartment number from a Compass listing."""
    # Check explicit fields from embedded JSON
    for key in ("unit", "unitNumber", "aptNumber", "apartmentNumber"):
        val = listing.get(key)
        if val:
            return str(val).strip()
    # Try parsing from address or listing name
    for field in ("address", "address_full", "listing_name"):
        text = listing.get(field, "")
        if not text:
            continue
        m = re.search(r'(?:Unit|Apt|Apartment|Suite|Ste|#)\s*([A-Za-z0-9-]+)', text, re.IGNORECASE)
        if m:
            return m.group(1).strip()
    return None


def match_building(listing: dict, metro: str = "nyc") -> str | None:
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
                .eq("metro", metro) \
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
                    .eq("metro", metro) \
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
                .eq("metro", metro) \
                .ilike("full_address", f"%{normalized}%") \
                .limit(1) \
                .execute()

            if result.data and len(result.data) > 0:
                return result.data[0]["id"]

    except Exception as e:
        print(f"    DB match error (will create new): {e}")

    return None


# ── DATABASE WRITES ──────────────────────────────────────────────────────────
def upsert_rents(building_id: str, rent_by_beds: dict, unit_number: str | None = None) -> int:
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
        history_row = {
            "building_id": building_id,
            "source": SOURCE,
            "unit_number": unit_number or "",
            "bedrooms": beds,
            "rent": median,
            "sqft": data.get("sqft_min"),
            "observed_at": now,
        }
        history_rows.append(history_row)

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
    parser = argparse.ArgumentParser(description="Scrape compass.com for rent data")
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

    print(f"Scraping compass.com — metro={metro}, areas={list(boroughs.keys())}, pages={max_pages}, dry_run={dry_run}")
    print(f"Start time: {datetime.now()}\n")

    for borough, base_url in boroughs.items():
        print(f"\n{'='*60}")
        print(f"BOROUGH: {borough}")
        print(f"{'='*60}")

        for page_num in range(args.start_page, args.start_page + max_pages):
            # Compass uses ?page=N for pagination
            url = base_url if page_num == 1 else f"{base_url}?page={page_num}"
            print(f"\n  Page {page_num}: {url}")

            page = fetch_page(url)
            if page is None:
                print(f"    FAILED to fetch page {page_num} after {MAX_RETRIES} retries. Skipping.")
                continue

            listings = extract_listings_from_embedded_json(page, borough)
            print(f"    Got {len(listings)} listings")

            if len(listings) == 0:
                print(f"    No more listings. Moving to next borough.")
                break

            total_listings += len(listings)

            for listing in listings:
                addr = listing["address"]

                if dry_run:
                    beds = listing.get("bed_min")
                    price = listing.get("price_min")
                    beds_display = "Studio" if beds == 0 else f"{beds}BR" if beds is not None else "?"
                    price_display = f"${price:,}" if price else "?"
                    print(f"    [DRY RUN] {addr} | {beds_display} | {price_display}")
                    continue

                building_id = match_building(listing, metro=metro)

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

                unit_number = extract_unit_number(listing)
                rents_added = upsert_rents(building_id, listing["rent_by_beds"], unit_number=unit_number)
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

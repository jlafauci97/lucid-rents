#!/usr/bin/env python3
"""
Backfill per-unit historical rent data and structured amenities from StreetEasy
building detail pages.

For each building already in our DB with a StreetEasy listing URL, this script:
  1. Extracts the building slug from the listing URL
  2. Fetches the StreetEasy building detail page
  3. Parses the RSC (React Server Component) payload for:
     - rentalSummary: historical rent ranges per bedroom type
     - availableListingDigests: current per-unit listings with unit #, price, beds/baths
     - amenities/policies/unitFeatures: structured amenity data
  4. Upserts into unit_rent_history, building_amenities, building_rents

Usage:
    python3 scripts/backfill-streeteasy-history.py                  # all buildings
    python3 scripts/backfill-streeteasy-history.py --limit=50       # first 50
    python3 scripts/backfill-streeteasy-history.py --dry-run        # preview
    python3 scripts/backfill-streeteasy-history.py --offset=100     # skip first 100
"""

import json
import os
import re
import sys
import time
import argparse
import threading
from pathlib import Path
from datetime import datetime, timezone, date
from concurrent.futures import ThreadPoolExecutor, as_completed

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

from scrapling import StealthyFetcher
from supabase import create_client

supabase = create_client(SUPABASE_URL, SERVICE_KEY)

# ── CONSTANTS ────────────────────────────────────────────────────────────────
SOURCE = "streeteasy"
MAX_RETRIES = 3
RETRY_DELAY = 5
PAGE_DELAY = 4  # seconds between building fetches
XLS_DELAY = 2   # seconds between XLS downloads

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
    "smoke free": "building", "no smoking": "building", "smoke-free": "building",
    "air conditioning": "building", "a/c": "building", "central air": "building",
    "dishwasher": "building", "microwave": "building", "stainless steel": "building",
    "hardwood": "building", "hardwood flooring": "building",
    "high ceilings": "building", "walk-in closet": "building",
    "controlled access": "building", "gated": "building",
    "valet service": "building", "valet": "building",
    # Outdoor
    "roof deck": "outdoor", "rooftop": "outdoor", "terrace": "outdoor",
    "balcony": "outdoor", "patio": "outdoor", "garden": "outdoor",
    "courtyard": "outdoor", "backyard": "outdoor", "outdoor space": "outdoor",
    "bbq": "outdoor", "grill": "outdoor", "sun deck": "outdoor", "pool": "outdoor",
    "swimming pool": "outdoor", "deck": "outdoor",
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
    # Policy (from StreetEasy policies section)
    "guarantors accepted": "policy", "pets allowed": "pet",
}


def categorize_amenity(text: str) -> str:
    lower = text.lower().strip()
    for keyword, category in AMENITY_CATEGORIES.items():
        if keyword in lower:
            return category
    return "other"


def normalize_amenity(text: str) -> str:
    return " ".join(w.capitalize() for w in text.strip().split())


# ── URL HELPERS ──────────────────────────────────────────────────────────────
def extract_building_slug(listing_url: str) -> str | None:
    """Extract building slug from a StreetEasy listing URL.
    e.g., https://streeteasy.com/building/the-max/327 -> the-max
    """
    match = re.search(r'/building/([^/\?]+)', listing_url)
    if match:
        return match.group(1)
    return None


def building_page_url(slug: str) -> str:
    return f"https://streeteasy.com/building/{slug}"


def address_to_se_slug(house_number: str, street_name: str, borough: str) -> str:
    """Generate a StreetEasy building URL slug from address components.

    StreetEasy conventions:
    - Hyphens in house numbers become underscores (22-10 -> 22_10)
    - Spaces become dashes
    - Manhattan -> new_york, Staten Island -> staten_island
    - All lowercase
    """
    hn = house_number.lower().replace("-", "_").strip()
    sn = re.sub(r'[^a-z0-9]+', '-', street_name.lower()).strip('-')
    boro_map = {
        "Manhattan": "new_york",
        "Brooklyn": "brooklyn",
        "Queens": "queens",
        "Bronx": "bronx",
        "Staten Island": "staten_island",
    }
    boro = boro_map.get(borough, borough.lower().replace(" ", "_"))
    return f"{hn}-{sn}-{boro}"


# ── FETCHING ─────────────────────────────────────────────────────────────────
def fetch_page(url: str):
    """Fetch a StreetEasy page with retries.

    Returns the page object on success, None on failure.
    Returns a page with status 404 immediately (no retries) so caller can skip.
    """
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
            if page.status == 404:
                return page  # Return 404 immediately, no retries
            if page.status != 200:
                print(f"    Attempt {attempt + 1}: HTTP {page.status}")
                time.sleep(RETRY_DELAY * (attempt + 1))
                continue
            return page
        except Exception as e:
            print(f"    Attempt {attempt + 1}: Error - {e}")
            time.sleep(RETRY_DELAY * (attempt + 1))
    return None


# ── RSC PAYLOAD PARSING ─────────────────────────────────────────────────────
def extract_rsc_data(page) -> dict:
    """Extract structured data from the RSC payload scripts on a building page."""
    data = {
        "rental_summary": None,
        "available_listings": [],
        "amenities": {},
        "policies": [],
        "unit_features": [],
        "building_info": {},
        "building_name": None,
    }

    # Extract building name from <h1> tag
    h1_els = page.css("h1")
    if h1_els and len(h1_els) > 0:
        name = h1_els[0].text.strip()
        # Only use if it's a real name (not just an address)
        # Building names are things like "The Max", "The Danby", "Chelsea29"
        # Skip if it starts with a number (likely just an address)
        if name and not re.match(r'^\d', name):
            data["building_name"] = name

    # Get all script tags
    scripts = page.css("script")
    if not scripts:
        return data

    # Find the largest script with rental data — that's the main RSC payload
    best_script = None
    best_len = 0
    gtm_script = None

    for script in scripts:
        text = script.text or ""
        if not text or len(text) < 100:
            continue

        # GTM dataLayer with building metadata
        if ("buildUnits" in text or "buildStories" in text) and not gtm_script:
            gtm_script = text

        # The main RSC payload is the largest script containing rental data
        # RSC uses double-escaped quotes (\") — check both escaped and unescaped
        if "rentalSummary" in text:
            if len(text) > best_len:
                best_script = text
                best_len = len(text)

    if gtm_script:
        data["building_info"] = parse_building_info(gtm_script)

    if best_script:
        # RSC payloads use escaped quotes — unescape for JSON parsing
        # Replace \\" with " to get valid JSON fragments
        unescaped = best_script.replace('\\"', '"')

        data["rental_summary"] = parse_rental_summary(unescaped)
        data["available_listings"] = parse_available_listings(unescaped)
        data["amenities"] = parse_amenities_from_rsc(unescaped)
        data["policies"] = parse_policies_from_rsc(unescaped)
        data["unit_features"] = parse_unit_features_from_rsc(unescaped)

    return data


def parse_rental_summary(text: str) -> list | None:
    """Parse rentalSummary from RSC payload.

    Actual format is an array:
    "rentalSummary":[{"availableCount":3,"availableMaxPrice":3985,
     "availableMinPrice":3725,"bedroomTitle":"Studio",
     "unavailableCount":121,"unavailableMaxPrice":4260,"unavailableMinPrice":3435}, ...]
    """
    try:
        start = text.index('"rentalSummary"')
        # Find opening bracket [ or brace {
        for i in range(start + 15, min(start + 50, len(text))):
            if text[i] in ('[', '{'):
                opener = text[i]
                closer = ']' if opener == '[' else '}'
                depth = 0
                for j in range(i, min(i + 10000, len(text))):
                    if text[j] == opener:
                        depth += 1
                    elif text[j] == closer:
                        depth -= 1
                        if depth == 0:
                            json_str = text[i:j + 1]
                            result = json.loads(json_str)
                            # If it's a dict, convert to list format
                            if isinstance(result, dict):
                                return [result]
                            return result
                break
    except (ValueError, json.JSONDecodeError):
        pass
    return None


def parse_available_listings(text: str) -> list:
    """Parse availableListingDigests from RSC payload."""
    listings = []
    try:
        start = text.index('"availableListingDigests"')
        arr_start = text.index('[', start)
        depth = 0
        for i in range(arr_start, min(arr_start + 50000, len(text))):
            if text[i] == '[':
                depth += 1
            elif text[i] == ']':
                depth -= 1
                if depth == 0:
                    json_str = text[arr_start:i + 1]
                    listings = json.loads(json_str)
                    break
    except (ValueError, json.JSONDecodeError) as e:
        pass
    return listings


def parse_amenities_from_rsc(text: str) -> dict:
    """Parse amenities from RSC payload.

    Actual format: "amenities":{"list":["BIKE_ROOM","CONCIERGE","DOORMAN",...],
                    "fireplaceTypes":[...],"privateOutdoorSpaceTypes":[...],"views":[...]}
    The enum strings need to be converted to human-readable names.
    """
    try:
        for match in re.finditer(r'"amenities"\s*:\s*\{', text):
            start = match.end() - 1
            depth = 0
            for i in range(start, min(start + 5000, len(text))):
                if text[i] == '{':
                    depth += 1
                elif text[i] == '}':
                    depth -= 1
                    if depth == 0:
                        json_str = text[start:i + 1]
                        try:
                            result = json.loads(json_str)
                            if isinstance(result, dict) and "list" in result:
                                return result
                        except json.JSONDecodeError:
                            pass
                        break
    except Exception:
        pass
    return {}


def parse_policies_from_rsc(text: str) -> list:
    """Parse policies list from RSC payload."""
    try:
        for match in re.finditer(r'"policies"\s*:\s*\[', text):
            start = match.end() - 1
            depth = 0
            for i in range(start, min(start + 2000, len(text))):
                if text[i] == '[':
                    depth += 1
                elif text[i] == ']':
                    depth -= 1
                    if depth == 0:
                        json_str = text[start:i + 1]
                        try:
                            result = json.loads(json_str)
                            if isinstance(result, list) and all(isinstance(x, str) for x in result):
                                return result
                        except json.JSONDecodeError:
                            pass
                        break
    except Exception:
        pass
    return []


def parse_unit_features_from_rsc(text: str) -> list:
    """Parse unitFeatures list from RSC payload."""
    try:
        for match in re.finditer(r'"unitFeatures"\s*:\s*\[', text):
            start = match.end() - 1
            depth = 0
            for i in range(start, min(start + 2000, len(text))):
                if text[i] == '[':
                    depth += 1
                elif text[i] == ']':
                    depth -= 1
                    if depth == 0:
                        json_str = text[start:i + 1]
                        try:
                            result = json.loads(json_str)
                            # unitFeatures can be strings or objects
                            if isinstance(result, list):
                                return result
                        except json.JSONDecodeError:
                            pass
                        break
    except Exception:
        pass
    return []


def parse_building_info(text: str) -> dict:
    """Parse building info from GTM dataLayer script."""
    info = {}
    patterns = {
        "units": r'"buildUnits"\s*:\s*(\d+)',
        "stories": r'"buildStories"\s*:\s*(\d+)',
        "year_built": r'"buildYear"\s*:\s*(\d+)',
        "developer": r'"buildDeveloper"\s*:\s*"([^"]*)"',
        "manager": r'"buildManager"\s*:\s*"([^"]*)"',
        "neighborhood": r'"buildNabe"\s*:\s*"([^"]*)"',
        "zip_code": r'"buildZip"\s*:\s*"([^"]*)"',
        "streeteasy_id": r'"buildID"\s*:\s*"([^"]*)"',
        "active_rentals": r'"buildActiveRentalList"\s*:\s*(\d+)',
        "high_rental": r'"buildHighRental"\s*:\s*(\d+)',
    }
    for key, pattern in patterns.items():
        match = re.search(pattern, text)
        if match:
            val = match.group(1)
            if key in ("units", "stories", "year_built", "active_rentals", "high_rental"):
                try:
                    info[key] = int(val)
                except ValueError:
                    info[key] = val
            else:
                info[key] = val
    return info


# ── DATA PROCESSING ──────────────────────────────────────────────────────────
BEDROOM_TITLE_MAP = {
    "Studio": 0,
    "1 Bedroom": 1,
    "2 Bedrooms": 2,
    "3 Bedrooms": 3,
    "4+ Bedrooms": 4,
}


def process_rental_summary(building_id: str, rental_summary: list | dict | None, dry_run: bool = False) -> dict:
    """Process rentalSummary into building_rents and unit_rent_history records.

    rental_summary is an array like:
    [{"availableCount":3,"availableMaxPrice":3985,"availableMinPrice":3725,
      "bedroomTitle":"Studio","unavailableCount":121,...}, ...]

    Returns counts of records processed.
    """
    if not rental_summary:
        return {"rents": 0, "history": 0}

    # Normalize to list
    if isinstance(rental_summary, dict):
        rental_summary = [rental_summary]

    now = datetime.now(timezone.utc).isoformat()
    today = date.today().isoformat()
    rent_rows = []
    history_rows = []

    for bed_data in rental_summary:
        if not isinstance(bed_data, dict):
            continue

        # Map bedroom title to number
        title = bed_data.get("bedroomTitle", "")
        beds = BEDROOM_TITLE_MAP.get(title)
        if beds is None:
            # Try to parse from title
            if "studio" in title.lower():
                beds = 0
            else:
                m = re.search(r'(\d+)', title)
                beds = int(m.group(1)) if m else None
        if beds is None:
            continue

        # Current available rent range
        avail_min = bed_data.get("availableMinPrice")
        avail_max = bed_data.get("availableMaxPrice")
        avail_count = bed_data.get("availableCount", 0)

        # Historical unavailable/closed rent range
        unavail_min = bed_data.get("unavailableMinPrice")
        unavail_max = bed_data.get("unavailableMaxPrice")
        unavail_count = bed_data.get("unavailableCount", 0)

        # Use available data for current rents, fall back to historical
        min_rent = avail_min or unavail_min
        max_rent = avail_max or unavail_max

        if min_rent and max_rent:
            median = (min_rent + max_rent) // 2
            total_count = avail_count + unavail_count

            rent_rows.append({
                "building_id": building_id,
                "source": SOURCE,
                "bedrooms": beds,
                "min_rent": min_rent,
                "max_rent": max_rent,
                "median_rent": median,
                "listing_count": total_count,
                "scraped_at": now,
                "updated_at": now,
            })

            # Record the available range as today's observation
            if avail_min and avail_max:
                history_rows.append({
                    "building_id": building_id,
                    "source": SOURCE,
                    "unit_number": "",
                    "bedrooms": beds,
                    "rent": (avail_min + avail_max) // 2,
                    "observed_at": today,
                })

            # Record historical range (from closed listings)
            if unavail_min and unavail_max and unavail_count > 0:
                history_rows.append({
                    "building_id": building_id,
                    "source": f"{SOURCE}-historical",
                    "unit_number": "",
                    "bedrooms": beds,
                    "rent": (unavail_min + unavail_max) // 2,
                    "observed_at": today,
                })

    if dry_run:
        return {"rents": len(rent_rows), "history": len(history_rows)}

    # Upsert building_rents
    if rent_rows:
        try:
            supabase.table("building_rents") \
                .upsert(rent_rows, on_conflict="building_id,source,bedrooms") \
                .execute()
        except Exception as e:
            print(f"    Rent upsert error: {e}")

    # Insert unit_rent_history
    if history_rows:
        try:
            supabase.table("unit_rent_history") \
                .upsert(history_rows, on_conflict="building_id,source,unit_number,bedrooms,rent,observed_at") \
                .execute()
        except Exception as e:
            print(f"    History upsert error: {e}")

    return {"rents": len(rent_rows), "history": len(history_rows)}


def process_available_listings(building_id: str, listings: list, dry_run: bool = False) -> dict:
    """Process availableListingDigests into unit_rent_history records.

    Each listing has per-unit data: unit number, price, beds, baths, sqft, dates.
    """
    if not listings:
        return {"units": 0}

    today = date.today().isoformat()
    history_rows = []

    for listing in listings:
        try:
            unit = listing.get("displayUnit", "")
            if unit:
                # Clean unit number: remove '#' prefix
                unit = unit.lstrip("#").strip()

            price = listing.get("price")
            if not price or not isinstance(price, (int, float)):
                continue

            beds = listing.get("bedroomCount")
            full_baths = listing.get("fullBathroomCount", 0) or 0
            half_baths = listing.get("halfBathroomCount", 0) or 0
            baths = full_baths + (0.5 * half_baths) if (full_baths or half_baths) else None

            sqft = listing.get("livingAreaSize")
            if sqft and isinstance(sqft, dict):
                sqft = sqft.get("amount")

            # Use availableAt date if present, otherwise today
            observed = listing.get("availableAt", today)
            if not observed:
                observed = today

            history_rows.append({
                "building_id": building_id,
                "source": SOURCE,
                "unit_number": unit or "",
                "bedrooms": beds,
                "bathrooms": baths,
                "rent": int(price),
                "sqft": int(sqft) if sqft else None,
                "observed_at": observed,
            })
        except Exception as e:
            continue

    if dry_run:
        return {"units": len(history_rows)}

    if history_rows:
        try:
            supabase.table("unit_rent_history") \
                .upsert(history_rows, on_conflict="building_id,source,unit_number,bedrooms,rent,observed_at") \
                .execute()
        except Exception as e:
            print(f"    Unit history upsert error: {e}")

    return {"units": len(history_rows)}


def enum_to_name(enum_str: str) -> str:
    """Convert enum-style string to human-readable name.
    e.g., BIKE_ROOM -> Bike Room, LIVE_IN_SUPER -> Live In Super
    """
    return " ".join(w.capitalize() for w in enum_str.replace("_", " ").lower().split())


def process_amenities(building_id: str, amenities: dict, policies: list,
                      unit_features: list, dry_run: bool = False) -> int:
    """Process structured amenity data from building page into building_amenities."""
    now = datetime.now(timezone.utc).isoformat()
    rows = []
    seen = set()

    # Process amenities - format is {"list":["BIKE_ROOM","DOORMAN",...], ...}
    amenity_list = amenities.get("list", []) if isinstance(amenities, dict) else []
    if not isinstance(amenity_list, list):
        amenity_list = []

    # Also grab other amenity arrays
    for extra_key in ["fireplaceTypes", "privateOutdoorSpaceTypes", "views"]:
        extra = amenities.get(extra_key, []) if isinstance(amenities, dict) else []
        if isinstance(extra, list):
            amenity_list.extend(extra)

    for item in amenity_list:
        if isinstance(item, str):
            name = enum_to_name(item)
        elif isinstance(item, dict):
            name = item.get("name", str(item))
        else:
            continue

        normalized = normalize_amenity(name)
        key = normalized.lower()
        if key in seen:
            continue
        seen.add(key)
        rows.append({
            "building_id": building_id,
            "source": SOURCE,
            "amenity": normalized,
            "category": categorize_amenity(name),
            "scraped_at": now,
        })

    # If amenities was a dict with category keys (alternate format from rendered HTML)
    if isinstance(amenities, dict) and "list" not in amenities:
        for category_label, items in amenities.items():
            if not isinstance(items, list):
                continue
            for item in items:
                if isinstance(item, str):
                    name = item.strip()
                elif isinstance(item, dict):
                    name = item.get("name", str(item))
                    details = item.get("details", "")
                    if details:
                        name = f"{name} ({details})"
                else:
                    continue

                normalized = normalize_amenity(name)
                key = normalized.lower()
                if key in seen:
                    continue
                seen.add(key)
                rows.append({
                    "building_id": building_id,
                    "source": SOURCE,
                    "amenity": normalized,
                    "category": categorize_amenity(name),
                    "scraped_at": now,
                })

    # Process policies as amenities
    for policy in policies:
        if not isinstance(policy, str):
            continue
        normalized = normalize_amenity(policy)
        key = normalized.lower()
        if key in seen:
            continue
        seen.add(key)
        rows.append({
            "building_id": building_id,
            "source": SOURCE,
            "amenity": normalized,
            "category": categorize_amenity(policy),
            "scraped_at": now,
        })

    # Process unit features as amenities
    for feature in unit_features:
        if isinstance(feature, str):
            name = feature.strip()
        elif isinstance(feature, dict):
            name = feature.get("name", str(feature))
            details = feature.get("details", "")
            if details:
                name = f"{name} ({details})"
        else:
            continue

        normalized = normalize_amenity(name)
        key = normalized.lower()
        if key in seen:
            continue
        seen.add(key)
        rows.append({
            "building_id": building_id,
            "source": SOURCE,
            "amenity": normalized,
            "category": categorize_amenity(name),
            "scraped_at": now,
        })

    if dry_run:
        return len(rows)

    if rows:
        try:
            supabase.table("building_amenities") \
                .upsert(rows, on_conflict="building_id,source,amenity") \
                .execute()
        except Exception as e:
            print(f"    Amenity upsert error: {e}")

    return len(rows)


# ── MAIN ─────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Backfill StreetEasy building detail data")
    parser.add_argument("--limit", type=int, default=0, help="Max buildings to process (0=all)")
    parser.add_argument("--offset", type=int, default=0, help="Skip first N buildings")
    parser.add_argument("--dry-run", action="store_true", help="Preview without DB writes")
    parser.add_argument("--building-id", type=str, default="", help="Process a single building ID")
    parser.add_argument("--mode", type=str, default="listings",
                        choices=["listings", "all", "borough"],
                        help="listings=only buildings with SE listing URLs, "
                             "all=try all buildings by address, "
                             "borough=all buildings in a specific borough")
    parser.add_argument("--borough", type=str, default="", help="Borough for --mode=borough")
    parser.add_argument("--workers", type=int, default=1, help="Number of parallel workers (default=1)")
    parser.add_argument("--min-units", type=int, default=0, help="Only process buildings with >= N residential units")
    args = parser.parse_args()

    # Build the list of (slug, building_id) pairs based on mode
    buildings = {}  # slug -> building_id

    if args.building_id:
        # Single building mode — check for existing listing URL first
        result = supabase.table("building_listings") \
            .select("building_id,listing_url") \
            .eq("source", SOURCE) \
            .eq("building_id", args.building_id) \
            .execute()
        if result.data:
            slug = extract_building_slug(result.data[0]["listing_url"])
            if slug:
                buildings[slug] = args.building_id
        if not buildings:
            # Fall back to address-based lookup
            bld = supabase.table("buildings") \
                .select("id,house_number,street_name,borough") \
                .eq("id", args.building_id) \
                .limit(1) \
                .execute()
            if bld.data:
                b = bld.data[0]
                slug = address_to_se_slug(b["house_number"], b["street_name"], b["borough"])
                buildings[slug] = b["id"]

    elif args.mode == "listings":
        print("Fetching buildings with StreetEasy listings...")
        query = supabase.table("building_listings") \
            .select("building_id,listing_url") \
            .eq("source", SOURCE) \
            .order("building_id")

        if args.offset:
            query = query.range(args.offset, args.offset + (args.limit or 10000) - 1)
        elif args.limit:
            query = query.limit(args.limit)

        result = query.execute()
        if not result.data:
            print("No StreetEasy listings found in DB.")
            return

        for row in result.data:
            slug = extract_building_slug(row["listing_url"])
            if slug and slug not in buildings:
                buildings[slug] = row["building_id"]

    elif args.mode in ("all", "borough"):
        borough_filter = args.borough if args.mode == "borough" else ""
        label = f"borough={borough_filter}" if borough_filter else "all boroughs"
        if args.min_units:
            label += f", {args.min_units}+ units"
        print(f"Fetching buildings ({label}) for address-based StreetEasy lookup...")

        # Paginate through all matching buildings (Supabase max 1000 per request)
        page_size = 1000
        offset = args.offset
        target_limit = args.limit or 0  # 0 = no limit
        all_rows = []

        while True:
            query = supabase.table("buildings") \
                .select("id,house_number,street_name,borough") \
                .order("id")

            if borough_filter:
                query = query.eq("borough", borough_filter)
            if args.min_units:
                query = query.gte("residential_units", args.min_units)

            batch_size = min(page_size, target_limit - len(all_rows)) if target_limit else page_size
            query = query.range(offset, offset + batch_size - 1)

            result = query.execute()
            if not result.data:
                break

            all_rows.extend(result.data)
            offset += len(result.data)

            if len(result.data) < batch_size:
                break  # last page
            if target_limit and len(all_rows) >= target_limit:
                break

        if not all_rows:
            print("No buildings found.")
            return

        print(f"Fetched {len(all_rows)} buildings from DB")

        for b in all_rows:
            hn = b.get("house_number", "")
            sn = b.get("street_name", "")
            boro = b.get("borough", "")
            if hn and sn and boro:
                slug = address_to_se_slug(hn, sn, boro)
                if slug not in buildings:
                    buildings[slug] = b["id"]

    if not buildings:
        print("No buildings to process.")
        return

    num_workers = max(1, args.workers)
    print(f"Found {len(buildings)} unique buildings to process")
    print(f"Workers: {num_workers}")
    print(f"Dry run: {args.dry_run}")
    print(f"Start time: {datetime.now()}\n")

    # Thread-safe counters
    lock = threading.Lock()
    counters = {
        "rents": 0, "history": 0, "units": 0, "amenities": 0,
        "names": 0, "ok": 0, "fail": 0, "skip": 0, "404": 0, "done": 0,
    }
    total = len(buildings)

    def process_building(idx, slug, building_id):
        """Process a single building — designed to run in a thread."""
        url = building_page_url(slug)
        with lock:
            counters["done"] += 1
            n = counters["done"]
        print(f"\n[{n}/{total}] {slug} ({building_id[:8]}...)")
        print(f"  URL: {url}")

        page = fetch_page(url)
        if page is None:
            print(f"  FAILED to fetch after {MAX_RETRIES} retries")
            with lock:
                counters["fail"] += 1
            return

        if page.status == 404:
            print(f"  Not found on StreetEasy (404)")
            with lock:
                counters["404"] += 1
            return

        # Parse RSC data
        rsc_data = extract_rsc_data(page)

        rental_summary = rsc_data["rental_summary"]
        available = rsc_data["available_listings"]
        amenities = rsc_data["amenities"]
        policies = rsc_data["policies"]
        unit_features = rsc_data["unit_features"]
        building_info = rsc_data["building_info"]
        building_name = rsc_data.get("building_name")

        has_data = bool(rental_summary or available or amenities or policies or unit_features)

        if not has_data:
            print(f"  No structured data found on page")
            with lock:
                counters["skip"] += 1
            return

        # Process rental summary
        rent_result = process_rental_summary(building_id, rental_summary, args.dry_run)

        # Process available listings (per-unit)
        unit_result = process_available_listings(building_id, available, args.dry_run)

        # Process amenities
        amenity_count = process_amenities(building_id, amenities, policies, unit_features, args.dry_run)

        # Update building name if found
        name_saved = False
        if building_name and not args.dry_run:
            try:
                supabase.table("buildings") \
                    .update({"name": building_name}) \
                    .eq("id", building_id) \
                    .execute()
                name_saved = True
            except Exception as e:
                if "name" not in str(e) or "does not exist" not in str(e):
                    print(f"  Name update error: {e}")
        elif building_name and args.dry_run:
            name_saved = True

        with lock:
            counters["ok"] += 1
            counters["rents"] += rent_result["rents"]
            counters["history"] += rent_result["history"]
            counters["units"] += unit_result["units"]
            counters["amenities"] += amenity_count
            if name_saved:
                counters["names"] += 1

        # Print summary for this building
        info_parts = []
        if building_name:
            info_parts.append(f'name: "{building_name}"')
        if building_info.get("units"):
            info_parts.append(f"{building_info['units']} units")
        if building_info.get("year_built"):
            info_parts.append(f"built {building_info['year_built']}")
        if building_info.get("manager"):
            info_parts.append(f"mgr: {building_info['manager']}")

        print(f"  {'[DRY RUN] ' if args.dry_run else ''}OK: {rent_result['rents']} rents, "
              f"{rent_result['history']} history, {unit_result['units']} units, "
              f"{amenity_count} amenities{', name saved' if name_saved else ''}")
        if info_parts:
            print(f"  Info: {', '.join(info_parts)}")

    building_items = list(buildings.items())

    if num_workers == 1:
        # Sequential mode (original behavior)
        for i, (slug, building_id) in enumerate(building_items):
            process_building(i, slug, building_id)
            if i < len(building_items) - 1:
                time.sleep(PAGE_DELAY)
    else:
        # Parallel mode with staggered starts
        # Each worker gets its own slice of buildings and adds its own delays
        # to avoid hammering StreetEasy with simultaneous requests
        def worker_batch(worker_id, items):
            """Process a batch of buildings for one worker, with delays."""
            # Stagger start: each worker waits worker_id * 2 seconds
            time.sleep(worker_id * 2)
            for i, (slug, building_id) in enumerate(items):
                process_building(i, slug, building_id)
                if i < len(items) - 1:
                    time.sleep(PAGE_DELAY)

        # Split buildings evenly across workers
        chunks = [[] for _ in range(num_workers)]
        for i, item in enumerate(building_items):
            chunks[i % num_workers].append(item)

        with ThreadPoolExecutor(max_workers=num_workers) as executor:
            futures = []
            for worker_id, chunk in enumerate(chunks):
                if chunk:
                    futures.append(executor.submit(worker_batch, worker_id, chunk))

            # Wait for all workers to finish
            for future in as_completed(futures):
                try:
                    future.result()
                except Exception as e:
                    print(f"\nWorker error: {e}")

    print(f"\n{'=' * 60}")
    print(f"SUMMARY")
    print(f"{'=' * 60}")
    print(f"Buildings processed:     {counters['ok']}")
    print(f"Buildings failed:        {counters['fail']}")
    print(f"Buildings no data:       {counters['skip']}")
    print(f"Rent records upserted:   {counters['rents']}")
    print(f"History records:         {counters['history']}")
    print(f"Unit records:            {counters['units']}")
    print(f"Amenity records:         {counters['amenities']}")
    print(f"Building names saved:    {counters['names']}")
    if counters["404"] > 0:
        print(f"Not found (404):         {counters['404']}")
    print(f"End time: {datetime.now()}")


if __name__ == "__main__":
    main()

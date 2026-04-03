#!/usr/bin/env python3
"""
Import rental listing data from Columbia University Off-Campus Housing Marketplace
(columbia.rcpstaging.com) into Supabase.

Uses pre-extracted JSON from the Vue app's dataAfterFilter (2500+ listings with
structured floor plans, amenities, and unit-level rent data).

Usage:
    python3 scripts/import-columbia-rcp.py --json scripts/columbia-rcp-full.json              # full import
    python3 scripts/import-columbia-rcp.py --json scripts/columbia-rcp-full.json --dry-run     # preview
    python3 scripts/import-columbia-rcp.py --json scripts/columbia-rcp-full.json --limit=50    # first 50
"""

import json
import os
import re
import sys
import argparse
from pathlib import Path
from datetime import datetime, timezone
from collections import defaultdict

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

from supabase import create_client

supabase = create_client(SUPABASE_URL, SERVICE_KEY)

# ── CONSTANTS ────────────────────────────────────────────────────────────────
SOURCE = "columbia_rcp"
METRO = "nyc"

# ── AMENITY CATEGORIZATION ───────────────────────────────────────────────────
AMENITY_CATEGORIES = {
    "doorman": "building", "concierge": "building", "elevator": "building",
    "live-in super": "building", "live in super": "building",
    "lobby": "building", "package": "building", "mail room": "building",
    "common area": "building", "lounge": "building", "business center": "building",
    "media room": "building", "media lounge": "building",
    "game room": "building", "playroom": "building", "library": "building",
    "wi-fi": "building", "wifi": "building", "intercom": "building",
    "wheelchair": "building", "ada": "building",
    "air conditioning": "building", "a/c": "building", "central air": "building",
    "central heat": "building", "heat": "building",
    "dishwasher": "building", "microwave": "building", "stainless steel": "building",
    "hardwood": "building", "bamboo": "building", "tile": "building",
    "high ceiling": "building", "9 foot": "building", "14 foot": "building",
    "walk-in closet": "building", "closet": "building",
    "controlled access": "building", "controlled building": "building",
    "granite": "building", "marble": "building", "quartz": "building",
    "oven": "building", "refrigerator": "building", "mini-fridge": "building",
    "furnished": "building", "flat-screen": "building", "smart tv": "building",
    "fresh paint": "building", "new cabinet": "building",
    "oversized window": "building", "keyless": "building", "electronic key": "building",
    "individual lease": "building", "international student": "building",
    "roommate matching": "building", "on bus line": "building",
    "cable ready": "building", "internet": "building",
    "washer": "laundry", "dryer": "laundry", "laundry": "laundry",
    "in-unit": "laundry",
    "roof": "outdoor", "rooftop": "outdoor", "terrace": "outdoor",
    "balcony": "outdoor", "patio": "outdoor", "garden": "outdoor",
    "courtyard": "outdoor", "backyard": "outdoor", "outdoor": "outdoor",
    "bbq": "outdoor", "grill": "outdoor", "pool": "outdoor", "swimming": "outdoor",
    "gym": "fitness", "fitness": "fitness", "yoga": "fitness", "cycling": "fitness",
    "sauna": "fitness", "spa": "fitness", "steam": "fitness",
    "basketball": "fitness", "tennis": "fitness",
    "parking": "parking", "garage": "parking", "bike": "parking",
    "bicycle": "parking", "valet": "parking", "ev charging": "parking",
    "security": "security", "video intercom": "security", "surveillance": "security",
    "key fob": "security", "cctv": "security", "camera": "security",
    "pet": "pet", "dog": "pet", "cat": "pet", "no pets": "pet",
    "storage": "storage", "wine storage": "storage", "cellar": "storage",
    "penthouse": "luxury", "screening room": "luxury", "golf": "luxury",
    "bowling": "luxury", "private dining": "luxury", "chef": "luxury",
    "movie theater": "luxury", "study room": "luxury", "entertainment": "luxury",
    "clubhouse": "luxury", "coffee bar": "luxury", "conference": "luxury",
    "free printing": "luxury",
}


def categorize_amenity(text: str) -> str:
    lower = text.lower().strip()
    for keyword, category in AMENITY_CATEGORIES.items():
        if keyword in lower:
            return category
    return "other"


def normalize_amenity(text: str) -> str:
    return " ".join(w.capitalize() for w in text.strip().split())


# ── ADDRESS HELPERS ──────────────────────────────────────────────────────────

# NYC streets with official alternate names. Maps normalized form → aliases.
# Used to match buildings stored under one name when imports use the other.
STREET_ALIASES = {
    "W 110TH ST": ["CATHEDRAL PARKWAY", "CATHEDRAL PKY", "CATHEDRAL PKWY"],
    "CATHEDRAL PARKWAY": ["W 110TH ST", "WEST 110TH STREET", "WEST 110 STREET"],
    "CATHEDRAL PKY": ["W 110TH ST", "WEST 110TH STREET"],
    "CATHEDRAL PKWY": ["W 110TH ST", "WEST 110TH STREET"],
    "E 6TH ST": ["MUSEUM MILE"],  # partial overlap
    "AVE OF THE AMERICAS": ["6TH AVE", "SIXTH AVE"],
    "6TH AVE": ["AVE OF THE AMERICAS"],
}

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
    "way": "WAY",
    "north": "N", "south": "S", "east": "E", "west": "W",
}

ZIP_TO_BOROUGH = {
    "100": "Manhattan", "101": "Manhattan", "102": "Manhattan",
    "112": "Brooklyn", "113": "Brooklyn", "114": "Brooklyn",
    "104": "Bronx",
    "110": "Queens", "111": "Queens", "116": "Queens",
    "103": "Staten Island",
}


def normalize_address(address: str) -> str:
    addr = address.upper().strip()
    for sep in [" APT ", " UNIT ", " #", " STE ", ", APT", ",APT"]:
        if sep.upper() in addr:
            addr = addr.split(sep.upper())[0]
    parts = addr.split()
    normalized = []
    for part in parts:
        lower = part.lower().rstrip(".,")
        if lower in STREET_ABBREVS:
            normalized.append(STREET_ABBREVS[lower])
        else:
            normalized.append(part.rstrip(".,"))
    return " ".join(normalized)


def generate_slug(full_address: str) -> str:
    return re.sub(r'(^-+|-+$)', '', re.sub(r'[^a-z0-9]+', '-', full_address.lower()))


def safe_int(val, default=None):
    try:
        return int(val)
    except (ValueError, TypeError):
        return default


def parse_address(raw: str) -> dict:
    """Parse address into components. Handles multiline addresses."""
    addr = raw.replace('\r\n', ', ').replace('\n', ', ').strip()
    # Fix missing spaces (e.g. "49 W 90th StNew York")
    addr = re.sub(r'(St|Ave|Blvd|Dr|Pl|Ct|Rd|Ln)\s*(New York|Brooklyn|Bronx|Queens)',
                  r'\1, \2', addr, flags=re.I)

    zip_match = re.search(r'\b(\d{5})\b', addr)
    zip_code = zip_match.group(1) if zip_match else None

    state_match = re.search(r'\b(NY|NJ|CT)\b', addr, re.I)
    state = state_match.group(1).upper() if state_match else "NY"

    # Street is first part before city/state
    street = addr.split(",")[0].strip()
    for sep in [" Apt ", " apt ", " Unit ", " unit ", " #"]:
        if sep in street:
            street = street.split(sep)[0].strip()

    normalized = normalize_address(street)
    parts = normalized.split(None, 1)
    house_number = parts[0] if parts else ""
    street_name = parts[1] if len(parts) > 1 else ""

    borough = "Manhattan"
    if zip_code:
        prefix = zip_code[:3]
        borough = ZIP_TO_BOROUGH.get(prefix, "Manhattan")

    return {
        "street": normalized,
        "house_number": house_number,
        "street_name": street_name,
        "zip_code": zip_code,
        "state": state,
        "borough": borough,
    }


# ── DATABASE OPERATIONS ──────────────────────────────────────────────────────

# Direction and suffix variants for fuzzy address matching.
# PLUTO uses "WEST 110TH STREET" while imports normalize to "W 110TH ST".
DIRECTION_VARIANTS = {"W": "WEST", "E": "EAST", "N": "NORTH", "S": "SOUTH"}
SUFFIX_VARIANTS = {"ST": "STREET", "AVE": "AVENUE", "BLVD": "BOULEVARD",
                   "DR": "DRIVE", "PL": "PLACE", "RD": "ROAD", "LN": "LANE",
                   "CT": "COURT", "TER": "TERRACE"}


def _address_variants(normalized: str) -> list[str]:
    """Generate alternate forms of a normalized address for fuzzy matching.

    E.g. '515 W 110TH ST' → ['515 WEST 110TH STREET', '515 W 110TH STREET',
                              '515 WEST 110TH ST']
    """
    variants = set()
    parts = normalized.split()
    if len(parts) < 3:
        return []

    house = parts[0]
    direction = parts[1] if parts[1] in DIRECTION_VARIANTS else None
    suffix = parts[-1] if parts[-1] in SUFFIX_VARIANTS else None

    # Expand direction: W → WEST
    if direction:
        expanded_dir = list(parts)
        expanded_dir[1] = DIRECTION_VARIANTS[direction]
        variants.add(" ".join(expanded_dir))

    # Expand suffix: ST → STREET
    if suffix:
        expanded_suf = list(parts)
        expanded_suf[-1] = SUFFIX_VARIANTS[suffix]
        variants.add(" ".join(expanded_suf))

    # Expand both
    if direction and suffix:
        expanded_both = list(parts)
        expanded_both[1] = DIRECTION_VARIANTS[direction]
        expanded_both[-1] = SUFFIX_VARIANTS[suffix]
        variants.add(" ".join(expanded_both))

    # Also try contracting: WEST → W, STREET → ST (reverse lookup)
    rev_dir = {v: k for k, v in DIRECTION_VARIANTS.items()}
    rev_suf = {v: k for k, v in SUFFIX_VARIANTS.items()}
    dir_word = parts[1]
    suf_word = parts[-1]

    if dir_word in rev_dir:
        contracted = list(parts)
        contracted[1] = rev_dir[dir_word]
        variants.add(" ".join(contracted))
    if suf_word in rev_suf:
        contracted = list(parts)
        contracted[-1] = rev_suf[suf_word]
        variants.add(" ".join(contracted))
    if dir_word in rev_dir and suf_word in rev_suf:
        contracted = list(parts)
        contracted[1] = rev_dir[dir_word]
        contracted[-1] = rev_suf[suf_word]
        variants.add(" ".join(contracted))

    variants.discard(normalized)
    return list(variants)


def match_building(addr: dict) -> str | None:
    normalized = addr["street"]
    zip_code = addr["zip_code"]
    house_number = addr["house_number"]
    borough = addr["borough"]

    if not normalized or len(normalized) < 3:
        return None

    # Build list of address forms to try (original + W/WEST, ST/STREET variants)
    address_forms = [normalized] + _address_variants(normalized)

    # Add street alias forms (e.g. "515 W 110TH ST" → "515 CATHEDRAL PARKWAY")
    street_name = addr["street_name"]
    for alias_key, aliases in STREET_ALIASES.items():
        if alias_key in street_name or street_name in aliases:
            for alias in ([alias_key] + aliases):
                if alias != street_name:
                    alias_form = f"{house_number} {alias}"
                    address_forms.append(alias_form)

    try:
        for form in address_forms:
            if zip_code:
                result = supabase.table("buildings") \
                    .select("id") \
                    .eq("zip_code", zip_code) \
                    .ilike("full_address", f"%{form}%") \
                    .limit(1) \
                    .execute()
                if result.data:
                    return result.data[0]["id"]

        if house_number and zip_code:
            result = supabase.table("buildings") \
                .select("id") \
                .eq("zip_code", zip_code) \
                .eq("house_number", house_number) \
                .limit(1) \
                .execute()
            if result.data:
                return result.data[0]["id"]

        for form in address_forms:
            if borough:
                result = supabase.table("buildings") \
                    .select("id") \
                    .eq("borough", borough) \
                    .ilike("full_address", f"%{form}%") \
                    .limit(1) \
                    .execute()
                if result.data:
                    return result.data[0]["id"]
    except Exception as e:
        print(f"    DB match error: {e}")
    return None


def create_building(addr: dict, name: str = None, lat=None, lng=None) -> str | None:
    borough = addr["borough"]
    full_address = f"{addr['street']}, {borough}, {addr['state']}"
    if addr["zip_code"]:
        full_address += f", {addr['zip_code']}"

    slug = generate_slug(full_address)
    row = {
        "full_address": full_address,
        "house_number": addr["house_number"],
        "street_name": addr["street_name"],
        "borough": borough,
        "city": "New York",
        "state": addr["state"],
        "zip_code": addr["zip_code"] or None,
        "name": name if name and not re.match(r'^\d', name) else None,
        "slug": slug,
        "metro": METRO,
        "latitude": lat,
        "longitude": lng,
        "overall_score": 0,
        "review_count": 0, "violation_count": 0, "complaint_count": 0,
        "litigation_count": 0, "dob_violation_count": 0, "crime_count": 0,
        "bedbug_report_count": 0, "eviction_count": 0, "permit_count": 0,
        "sidewalk_shed_count": 0, "lead_violation_count": 0,
    }

    try:
        result = supabase.table("buildings").insert(row).execute()
        if result.data:
            return result.data[0]["id"]
    except Exception as e:
        err_msg = str(e)
        if "duplicate" in err_msg.lower() or "unique" in err_msg.lower():
            existing = supabase.table("buildings") \
                .select("id").eq("slug", slug).limit(1).execute()
            if existing.data:
                return existing.data[0]["id"]
        print(f"    Building creation error: {e}")
    return None


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
            "building_id": building_id, "source": SOURCE, "bedrooms": beds,
            "min_rent": min_r, "max_rent": max_r, "median_rent": median,
            "listing_count": data.get("count", 1),
            "scraped_at": now, "updated_at": now,
        })
        history_rows.append({
            "building_id": building_id, "source": SOURCE,
            "bedrooms": beds, "rent": median, "observed_at": now,
        })
    try:
        supabase.table("building_rents") \
            .upsert(rows, on_conflict="building_id,source,bedrooms").execute()
    except Exception as e:
        print(f"    Rent upsert error: {e}")
        return 0
    try:
        supabase.table("unit_rent_history") \
            .upsert(history_rows, on_conflict="building_id,source,unit_number,bedrooms,rent,observed_at").execute()
    except Exception as e:
        pass  # History insert may fail on conflict, that's OK
    return len(rows)


def upsert_amenities(building_id: str, amenities: list[str]) -> int:
    if not amenities:
        return 0
    now = datetime.now(timezone.utc).isoformat()
    rows = []
    seen = set()
    for a in amenities:
        normalized = normalize_amenity(a)
        key = normalized.lower()
        if key in seen or len(key) < 2:
            continue
        seen.add(key)
        rows.append({
            "building_id": building_id, "source": SOURCE,
            "amenity": normalized, "category": categorize_amenity(a),
            "scraped_at": now,
        })
    try:
        supabase.table("building_amenities") \
            .upsert(rows, on_conflict="building_id,source,amenity").execute()
        return len(rows)
    except Exception as e:
        print(f"    Amenity upsert error: {e}")
        return 0


def insert_unit_rent_history(building_id: str, unit_number: str, beds: int, rent: int) -> bool:
    now = datetime.now(timezone.utc).isoformat()
    row = {
        "building_id": building_id, "source": SOURCE,
        "unit_number": unit_number, "bedrooms": beds,
        "rent": rent, "observed_at": now,
    }
    try:
        supabase.table("unit_rent_history") \
            .upsert(row, on_conflict="building_id,source,unit_number,bedrooms,rent,observed_at").execute()
        return True
    except Exception as e:
        return False


# ── EXTRACT AMENITIES FROM FEATURES ──────────────────────────────────────────
def extract_amenities(features: dict) -> list[str]:
    """Extract amenity strings from the structured features object.

    Features come as: {"Unit Features": [...], "Property Features": [...],
                       "Utilities": [...], "Outdoor Space": [...], etc.}
    """
    amenities = []
    if not features or not isinstance(features, dict):
        return amenities

    # Skip non-amenity categories
    skip_categories = {"Intended For", "Lease Length", "Pricing", "Bathroom",
                       "Communities", "Housing", "Room Type", "Size of Dorm",
                       "Sustainability"}

    for category, items in features.items():
        if category in skip_categories:
            continue
        if isinstance(items, list):
            for item in items:
                if isinstance(item, str) and len(item.strip()) > 1:
                    amenities.append(item.strip().rstrip('\t'))
        elif isinstance(items, dict):
            # Handle {name: 0/1} format
            for name, enabled in items.items():
                if enabled and enabled != 0:
                    readable = name.replace("-", " ").replace("_", " ").title()
                    amenities.append(readable)

    return amenities


# ── MAIN IMPORT ──────────────────────────────────────────────────────────────
def import_listings(listings: list[dict], dry_run: bool = False):
    print(f"\nProcessing {len(listings)} raw listings...")

    # Group by building address (strip unit numbers)
    buildings = defaultdict(lambda: {
        "units": [],
        "amenities": set(),
        "name": None,
        "addr": None,
        "lat": None, "lng": None,
        "rent_by_beds": defaultdict(lambda: {"min_rent": 999999, "max_rent": 0, "count": 0}),
    })

    skipped_no_addr = 0
    skipped_non_nyc = 0
    skipped_no_price = 0

    for listing in listings:
        address = listing.get("address", "")
        if not address or len(address) < 5:
            skipped_no_addr += 1
            continue

        addr = parse_address(address)

        # Skip non-NYC
        if addr["state"] not in ("NY",) or not addr["zip_code"] or addr["zip_code"][:2] not in ("10", "11"):
            if addr["state"] == "NJ" or (addr["zip_code"] and addr["zip_code"][:2] not in ("10", "11")):
                skipped_non_nyc += 1
                continue

        # Building key = normalized street + zip
        bldg_key = f"{addr['street']}|{addr['zip_code'] or ''}|{addr['borough']}"

        bldg = buildings[bldg_key]
        if not bldg["addr"]:
            bldg["addr"] = addr
        if not bldg["lat"] and listing.get("lat"):
            bldg["lat"] = listing["lat"]
            bldg["lng"] = listing.get("lng")

        # Use title as building name if it's not just an address
        title = listing.get("title", "")
        if title and not re.match(r'^\d', title) and not bldg["name"]:
            bldg["name"] = title

        # Extract amenities
        amenity_list = extract_amenities(listing.get("features", {}))
        bldg["amenities"].update(amenity_list)

        # Process floor plans (unit-level data)
        floorplans = listing.get("floorplans", [])
        has_price = False

        for fp in floorplans:
            beds = safe_int(fp.get("bed"), None)
            min_rent = safe_int(fp.get("min_rent"), None)
            max_rent = safe_int(fp.get("max_rent"), None)
            unit_title = fp.get("title", "")

            if min_rent and min_rent > 0 and 200 <= min_rent <= 100000:
                has_price = True
                if beds is not None:
                    bldg["rent_by_beds"][beds]["min_rent"] = min(bldg["rent_by_beds"][beds]["min_rent"], min_rent)
                    bldg["rent_by_beds"][beds]["max_rent"] = max(bldg["rent_by_beds"][beds]["max_rent"], max_rent or min_rent)
                    bldg["rent_by_beds"][beds]["count"] += 1

                bldg["units"].append({
                    "unit": unit_title,
                    "beds": beds,
                    "baths": safe_int(fp.get("bath")),
                    "rent": min_rent,
                    "sqft": fp.get("sq_footage"),
                })

        # If no floorplan data, use listing-level rent
        if not has_price:
            min_rent = safe_int(listing.get("min_rent"))
            max_rent = safe_int(listing.get("max_rent"))
            min_bed = safe_int(listing.get("min_bed"))
            if min_rent and min_rent > 0 and 200 <= min_rent <= 100000:
                has_price = True
                if min_bed is not None:
                    bldg["rent_by_beds"][min_bed]["min_rent"] = min(bldg["rent_by_beds"][min_bed]["min_rent"], min_rent)
                    bldg["rent_by_beds"][min_bed]["max_rent"] = max(bldg["rent_by_beds"][min_bed]["max_rent"], max_rent or min_rent)
                    bldg["rent_by_beds"][min_bed]["count"] += 1

        if not has_price:
            skipped_no_price += 1

    # Fix min_rent defaults
    for bldg in buildings.values():
        for beds, rd in bldg["rent_by_beds"].items():
            if rd["min_rent"] == 999999:
                rd["min_rent"] = rd["max_rent"]
            if rd["max_rent"] == 0:
                rd["max_rent"] = rd["min_rent"]
        # Remove bed entries with no valid rent
        bldg["rent_by_beds"] = {k: v for k, v in bldg["rent_by_beds"].items() if v["min_rent"] > 0}

    # Filter buildings with no rent data at all
    buildings_with_data = {k: v for k, v in buildings.items() if v["rent_by_beds"]}

    print(f"  Skipped: {skipped_no_addr} no address, {skipped_non_nyc} non-NYC, {skipped_no_price} no price")
    print(f"  Grouped into {len(buildings)} unique buildings ({len(buildings_with_data)} with rent data)")

    if dry_run:
        print(f"\n  DRY RUN — would import {len(buildings_with_data)} buildings:")
        for key, data in sorted(buildings_with_data.items())[:30]:
            addr = data["addr"]
            n_units = len(data["units"])
            rents = data["rent_by_beds"]
            all_mins = [v["min_rent"] for v in rents.values()]
            all_maxs = [v["max_rent"] for v in rents.values()]
            price_range = f"${min(all_mins):,} - ${max(all_maxs):,}" if all_mins else "?"
            print(f"    {addr['street']}: {n_units} units, {price_range}, {len(data['amenities'])} amenities")
        if len(buildings_with_data) > 30:
            print(f"    ... and {len(buildings_with_data) - 30} more")
        return

    # Import
    total_matched = 0
    total_created = 0
    total_rents = 0
    total_amenities = 0
    total_unit_history = 0

    for key, data in buildings_with_data.items():
        addr = data["addr"]
        building_id = match_building(addr)

        if building_id:
            total_matched += 1
            label = "MATCHED"
        else:
            building_id = create_building(addr, data["name"], data["lat"], data["lng"])
            if building_id:
                total_created += 1
                label = "CREATED"
            else:
                continue

        print(f"  {label}: {addr['street']} ({addr['borough']}) -> {building_id[:8]}...")

        total_rents += upsert_rents(building_id, dict(data["rent_by_beds"]))
        total_amenities += upsert_amenities(building_id, list(data["amenities"]))

        # Unit-level rent history
        for unit in data["units"]:
            if unit["unit"] and unit["rent"] and unit["beds"] is not None:
                if insert_unit_rent_history(building_id, unit["unit"], unit["beds"], unit["rent"]):
                    total_unit_history += 1

    print(f"\n{'='*60}")
    print(f"Import complete!")
    print(f"  Buildings matched:     {total_matched}")
    print(f"  Buildings created:     {total_created}")
    print(f"  Rent records:          {total_rents}")
    print(f"  Amenity records:       {total_amenities}")
    print(f"  Unit rent history:     {total_unit_history}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Import Columbia RCP listings")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--json", type=str, required=True, help="Path to extracted JSON data")
    parser.add_argument("--limit", type=int)
    args = parser.parse_args()

    with open(args.json) as f:
        listings = json.load(f)

    if args.limit:
        listings = listings[:args.limit]

    import_listings(listings, dry_run=args.dry_run)

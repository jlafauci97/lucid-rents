#!/usr/bin/env python3
"""
NYS DCJS Sex Offender Registry scraper — writes ONLY to the RLS-gated
`sex_offender_locations_restricted` table. Stores ONLY level + geom +
a non-reversible hashed source_record_id.

╔══════════════════════════════════════════════════════════════════════╗
║                       SECURITY INVARIANTS                            ║
║                                                                       ║
║  This script MUST NOT:                                               ║
║    - Store offender names                                            ║
║    - Store offender DOBs or aliases                                  ║
║    - Store offender photos                                           ║
║    - Store offender exact street addresses                           ║
║    - Log full address strings to stdout                              ║
║    - Write to the `nearby_concerns` table                            ║
║    - Use the source NSOR ID as-is (we hash it before storing)        ║
║                                                                       ║
║  The ONLY data persisted per offender is:                            ║
║    - level (2 or 3)                                                  ║
║    - geom (PostGIS Point — lat/lng from geocoded address)            ║
║    - source_record_id (SHA-256 hash of NSOR ID, truncated to 32      ║
║                       hex chars — used ONLY for idempotent upserts)  ║
║                                                                       ║
║  The destination table has RLS that DENIES all SELECT to anon and    ║
║  authenticated roles. Only the `count_sex_offenders_near` RPC can    ║
║  read it (SECURITY DEFINER). Defense in depth: even if anon key      ║
║  leaks, the data cannot be exfiltrated row-by-row.                   ║
║                                                                       ║
║  Per spec, this scraper requires HUMAN REVIEW before deploy. Do not  ║
║  run it in production without:                                       ║
║    1. Confirming the destination table RLS is enabled                ║
║    2. Confirming the count RPC works and returns only integers       ║
║    3. Confirming this script writes nothing else                     ║
║                                                                       ║
║  Source registry has its own terms — by running this script you      ║
║  confirm you have authority to query and persist this data per       ║
║  NY State Sex Offender Registration Act and DCJS terms of use.       ║
╚══════════════════════════════════════════════════════════════════════╝

Usage:
    python3 scripts/scrape-nys-sex-offender.py --dry-run    # SAFE: no DB writes, no real fetches
    python3 scripts/scrape-nys-sex-offender.py --confirm    # required flag to actually run

The --confirm flag is intentional friction. Without it, the script exits
immediately with a reminder of the security invariants above. This makes
it nearly impossible to accidentally run via a misconfigured cron.
"""

import argparse
import hashlib
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

# Env loading (same pattern as siblings)
env_path = Path(__file__).parent.parent / ".env.local"
env = {}
if env_path.exists():
    for line in env_path.read_text().splitlines():
        if "=" in line and not line.strip().startswith("#"):
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")

SUPABASE_URL = (os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or env.get("NEXT_PUBLIC_SUPABASE_URL", "")).strip()
SERVICE_KEY = (os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("SUPABASE_SERVICE_ROLE_KEY", "")).strip()

import requests
from scrapling import StealthyFetcher
from supabase import create_client

# Restricted target table — NOT nearby_concerns
RESTRICTED_TABLE = "sex_offender_locations_restricted"

DCJS_SEARCH_URL = "https://www.criminaljustice.ny.gov/SomsSUBDirectory/search_index.jsp"

NYC_COUNTIES = ["Bronx", "Kings", "Queens", "New York", "Richmond"]

# Pattern for NYS Sex Offender Registry IDs — typically a numeric or alphanumeric
# token. Used ONLY to derive the hashed source_record_id; never persisted raw.
NSOR_ID_RE = re.compile(r"(?:NSOR|REGNUM|SUBJECT)[\s:#]+([A-Z0-9-]{4,20})", re.IGNORECASE)


def hash_source_id(nsor_id: str) -> str:
    """Non-reversible stable ID for upsert idempotency. Truncated to 32 hex."""
    return hashlib.sha256(f"nsor:{nsor_id}".encode()).hexdigest()[:32]


def geocode_silent(address: str, borough: str | None = None) -> tuple[float, float] | None:
    """
    Geocode via NYC PlanningLabs. The address string is sent to a public
    endpoint (planninglabs.nyc) which is the legitimate use of this data
    — the address is what we use to compute geom. The address is NEVER
    written to our DB or logged in full.
    """
    if not address:
        return None
    query = f"{address}, {borough}, NY" if borough else f"{address}, New York, NY"
    try:
        res = requests.get(
            "https://geosearch.planninglabs.nyc/v2/search",
            params={"text": query, "size": 1}, timeout=10,
        )
        features = res.json().get("features", [])
        if not features:
            return None
        coords = features[0]["geometry"]["coordinates"]
        return (coords[1], coords[0])
    except Exception:
        # Intentionally swallow the address — do not log it
        return None


def safe_log(msg: str) -> None:
    """Redact anything that looks like a street address before printing."""
    redacted = re.sub(
        r"\d{1,5}\s+[A-Z][A-Za-z0-9.\- ]{3,60}(?:Street|St\.?|Avenue|Ave\.?|Road|Rd\.?|Boulevard|Blvd\.?|Place|Pl\.?|Drive|Dr\.?|Way|Lane|Ln\.?)",
        "[ADDRESS REDACTED]",
        msg,
        flags=re.IGNORECASE,
    )
    print(redacted)


def fetch_county_offenders(county: str) -> list[dict]:
    """
    Fetch level 2 / 3 offender records for one NYC county.

    Returns ephemeral list of {nsor_id, level, address}. Caller is
    responsible for immediately geocoding and discarding name/address.
    """
    # The DCJS site has a terms-acceptance interstitial. scrapling with
    # real_chrome=True handles JS-driven flows.
    try:
        page = StealthyFetcher.fetch(DCJS_SEARCH_URL, real_chrome=True)
        html = page.html_content if hasattr(page, "html_content") else str(page)
    except Exception as e:
        safe_log(f"  fetch failed for {county}: {e}")
        return []

    # The actual scrape requires submitting a county-filtered form POST
    # against the search backend, then iterating result pages. The DCJS
    # backend HTML structure is not publicly documented and changes
    # occasionally. The implementation below is a best-effort skeleton:
    # extract any (level, address) pairs visible on the initial page.
    # First real-world run will require tuning against the actual
    # post-search HTML.
    #
    # IMPORTANT: when tuning, do NOT add print statements that include
    # raw address or name strings. Use `safe_log()` for everything.
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text)

    records = []
    # Heuristic: look for "Level 2" or "Level 3" near an address pattern
    addr_re = re.compile(
        r"(\d{1,5}\s+[A-Z][A-Za-z0-9.\- ]{3,60}(?:Street|St\.?|Avenue|Ave\.?|Road|Rd\.?|Boulevard|Blvd\.?|Place|Pl\.?|Drive|Dr\.?))",
        re.IGNORECASE,
    )
    level_re = re.compile(r"Level\s*([23])", re.IGNORECASE)

    for am in addr_re.finditer(text):
        ctx = text[max(0, am.start() - 300):min(len(text), am.end() + 300)]
        lm = level_re.search(ctx)
        if not lm:
            continue
        level = int(lm.group(1))
        # Pull a stable per-offender ID from context if present
        idm = NSOR_ID_RE.search(ctx)
        nsor_id = idm.group(1) if idm else None
        # Fallback: hash the address itself if no ID found. Acceptable because
        # the address is immediately discarded after this list is consumed.
        if not nsor_id:
            nsor_id = f"addr:{hashlib.sha256(am.group(1).encode()).hexdigest()[:16]}"
        records.append({
            "nsor_id": nsor_id,
            "level": level,
            "address": am.group(1).strip(),  # consumed by caller, never persisted
            "borough_hint": county,
        })

    safe_log(f"  county {county}: {len(records)} candidate L2/L3 offenders")
    return records


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dry-run", action="store_true", help="No DB writes, no real fetches")
    parser.add_argument(
        "--confirm",
        action="store_true",
        help="Required to actually run against the DCJS site and write to the restricted table",
    )
    args = parser.parse_args()

    if not args.confirm and not args.dry_run:
        print("ERROR: this scraper requires --confirm to run.")
        print("Run with --dry-run for safe testing, or --confirm if you have read the")
        print("SECURITY INVARIANTS block at the top of this file and accept responsibility.")
        sys.exit(1)

    if not SUPABASE_URL or not SERVICE_KEY:
        print("ERROR: missing env vars")
        sys.exit(1)

    print("=" * 70)
    print("NYS DCJS Sex Offender Registry sync — RESTRICTED TABLE")
    print("Writes ONLY: level + geom + hashed_id")
    print("=" * 70)

    supabase = None if args.dry_run else create_client(SUPABASE_URL, SERVICE_KEY)
    all_rows = []
    now = datetime.now(timezone.utc).isoformat()

    if args.dry_run:
        print("\n[DRY RUN] Skipping real DCJS fetch. The real flow would:")
        print("  1. Submit a county-filtered search to DCJS")
        print("  2. Iterate result pages, extracting (level, address) pairs")
        print("  3. Geocode each address via NYC PlanningLabs")
        print("  4. Discard name/address — keep only level + lat/lng + hashed ID")
        print("  5. Upsert rows into sex_offender_locations_restricted")
        return

    for county in NYC_COUNTIES:
        safe_log(f"\n=== {county} County ===")
        offenders = fetch_county_offenders(county)
        for o in offenders:
            coords = geocode_silent(o["address"], o.get("borough_hint"))
            # IMMEDIATELY drop the address — do not retain it anywhere
            del o["address"]
            if not coords:
                continue
            lat, lng = coords
            all_rows.append({
                "metro": "nyc",
                "level": o["level"],
                "geom": f"SRID=4326;POINT({lng} {lat})",
                "source": "nys_dcjs",
                "source_record_id": hash_source_id(o["nsor_id"]),
                "last_synced": now,
            })
        time.sleep(2)

    safe_log(f"\n=== {len(all_rows)} restricted rows ready ===")

    if not all_rows:
        print("No rows to write — this is expected if the DCJS HTML changed and the")
        print("regex parser hasn't been tuned to the new markup. Check the page source")
        print("and adjust addr_re / level_re in fetch_county_offenders().")
        return

    BATCH = 100
    for i in range(0, len(all_rows), BATCH):
        batch = all_rows[i:i + BATCH]
        try:
            supabase.table(RESTRICTED_TABLE).upsert(
                batch, on_conflict="source,source_record_id"
            ).execute()
            print(f"  upserted batch of {len(batch)} to {RESTRICTED_TABLE}")
        except Exception as e:
            print(f"  upsert failed: {e}")

    print(f"Done — {len(all_rows)} rows written to {RESTRICTED_TABLE}")
    print()
    print("Sanity check the count RPC:")
    print(f"  SELECT count_sex_offenders_near(40.7679, -73.9819, 1207);")


if __name__ == "__main__":
    main()

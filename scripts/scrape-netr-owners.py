#!/usr/bin/env python3
"""
Scrape property owner names from NETR Online (datastore.netronline.com)
using LA County Registrar-Recorder deed index.

Uses simple HTTP POST with concurrent workers for speed.

Usage:
    python3 scripts/scrape-netr-owners.py                      # default 20 workers
    python3 scripts/scrape-netr-owners.py --concurrency=50      # 50 workers
    python3 scripts/scrape-netr-owners.py --limit=100           # first 100
    python3 scripts/scrape-netr-owners.py --zip=90028           # single zip
    python3 scripts/scrape-netr-owners.py --ain=6072027021      # test single AIN
    python3 scripts/scrape-netr-owners.py --dry-run             # preview without writes
"""

import json
import os
import re
import sys
import time
import argparse
import threading
from pathlib import Path
from datetime import datetime, timezone
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

SUPABASE_URL = (os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or env.get("NEXT_PUBLIC_SUPABASE_URL", "")).strip()
SERVICE_KEY = (os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("SUPABASE_SERVICE_ROLE_KEY", "")).strip()

if not SUPABASE_URL or not SERVICE_KEY:
    print("ERROR: Missing SUPABASE_URL or SERVICE_KEY in .env.local")
    sys.exit(1)

import requests
from supabase import create_client

supabase = create_client(SUPABASE_URL, SERVICE_KEY)

# ── CONFIG ───────────────────────────────────────────────────────────────────
NETR_SEARCH_URL = "https://datastore.netronline.com/lasearch"
PROGRESS_FILE = Path(__file__).parent / ".netr-owner-progress.json"

# Thread-safe stats
lock = threading.Lock()
stats = {"found": 0, "no_deeds": 0, "errors": 0, "updated": 0, "processed": 0}


def normalize_ain(apn: str) -> str:
    return re.sub(r"[\s\-]", "", apn).strip()


def search_netr(session: requests.Session, ain: str) -> dict | None:
    try:
        resp = session.post(
            NETR_SEARCH_URL,
            data={"ain": ain, "page": "1"},
            timeout=15,
        )
        if not resp.ok:
            return None

        data = resp.json()
        if not data or len(data) < 2:
            return None

        if "0 documents" in data[0]:
            return None

        return parse_deeds(data[1])
    except Exception:
        return None


def parse_deeds(html: str) -> dict | None:
    if not html:
        return None

    rows = re.findall(r"<tr>(.*?)</tr>", html, re.DOTALL)
    deeds = []

    for row in rows:
        cells = re.findall(r"<td[^>]*>(.*?)</td>", row, re.DOTALL)
        if len(cells) < 5:
            continue

        date_str = re.sub(r"<[^>]+>", "", cells[1]).strip()
        type_raw = re.sub(r"<[^>]+>", " ", cells[2]).strip()
        grantees = re.sub(r"<[^>]+>", " ", cells[4]).strip()
        grantees = re.sub(r"\s+", " ", grantees).strip()

        type_clean = re.sub(r"Add to cart", "", type_raw).strip().upper()

        deed_types = {"DEED", "GRANT DEED", "QUITCLAIM", "QUIT CLAIM",
                      "WARRANTY DEED", "SPECIAL WARRANTY DEED",
                      "INTERSPOUSAL DEED", "GIFT DEED"}

        if not any(dt in type_clean for dt in deed_types):
            continue

        if not grantees or grantees.lower() in ("", "n/a", "none"):
            continue

        deeds.append({"date": date_str, "grantee": grantees})

    if not deeds:
        return None

    deeds.sort(key=lambda d: d.get("date", ""), reverse=True)
    return {"owner_name": deeds[0]["grantee"], "deed_date": deeds[0].get("date")}


def process_building(bldg: dict, dry_run: bool) -> tuple[str, str | None]:
    """Process one building. Returns (id, owner_name or None)."""
    ain = normalize_ain(bldg["apn"])

    # Each thread gets its own session for connection pooling
    thread_local = threading.local()
    if not hasattr(thread_local, "session"):
        thread_local.session = requests.Session()
        thread_local.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            "X-Requested-With": "XMLHttpRequest",
            "Referer": "https://datastore.netronline.com/losangeles",
        })

    result = search_netr(thread_local.session, ain)

    if result and result.get("owner_name"):
        owner = result["owner_name"][:200]

        if not dry_run:
            try:
                supabase.table("buildings").update({
                    "owner_name": owner,
                }).eq("id", bldg["id"]).execute()
                with lock:
                    stats["updated"] += 1
            except Exception:
                pass

        with lock:
            stats["found"] += 1
            stats["processed"] += 1
        return (bldg["id"], owner)
    else:
        with lock:
            stats["no_deeds"] += 1
            stats["processed"] += 1
        return (bldg["id"], None)


# Thread-local sessions for connection pooling
_thread_locals = threading.local()

def get_session():
    if not hasattr(_thread_locals, "session"):
        _thread_locals.session = requests.Session()
        _thread_locals.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            "X-Requested-With": "XMLHttpRequest",
            "Referer": "https://datastore.netronline.com/losangeles",
        })
    return _thread_locals.session


def process_one(bldg: dict, dry_run: bool) -> tuple[str, str | None]:
    """Process one building with thread-local session."""
    ain = normalize_ain(bldg["apn"])
    session = get_session()
    result = search_netr(session, ain)

    if result and result.get("owner_name"):
        owner = result["owner_name"][:200]

        if not dry_run:
            try:
                supabase.table("buildings").update({
                    "owner_name": owner,
                }).eq("id", bldg["id"]).execute()
                with lock:
                    stats["updated"] += 1
            except Exception:
                with lock:
                    stats["errors"] += 1

        with lock:
            stats["found"] += 1
            stats["processed"] += 1
        return (bldg.get("full_address", "?"), owner)
    else:
        with lock:
            stats["no_deeds"] += 1
            stats["processed"] += 1
        return (bldg.get("full_address", "?"), None)


def load_buildings(args) -> list:
    query = (
        supabase.table("buildings")
        .select("id, apn, full_address, zip_code")
        .eq("metro", "los-angeles")
        .is_("owner_name", "null")
        .not_.is_("apn", "null")
    )

    if args.zip:
        query = query.eq("zip_code", args.zip)

    all_buildings = []
    page_size = 1000
    offset = 0

    while True:
        resp = query.range(offset, offset + page_size - 1).execute()
        batch = resp.data or []
        all_buildings.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size

    if args.limit:
        all_buildings = all_buildings[: args.limit]

    return all_buildings


def save_progress():
    PROGRESS_FILE.write_text(json.dumps({
        "stats": dict(stats),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int)
    parser.add_argument("--zip", type=str)
    parser.add_argument("--ain", type=str)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--concurrency", type=int, default=20, help="Number of concurrent workers (default: 20)")
    args = parser.parse_args()

    print("=== NETR Online Owner Scraper (Concurrent) ===")
    print(f"Started: {datetime.now(timezone.utc).isoformat()}")
    print(f"Mode: {'DRY RUN' if args.dry_run else 'LIVE'}")
    print(f"Concurrency: {args.concurrency} workers")
    print()

    # Single AIN test
    if args.ain:
        ain = normalize_ain(args.ain)
        session = requests.Session()
        session.headers.update({
            "User-Agent": "Mozilla/5.0",
            "X-Requested-With": "XMLHttpRequest",
            "Referer": "https://datastore.netronline.com/losangeles",
        })
        result = search_netr(session, ain)
        if result:
            print(f"  Owner: {result['owner_name']}")
            print(f"  Deed date: {result.get('deed_date')}")
        else:
            print("  No deed records found")
        return

    # Load buildings
    buildings = load_buildings(args)
    total = len(buildings)
    print(f"Found {total} LA buildings with APN but no owner_name")

    if not buildings:
        print("Nothing to do.")
        return

    start_time = time.time()
    last_report = time.time()

    with ThreadPoolExecutor(max_workers=args.concurrency) as executor:
        futures = {
            executor.submit(process_one, bldg, args.dry_run): i
            for i, bldg in enumerate(buildings)
        }

        for future in as_completed(futures):
            idx = futures[future]
            try:
                addr, owner = future.result()
            except Exception as e:
                with lock:
                    stats["errors"] += 1
                    stats["processed"] += 1

            # Progress report every 5 seconds
            now = time.time()
            if now - last_report >= 5:
                with lock:
                    processed = stats["processed"]
                    found = stats["found"]
                    elapsed = now - start_time
                    rate = processed / elapsed if elapsed > 0 else 0
                    pct = found / max(processed, 1) * 100
                    eta_sec = (total - processed) / rate if rate > 0 else 0
                    eta_min = eta_sec / 60

                    print(
                        f"  [{processed}/{total}] "
                        f"{found} owners ({pct:.1f}%) | "
                        f"{rate:.0f}/sec | "
                        f"ETA: {eta_min:.0f}min"
                    )
                    last_report = now
                    save_progress()

    # Final save
    save_progress()
    elapsed = time.time() - start_time

    print()
    print("=== Summary ===")
    print(f"Total processed: {stats['processed']}")
    print(f"Owners found:    {stats['found']} ({stats['found']/max(total,1)*100:.1f}%)")
    print(f"No deed records: {stats['no_deeds']}")
    print(f"Errors:          {stats['errors']}")
    print(f"Updated in DB:   {stats['updated']}")
    print(f"Elapsed:         {elapsed/60:.1f} minutes ({elapsed/3600:.1f} hours)")
    print(f"Rate:            {stats['processed']/elapsed:.1f}/sec")
    print(f"Finished: {datetime.now(timezone.utc).isoformat()}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Bulk import Miami-Dade data from ArcGIS FeatureServer into Supabase.
Fetches all pages from each endpoint and upserts into the correct tables.
"""
import json
import os
import ssl
import sys
import urllib.request
from datetime import datetime

ssl._create_default_https_context = ssl._create_unverified_context

from supabase import create_client

SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
sb = create_client(SUPABASE_URL, SUPABASE_KEY)

ARCGIS_BASE = "https://services.arcgis.com/8Pc9XBTAsYuxx9Ny/arcgis/rest/services"
PAGE_SIZE = 2000


def fetch_all_features(service_name, where="1=1", max_records=None):
    """Fetch all features from an ArcGIS FeatureServer, paginating automatically."""
    all_features = []
    offset = 0
    while True:
        url = (
            f"{ARCGIS_BASE}/{service_name}/FeatureServer/0/query"
            f"?where={urllib.parse.quote(where)}"
            f"&outFields=*&resultRecordCount={PAGE_SIZE}&resultOffset={offset}&f=json"
        )
        try:
            with urllib.request.urlopen(url, timeout=60) as resp:
                data = json.load(resp)
        except Exception as e:
            print(f"  Error fetching offset {offset}: {e}")
            break

        features = data.get("features", [])
        if not features:
            break

        all_features.extend(features)
        print(f"  Fetched {len(all_features)} records (page {offset // PAGE_SIZE + 1})...")

        if len(features) < PAGE_SIZE:
            break
        if max_records and len(all_features) >= max_records:
            break
        offset += PAGE_SIZE

    return all_features


def batch_upsert(table, rows, conflict_col, batch_size=500):
    """Upsert rows in batches, deduplicating by conflict column."""
    # Deduplicate within the batch
    seen = set()
    unique_rows = []
    for r in rows:
        key = r.get(conflict_col)
        if key and key not in seen:
            seen.add(key)
            unique_rows.append(r)

    total = 0
    errors = 0
    for i in range(0, len(unique_rows), batch_size):
        batch = unique_rows[i : i + batch_size]
        try:
            sb.table(table).upsert(batch, on_conflict=conflict_col).execute()
            total += len(batch)
        except Exception as e:
            errors += 1
            print(f"  Upsert error batch {i // batch_size + 1}: {e}")
    return total, errors


def parse_address(addr):
    addr = (addr or "").strip()
    if not addr:
        return None, None
    parts = addr.split(" ", 1)
    if len(parts) > 1 and parts[0].replace("-", "").isdigit():
        return parts[0], parts[1]
    return None, addr


def epoch_to_date(ms):
    if not ms:
        return None
    try:
        return datetime.fromtimestamp(int(ms) / 1000).strftime("%Y-%m-%d")
    except:
        return None


def import_violations():
    print("\n=== VIOLATIONS (CodeComplianceViolation_Open_View) ===")
    features = fetch_all_features("CodeComplianceViolation_Open_View")
    rows = []
    for f in features:
        a = f["attributes"]
        cn = a.get("CASE_NUM")
        if not cn:
            continue
        hn, sn = parse_address(a.get("ADDRESS"))
        rows.append({
            "isn_dob_bis_vio": f"MIA-{cn}",
            "issue_date": epoch_to_date(a.get("CASE_DATE")),
            "description": (a.get("PROBLEM_DESC") or "").strip() or None,
            "violation_type": (a.get("STAT_DESC") or "").strip() or None,
            "borough": "Miami-Dade",
            "house_number": hn,
            "street_name": sn,
            "metro": "miami",
        })
    total, errs = batch_upsert("dob_violations", rows, "isn_dob_bis_vio")
    print(f"  DONE: {total} violations imported, {errs} errors")


def import_311():
    print("\n=== 311 COMPLAINTS (data_311_2023) ===")
    features = fetch_all_features("data_311_2023", max_records=10000)
    rows = []
    for f in features:
        a = f["attributes"]
        tid = a.get("ticket_id")
        if not tid:
            continue
        addr = (a.get("street_address") or "").strip()
        rows.append({
            "unique_key": f"MIA-311-{tid}",
            "complaint_type": a.get("issue_type"),
            "descriptor": a.get("issue_description"),
            "incident_address": addr,
            "borough": "Miami-Dade",
            "status": a.get("ticket_status") or "Open",
            "metro": "miami",
        })
    total, errs = batch_upsert("complaints_311", rows, "unique_key")
    print(f"  DONE: {total} complaints imported, {errs} errors")


def import_unsafe_structures():
    print("\n=== UNSAFE STRUCTURES (Open_Building_Violations) ===")
    features = fetch_all_features("Open_Building_Violations")
    rows = []
    for f in features:
        a = f["attributes"]
        cn = a.get("CASE_NUM")
        if not cn:
            continue
        rows.append({
            "case_number": str(cn),
            "address": (a.get("PROP_ADDR") or "").strip(),
            "violation_type": a.get("CASE_TYPE"),
            "case_date": epoch_to_date(a.get("OPEN_DATE")),
            "status": "Closed" if a.get("CLOSED_DATE") else "Open",
            "metro": "miami",
        })
    total, errs = batch_upsert("miami_unsafe_structures", rows, "case_number")
    print(f"  DONE: {total} unsafe structures imported, {errs} errors")


def import_permits():
    print("\n=== PERMITS (BuildingPermit_gdb) ===")
    features = fetch_all_features("BuildingPermit_gdb", max_records=10000)
    rows = []
    for f in features:
        a = f["attributes"]
        proc = a.get("PROCNUM") or a.get("ID")
        if not proc:
            continue
        hn, sn = parse_address(a.get("ADDRESS") or a.get("STNDADDR"))
        rows.append({
            "work_permit": f"MIA-{proc}",
            "work_type": a.get("TYPE"),
            "permit_status": a.get("CAT1"),
            "issued_date": epoch_to_date(a.get("ISSUEDATE")),
            "borough": "Miami-Dade",
            "house_no": hn,
            "street_name": sn,
            "job_description": (a.get("DESC1") or "").strip() or None,
            "metro": "miami",
        })
    total, errs = batch_upsert("dob_permits", rows, "work_permit")
    print(f"  DONE: {total} permits imported, {errs} errors")


if __name__ == "__main__":
    source = sys.argv[1] if len(sys.argv) > 1 else "all"

    if source in ("all", "violations"):
        import_violations()
    if source in ("all", "311"):
        import_311()
    if source in ("all", "unsafe"):
        import_unsafe_structures()
    if source in ("all", "permits"):
        import_permits()

    print("\n=== IMPORT COMPLETE ===")

#!/usr/bin/env python3
"""
Scrape incident-level crime data for Miami-Dade from CrimeMapping.com.

CrimeMapping.com aggregates incident reports submitted by local agencies via
CentralSquare's CrimeView product. For Miami-Dade we observe two participating
agencies: "Miami Police" (id=232) and "Miami-Dade Sheriff's Office" (id=233).

ENDPOINTS (reverse-engineered):
  POST /map/MapUpdated
    Body (form-urlencoded):
      filterdata={ "SelectedCategories": ["1".."15"],
                   "SpatialFilter": { "FilterType": 2,
                                      "Filter": "{\"rings\":[[[xmin,ymin],...]],\"spatialReference\":{\"wkid\":102100}}" },
                   "TemporalFilter": { "FilterType": "Explicit",
                                       "ExplicitStartDate": "YYYYMMDD",
                                       "ExplicitEndDate":   "YYYYMMDD" },
                   "AgencyFilter": [] }
      shareMapID=&shareMapExtent=&alertID=&spatfilter=<same rings JSON>
    Returns: { result: { or:[agencies], nr:totalCount,
                         rs:[ {x, y, l:categoryId, i:[uuid,...]}, ... ] } }
    NOTE: Web Mercator EPSG:3857. l=category id (see CATEGORY_MAP).
          The /map response *caps* clusters at ~200; tile finely.

  POST /map/GetDetailRecordInfoJson
    Body: IDs[]=0_<uuid>&IDs[]=...&x=&y=&picx=lat&picy=lon
          &suggestNumCharacters=3&whatAttributeCategories=<JSON same as map>
    Returns RecordList[]: { rd:"YYYYMMDDHHMM", de:"DESCRIPTION", cn:"caseNum",
                            id:"0_<uuid>", lid:categoryId, oid:agencyId,
                            na:"agencyName", ad:"GENERALIZED ADDRESS" }

LEGAL / TOS NOTE
================
CrimeMapping.com terms have historically prohibited automated scraping. The
underlying data is public-record incident reports submitted by police
agencies to CentralSquare CrimeView; the ultimate source of truth for any
agency's incidents is the agency itself (e.g. miamidade.gov public reports).
This scraper is intended as a temporary bridge until we can ingest data
directly from each agency's public-records API. Re-evaluate periodically:
  - Has the agency published a direct feed (Socrata/ArcGIS REST/etc.)?
  - Has CrimeMapping.com added a rate limit or hard block?
  - Has TOS changed?
Run politely (2-5s between requests). On any CAPTCHA/block, STOP.

Usage:
    python3 scripts/scrape-miami-crime.py --zips=33139,33130 --days=30 --dry-run
    python3 scripts/scrape-miami-crime.py --zips=33139 --days=30
    python3 scripts/scrape-miami-crime.py --bbox=-80.20,25.75,-80.13,25.80 --days=7
"""

import argparse
import json
import math
import os
import random
import re
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlencode

# ── ENV ──────────────────────────────────────────────────────────────────────
env_path = Path(__file__).parent.parent / ".env.local"
env = {}
if env_path.exists():
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"').replace("\\n", "")

SUPABASE_URL = (os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or env.get("NEXT_PUBLIC_SUPABASE_URL", "")).strip().replace("\\n", "")
SERVICE_KEY = (os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("SUPABASE_SERVICE_ROLE_KEY", "")).strip().replace("\\n", "")

if not SUPABASE_URL or not SERVICE_KEY:
    print("ERROR: Missing SUPABASE_URL or SERVICE_KEY in .env.local")
    sys.exit(1)

from playwright.sync_api import sync_playwright  # noqa: E402
from supabase import create_client  # noqa: E402

supabase = create_client(SUPABASE_URL, SERVICE_KEY)

# ── CONFIG ───────────────────────────────────────────────────────────────────
BASE = "https://www.crimemapping.com"
LANDING = f"{BASE}/map/fl/miami-dadecounty"
MAP_UPDATED = f"{BASE}/map/MapUpdated"
DETAIL = f"{BASE}/map/GetDetailRecordInfoJson"
PROGRESS_DIR = Path(__file__).parent / "progress"
PROGRESS_DIR.mkdir(parents=True, exist_ok=True)
PROGRESS_FILE = PROGRESS_DIR / "miami-crime.json"  # may be overridden via --progress-file

REQUEST_DELAY_MIN = float(os.environ.get("CM_DELAY_MIN", "2.0"))
REQUEST_DELAY_MAX = float(os.environ.get("CM_DELAY_MAX", "5.0"))
DETAIL_BATCH_SIZE = 8  # number of UUIDs per detail call (mirrors site behavior)
MAX_RETRIES = 3
CLUSTER_CAP = 200  # API truncates results above this; subdivide tile when hit

# Web Mercator constants
EARTH_RADIUS_M = 6378137.0

USER_AGENTS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
]

# ── CATEGORY MAP ─────────────────────────────────────────────────────────────
# CrimeMapping legend id → (offense_description, crime_category, law_category)
# crime_category bucket aligns with _data.ts categorization:
#   violent | property | quality_of_life
# law_category mirrors NYS levels: FELONY / MISDEMEANOR / VIOLATION
CATEGORY_MAP = {
    1:  ("ARSON",                    "property",         "FELONY"),
    2:  ("ASSAULT",                  "violent",          "FELONY"),
    3:  ("BURGLARY",                 "property",         "FELONY"),
    4:  ("DISTURBING THE PEACE",     "quality_of_life",  "MISDEMEANOR"),
    5:  ("DRUGS / ALCOHOL",          "quality_of_life",  "MISDEMEANOR"),
    6:  ("DUI",                      "quality_of_life",  "MISDEMEANOR"),
    7:  ("FRAUD",                    "property",         "FELONY"),
    8:  ("HOMICIDE",                 "violent",          "FELONY"),
    9:  ("MOTOR VEHICLE THEFT",      "property",         "FELONY"),
    10: ("ROBBERY",                  "violent",          "FELONY"),
    11: ("SEX CRIMES",               "violent",          "FELONY"),
    12: ("THEFT / LARCENY",          "property",         "MISDEMEANOR"),
    13: ("VANDALISM",                "property",         "MISDEMEANOR"),
    14: ("VEHICLE BREAK-IN / THEFT", "property",         "FELONY"),
    15: ("WEAPONS",                  "violent",          "FELONY"),
}
SCRAPED_CATEGORIES = list(CATEGORY_MAP.keys())  # exclude 17/18 (sex offender registry, not incidents)

# Same JSON the site sends in `whatAttributeCategories`
WHAT_ATTRIBUTE_CATEGORIES_JSON = json.dumps([
    {"id": 1,  "na": "Arson"},
    {"id": 2,  "na": "Assault"},
    {"id": 3,  "na": "Burglary"},
    {"id": 4,  "na": "Disturbing the Peace"},
    {"id": 5,  "na": "Drugs / Alcohol Violations"},
    {"id": 6,  "na": "DUI"},
    {"id": 7,  "na": "Fraud"},
    {"id": 8,  "na": "Homicide"},
    {"id": 9,  "na": "Motor Vehicle Theft"},
    {"id": 10, "na": "Robbery"},
    {"id": 11, "na": "Sex Crimes"},
    {"id": 12, "na": "Theft / Larceny"},
    {"id": 13, "na": "Vandalism"},
    {"id": 14, "na": "Vehicle Break-In / Theft"},
    {"id": 15, "na": "Weapons"},
], separators=(",", ":"))

# ── ZIP CENTROIDS ────────────────────────────────────────────────────────────
# Miami-Dade ZIP centroids and an approximate 0.5x0.5 mile bounding box.
# Bounding boxes are intentionally larger than a single ZIP — we filter by
# ZIP after the fact based on lat/lng.
# (These cover South Beach, Brickell, Downtown, Wynwood, Little Havana, Coconut Grove)
ZIP_BBOXES = {
    # zip: (min_lng, min_lat, max_lng, max_lat)
    # Auto-derived from buildings.{latitude,longitude} for metro='miami', padded ±0.005°.
    # Covers all 95 Miami-Dade core zips with at least one geocoded building in our DB.
    "33004": (-80.171, 26.0288, -80.1255, 26.068),
    "33009": (-80.1775, 25.9691, -80.1133, 26.0021),
    "33010": (-80.3166, 25.8048, -80.2562, 25.8527),
    "33012": (-80.3424, 25.8097, -80.2772, 25.889),
    "33013": (-80.2875, 25.8332, -80.2551, 25.8864),
    "33014": (-80.3273, 25.8576, -80.2744, 25.9297),
    "33015": (-80.3477, 25.9183, -80.2889, 25.9618),
    "33016": (-80.354, 25.858, -80.3189, 25.9324),
    "33018": (-80.4582, 25.853, -80.307, 25.9594),
    "33019": (-80.2761, 25.9817, -80.1077, 26.0576),
    "33020": (-80.2098, 25.9908, -80.1158, 26.0267),
    "33021": (-80.2363, 25.9871, -80.1602, 26.0383),
    "33023": (-80.2416, 25.9559, -80.171, 26.0085),
    "33024": (-80.3206, 25.973, -80.1953, 26.0411),
    "33025": (-80.3025, 25.9596, -80.1888, 26.011),
    "33026": (-80.3221, 25.9864, -80.2554, 26.0292),
    "33027": (-80.3851, 25.9648, -80.2794, 26.0322),
    "33028": (-80.3651, 25.9886, -80.2941, 26.0249),
    "33029": (-80.4255, 25.9686, -80.3236, 26.0356),
    "33030": (-80.499, 25.4648, -80.4134, 25.5111),
    "33031": (-80.5063, 25.4982, -80.4316, 25.5421),
    "33032": (-80.4438, 25.5183, -80.3504, 25.5779),
    "33033": (-80.5006, 25.4779, -80.3924, 25.5481),
    "33034": (-80.5841, 25.404, -80.4602, 25.5113),
    "33035": (-80.4897, 25.4427, -80.4334, 25.4842),
    "33054": (-80.2881, 25.9087, -80.2233, 25.9518),
    "33055": (-80.3171, 25.913, -80.2622, 25.961),
    "33056": (-80.3027, 25.9356, -80.2374, 25.9819),
    "33109": (-80.1589, 25.7516, -80.1308, 25.7779),
    "33113": (-80.4046, 25.5969, -80.394, 25.6062),
    "33122": (-80.3544, 25.7728, -80.2895, 25.8117),
    "33125": (-80.2952, 25.7649, -80.2099, 25.8001),
    "33126": (-80.3535, 25.755, -80.2542, 25.7993),
    "33127": (-80.2295, 25.8059, -80.1908, 25.844),
    "33128": (-80.2155, 25.7728, -80.1956, 25.7913),
    "33129": (-80.2173, 25.7516, -80.187, 25.7762),
    "33130": (-80.2363, 25.7611, -80.1908, 25.7919),
    "33131": (-80.2052, 25.7515, -80.1782, 25.7848),
    "33132": (-80.2127, 25.7754, -80.1798, 25.7991),
    "33133": (-80.2682, 25.7128, -80.2156, 25.7574),
    "33134": (-80.2868, 25.7358, -80.245, 25.7783),
    "33135": (-80.247, 25.7588, -80.215, 25.7868),
    "33136": (-80.2206, 25.7388, -80.1603, 26.1365),
    "33137": (-80.2075, 25.7976, -80.1657, 25.836),
    "33138": (-80.2031, 25.8242, -80.1604, 25.8714),
    "33139": (-80.2427, 25.7258, -80.1218, 25.8096),
    "33140": (-80.1565, 25.8002, -80.1167, 25.8311),
    "33141": (-80.1573, 25.8369, -80.1189, 25.8714),
    "33142": (-80.2849, 25.7872, -80.2059, 25.8409),
    "33143": (-80.3286, 25.6855, -80.2659, 25.7244),
    "33144": (-80.3262, 25.7396, -80.2751, 25.7869),
    "33145": (-80.262, 25.7359, -80.218, 25.7665),
    "33146": (-80.2962, 25.7176, -80.247, 25.7443),
    "33147": (-80.2799, 25.8242, -80.2185, 25.8714),
    "33149": (-80.1928, 25.6804, -80.1396, 25.7522),
    "33150": (-80.2392, 25.8281, -80.1844, 25.8721),
    "33154": (-80.1456, 25.8661, -80.114, 25.9014),
    "33155": (-80.3208, 25.7187, -80.2671, 25.7626),
    "33156": (-80.3266, 25.6379, -80.2667, 25.7081),
    "33157": (-80.3727, 25.5746, -80.2998, 25.6432),
    "33158": (-80.3275, 25.6092, -80.2825, 25.6584),
    "33160": (-80.1751, 25.9085, -80.1149, 25.9593),
    "33161": (-80.2271, 25.866, -80.1646, 25.9082),
    "33162": (-80.2258, 25.9086, -80.1631, 25.9587),
    "33165": (-80.3534, 25.7194, -80.2876, 25.7659),
    "33166": (-80.328, 25.7965, -80.2748, 25.842),
    "33167": (-80.2671, 25.866, -80.2186, 25.9094),
    "33168": (-80.2444, 25.8595, -80.1988, 25.8993),
    "33169": (-80.2666, 25.9088, -80.1881, 25.9509),
    "33170": (-80.4452, 25.5482, -80.3573, 25.6242),
    "33172": (-80.4015, 25.7543, -80.3266, 25.7995),
    "33173": (-80.3871, 25.6917, -80.3208, 25.7234),
    "33174": (-80.3777, 25.7413, -80.3208, 25.7873),
    "33175": (-80.4164, 25.6883, -80.3489, 25.7438),
    "33176": (-80.3849, 25.6258, -80.3209, 25.6905),
    "33177": (-80.4188, 25.581, -80.3478, 25.6443),
    "33178": (-80.4585, 25.7665, -80.3501, 25.853),
    "33179": (-80.2459, 25.9343, -80.1824, 25.971),
    "33180": (-80.181, 25.9383, -80.1167, 25.9776),
    "33181": (-80.2057, 25.8714, -80.1378, 25.9094),
    "33182": (-80.4717, 25.7456, -80.3898, 25.795),
    "33183": (-80.4216, 25.6861, -80.3531, 25.7222),
    "33184": (-80.4231, 25.7165, -80.3679, 25.7468),
    "33185": (-80.4501, 25.6927, -80.3848, 25.7242),
    "33186": (-80.4533, 25.6253, -80.3683, 25.6893),
    "33187": (-80.5089, 25.5599, -80.3996, 25.6359),
    "33189": (-80.4017, 25.5532, -80.3326, 25.5897),
    "33190": (-80.3852, 25.5538, -80.3239, 25.5853),
    "33191": (-80.3823, 25.5772, -80.3633, 25.5961),
    "33193": (-80.4673, 25.6577, -80.3897, 25.7059),
    "33194": (-80.4763, 25.7159, -80.4095, 25.7458),
    "33195": (-80.4248, 25.7592, -80.4042, 25.7785),
    "33196": (-80.4933, 25.6258, -80.4076, 25.6789),
    "33198": (-80.4763, 25.7654, -80.3963, 25.7916),
    "33199": (-80.3985, 25.7361, -80.3672, 25.7644),
}

# ── HELPERS ──────────────────────────────────────────────────────────────────
def ll_to_merc(lng: float, lat: float) -> tuple[float, float]:
    """Convert lng/lat (WGS84) to EPSG:3857 (Web Mercator)."""
    x = EARTH_RADIUS_M * math.radians(lng)
    y = EARTH_RADIUS_M * math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))
    return x, y


def merc_to_ll(x: float, y: float) -> tuple[float, float]:
    """Convert EPSG:3857 to (lng, lat)."""
    lng = math.degrees(x / EARTH_RADIUS_M)
    lat = math.degrees(2 * math.atan(math.exp(y / EARTH_RADIUS_M)) - math.pi / 2)
    return lng, lat


def bbox_to_rings(bbox: tuple[float, float, float, float]) -> str:
    """bbox (min_lng, min_lat, max_lng, max_lat) → ESRI rings JSON string in 3857."""
    minx, miny = ll_to_merc(bbox[0], bbox[1])
    maxx, maxy = ll_to_merc(bbox[2], bbox[3])
    rings = {
        "rings": [[[minx, miny], [minx, maxy], [maxx, maxy], [maxx, miny], [minx, miny]]],
        "spatialReference": {"wkid": 102100},
    }
    return json.dumps(rings, separators=(",", ":"))


def parse_rd(rd: str) -> str | None:
    """RecordList rd is 'YYYYMMDDHHMM'. Return ISO date 'YYYY-MM-DD'."""
    if not rd or len(rd) < 8:
        return None
    return f"{rd[0:4]}-{rd[4:6]}-{rd[6:8]}"


def polite_sleep():
    time.sleep(random.uniform(REQUEST_DELAY_MIN, REQUEST_DELAY_MAX))


# ── PROGRESS ─────────────────────────────────────────────────────────────────
def load_progress() -> dict:
    if PROGRESS_FILE.exists():
        try:
            return json.loads(PROGRESS_FILE.read_text())
        except Exception:
            pass
    return {"completed_zips": [], "fetched_uuids": [], "stats": {}}


def save_progress(progress: dict):
    PROGRESS_FILE.write_text(json.dumps(progress, indent=2))


# ── HTTP via Scrapling (gets us through the WAF) ─────────────────────────────
class CrimeMappingClient:
    """Maintains a Chrome session via Playwright with a real Chromium browser.

    We open the landing page once so the F5/Akamai-class WAF challenge passes
    and the ASP.NET session cookie is set. Then we fire all subsequent XHR
    requests from inside the page context via page.evaluate(fetch …), which
    keeps the session cookie + WAF fingerprint intact. This mirrors how the
    site's own JS issues requests.
    """

    def __init__(self):
        self._pw = None
        self._browser = None
        self._context = None
        self._page = None
        self.req_count = 0

    def warmup(self):
        try:
            self._pw = sync_playwright().start()
            self._browser = self._pw.chromium.launch(headless=True)
            self._context = self._browser.new_context(
                viewport={"width": 1280, "height": 900},
                user_agent=random.choice(USER_AGENTS),
                locale="en-US",
            )
            self._page = self._context.new_page()
            self._page.goto(LANDING, wait_until="domcontentloaded", timeout=60000)
            self._page.wait_for_timeout(8000)  # let WAF challenge pass + session cookie settle
            # Sanity check: did /map/LoadPanelsJson respond?
            print("  [warmup] OK")
            return True
        except Exception as e:
            print(f"  [warmup] failed: {e}")
            return False

    def close(self):
        try:
            if self._browser:
                self._browser.close()
            if self._pw:
                self._pw.stop()
        except Exception:
            pass

    def _post_form(self, url: str, body: str) -> dict | None:
        """POST form-urlencoded body via fetch() inside the page; returns parsed JSON."""
        for attempt in range(MAX_RETRIES):
            try:
                result = self._page.evaluate(
                    """async ({url, body}) => {
                        const r = await fetch(url, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                                'X-Requested-With': 'XMLHttpRequest',
                                'Accept': 'application/json, text/javascript, */*; q=0.01'
                            },
                            body: body,
                            credentials: 'include'
                        });
                        const txt = await r.text();
                        return {status: r.status, body: txt};
                    }""",
                    {"url": url, "body": body},
                )
                self.req_count += 1
                if result["status"] != 200:
                    print(f"    [{url.rsplit('/', 1)[-1]}] HTTP {result['status']}")
                    time.sleep(3 * (attempt + 1))
                    continue
                txt = result["body"]
                # Body may be raw JSON or wrapped — try json first, fall back to regex
                try:
                    return json.loads(txt)
                except json.JSONDecodeError:
                    m = re.search(r"\{.*\}", txt, re.DOTALL)
                    if not m:
                        print(f"    [{url.rsplit('/', 1)[-1]}] no JSON in {len(txt)}B body")
                        return None
                    return json.loads(m.group(0))
            except Exception as e:
                print(f"    [{url.rsplit('/', 1)[-1]}] err: {e}")
                time.sleep(3 * (attempt + 1))
        return None

    def map_updated(self, bbox: tuple[float, float, float, float],
                    start: datetime, end: datetime,
                    categories: list[int] | None = None) -> dict | None:
        cats = categories or SCRAPED_CATEGORIES
        rings_json = bbox_to_rings(bbox)
        filterdata = {
            "SelectedCategories": [str(c) for c in cats],
            "SpatialFilter": {
                "FilterType": 2,
                "Filter": rings_json,
            },
            "TemporalFilter": {
                "FilterType": "Explicit",
                "ExplicitStartDate": start.strftime("%Y%m%d"),
                "ExplicitEndDate": end.strftime("%Y%m%d"),
            },
            "AgencyFilter": [],
        }
        spat = json.loads(rings_json)
        spat["spatialReference"]["latestWkid"] = 3857
        form = {
            "filterdata": json.dumps(filterdata, separators=(",", ":")),
            "shareMapID": "",
            "shareMapExtent": "",
            "alertID": "",
            "spatfilter": json.dumps(spat, separators=(",", ":")),
        }
        body = urlencode(form)  # quote_plus (matches site's JS form-encode)
        polite_sleep()
        return self._post_form(MAP_UPDATED, body)

    def detail(self, uuids: list[str], x: float, y: float, lng: float, lat: float) -> dict | None:
        form = [("IDs[]", uid) for uid in uuids] + [
            ("x", f"{x}"),
            ("y", f"{y}"),
            ("picx", f"{lat}"),  # site's JS swaps these — picx is lat
            ("picy", f"{lng}"),
            ("suggestNumCharacters", "3"),
            ("whatAttributeCategories", WHAT_ATTRIBUTE_CATEGORIES_JSON),
            ("offenderDisclaimerAccepted", "false"),
        ]
        # Default urlencode uses quote_plus (spaces → +) which matches the site's JS.
        body = urlencode(form)
        polite_sleep()
        return self._post_form(DETAIL, body)


# ── ZIP ASSIGNMENT ───────────────────────────────────────────────────────────
def find_zip_for_point(lng: float, lat: float, zip_filter: list[str] | None) -> str | None:
    """Return the matching ZIP from ZIP_BBOXES (subset of zip_filter, if any)."""
    candidates = zip_filter or list(ZIP_BBOXES.keys())
    for z in candidates:
        bbox = ZIP_BBOXES.get(z)
        if not bbox:
            continue
        if bbox[0] <= lng <= bbox[2] and bbox[1] <= lat <= bbox[3]:
            return z
    return None


# ── INSERTION ────────────────────────────────────────────────────────────────
def upsert_incidents(rows: list[dict], dry_run: bool) -> int:
    if not rows:
        return 0
    if dry_run:
        print(f"    [DRY] would upsert {len(rows)} rows")
        return len(rows)
    try:
        # nypd_complaints.cmplnt_num is UNIQUE — upsert on that
        # Chunk to avoid oversize payloads
        CHUNK = 200
        n = 0
        for i in range(0, len(rows), CHUNK):
            chunk = rows[i:i + CHUNK]
            supabase.table("nypd_complaints") \
                .upsert(chunk, on_conflict="cmplnt_num") \
                .execute()
            n += len(chunk)
        return n
    except Exception as e:
        print(f"    UPSERT ERR: {e}")
        return 0


# ── PIPELINE ─────────────────────────────────────────────────────────────────
def scrape_bbox(client: CrimeMappingClient, bbox: tuple, start: datetime, end: datetime,
                zip_filter: list[str] | None, dry_run: bool, progress: dict) -> dict:
    """Scrape one bbox over the date range. Returns stats."""
    print(f"  bbox={bbox} start={start.date()} end={end.date()}")
    mu = client.map_updated(bbox, start, end)
    if not mu or "result" not in mu:
        print("    no result, skipping")
        return {"clusters": 0, "incidents": 0, "saved": 0}
    res = mu["result"]
    nr = res.get("nr", 0)
    rs = res.get("rs", [])
    print(f"    clusters={len(rs)} nr={nr}")

    if nr >= CLUSTER_CAP:
        print(f"    ! result truncated at {nr} — consider subdividing")

    # Build map oid → name from `or`
    org_map = {o["id"]: o["na"] for o in res.get("or", [])}

    # Pull cluster->details via batched detail calls
    incident_rows: list[dict] = []
    fetched_uuids = set(progress.get("fetched_uuids", []))

    for cluster in rs:
        ids = cluster.get("i", [])
        cx = cluster.get("x")
        cy = cluster.get("y")
        if cx is None or cy is None or not ids:
            continue
        clng, clat = merc_to_ll(cx, cy)

        # Batch IDs through the detail endpoint
        new_ids = [u for u in ids if u not in fetched_uuids]
        if not new_ids:
            continue

        for j in range(0, len(new_ids), DETAIL_BATCH_SIZE):
            batch = new_ids[j:j + DETAIL_BATCH_SIZE]
            d = client.detail(batch, cx, cy, clng, clat)
            if not d:
                continue
            recs = d.get("RecordList", [])
            for r in recs:
                uid = r.get("id")
                if not uid:
                    continue
                fetched_uuids.add(uid)
                lid = r.get("lid")
                if lid not in CATEGORY_MAP:
                    continue
                offense, crime_cat, law_cat = CATEGORY_MAP[lid]
                date_iso = parse_rd(r.get("rd", ""))
                oid = r.get("oid")
                org_name = r.get("na") or org_map.get(oid, "")
                # zip from cluster centroid (block-level)
                z = find_zip_for_point(clng, clat, zip_filter)
                cmplnt_num = f"CM-{oid}-{uid.split('_', 1)[-1]}"  # CM-<agencyId>-<uuid>
                incident_rows.append({
                    "cmplnt_num": cmplnt_num[:20] if False else cmplnt_num,  # column is varchar(20)
                    "cmplnt_date": date_iso,
                    "borough": None,
                    "precinct": int(oid) if oid is not None else None,
                    "offense_description": (r.get("de") or offense)[:255],
                    "law_category": law_cat,
                    "crime_category": crime_cat,
                    "pd_description": r.get("cn"),  # case number stashed here
                    "latitude": round(clat, 7),
                    "longitude": round(clng, 7),
                    "zip_code": z,
                    "metro": "miami",
                    "raw_data": {
                        "source": "crimemapping.com",
                        "agency_id": oid,
                        "agency_name": org_name,
                        "address": r.get("ad"),
                        "legend_id": lid,
                        "raw_rd": r.get("rd"),
                        "uuid": uid,
                    },
                })

    # cmplnt_num column is varchar(20). Pack a deterministic ID into 20 chars:
    #   "C" + agency-id (3 char zero-pad) + first 16 hex chars of uuid (no dashes)
    #   e.g. C233abcdef0123456789  — agency-prefixed ⇒ collision-resistant
    #   16 hex chars = 64 bits of UUID entropy, collision probability negligible.
    deduped = []
    seen = set()
    for row in incident_rows:
        raw = row["raw_data"]
        oid = raw.get("agency_id") or 0
        uid_clean = (raw.get("uuid", "").split("_", 1)[-1]).replace("-", "")
        key = f"C{int(oid):03d}{uid_clean[:16]}"[:20]
        if key in seen:
            continue
        seen.add(key)
        row["cmplnt_num"] = key
        deduped.append(row)

    saved = upsert_incidents(deduped, dry_run)
    print(f"    incidents={len(deduped)} saved={saved} requests={client.req_count}")

    # Persist progress
    progress["fetched_uuids"] = list(fetched_uuids)[-50000:]  # cap
    save_progress(progress)

    return {"clusters": len(rs), "incidents": len(deduped), "saved": saved}


# ── MAIN ─────────────────────────────────────────────────────────────────────
def main():
    p = argparse.ArgumentParser(description="Scrape Miami-Dade incident-level crime from CrimeMapping.com")
    p.add_argument("--zips", type=str, default="33139,33130", help="Comma-sep ZIPs to scrape")
    p.add_argument("--bbox", type=str, default="", help="Single bbox: min_lng,min_lat,max_lng,max_lat")
    p.add_argument("--days", type=int, default=30, help="How many days back from today")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--reset-progress", action="store_true")
    p.add_argument("--progress-file", type=str, default="", help="Override progress file name (e.g. miami-a.json) — required for parallel runs to avoid race conditions")
    args = p.parse_args()

    if args.progress_file:
        global PROGRESS_FILE
        PROGRESS_FILE = PROGRESS_DIR / args.progress_file

    if args.reset_progress and PROGRESS_FILE.exists():
        PROGRESS_FILE.unlink()
        print("Progress reset.")

    progress = load_progress()
    end = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    start = end - timedelta(days=args.days)

    print(f"Scraping CrimeMapping (Miami-Dade)")
    print(f"  date range: {start.date()} → {end.date()}")
    print(f"  dry_run: {args.dry_run}")
    print(f"  scraped UUIDs already on file: {len(progress.get('fetched_uuids', []))}")

    client = CrimeMappingClient()
    print("Warming up session…")
    if not client.warmup():
        print("WARMUP FAILED — aborting.")
        sys.exit(1)

    targets: list[tuple[str, tuple]] = []
    if args.bbox:
        parts = [float(x) for x in args.bbox.split(",")]
        targets.append(("custom", tuple(parts)))
        zip_filter = None
    else:
        zip_filter = [z.strip() for z in args.zips.split(",") if z.strip()]
        for z in zip_filter:
            if z not in ZIP_BBOXES:
                print(f"  ! ZIP {z} not in ZIP_BBOXES — skipping")
                continue
            targets.append((z, ZIP_BBOXES[z]))

    totals = {"clusters": 0, "incidents": 0, "saved": 0}
    for label, bbox in targets:
        print(f"\n=== {label} ===")
        # Window the date range into ≤7-day chunks to stay under the 200-cluster cap
        cur = start
        while cur < end:
            chunk_end = min(end, cur + timedelta(days=7))
            stats = scrape_bbox(client, bbox, cur, chunk_end, zip_filter, args.dry_run, progress)
            for k in totals:
                totals[k] += stats[k]
            cur = chunk_end

    print("\n=== DONE ===")
    print(f"  clusters: {totals['clusters']}")
    print(f"  incidents: {totals['incidents']}")
    print(f"  saved:     {totals['saved']}")
    print(f"  http requests: {client.req_count}")
    client.close()


if __name__ == "__main__":
    main()

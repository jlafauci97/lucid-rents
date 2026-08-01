#!/usr/bin/env node
/**
 * ETL pipeline: corporate owner backfill from county assessor history.
 *
 * Scope:
 *   - 5 metros (NYC, LA, Chicago, Houston, Miami) via FIPS county codes
 *   - Multifamily only (UNITSCOUNT >= 2; PROPERTYUSESTANDARDIZED excludes single family)
 *   - Company owners only (drops individuals — upstream only provides last names
 *     for them, which is unusable)
 *   - Most recent assessment year per parcel
 *
 * Match: APN → normalized address+zip → lat/lng proximity (~50m).
 *
 * Writes:
 *   - buildings.owner_name (when null, or always with --overwrite-owner)
 *   - buildings.owner_type = 'company'
 *   - building_ownership_records (full provenance, one row per parcel-year)
 *
 * Unmatched multifamily parcels are NOT inserted as new buildings. They're
 * written to data/attom-sidelined-multifamily-{metro}.json for per-city review.
 *
 * Usage:
 *   node scripts/etl-attom-owners.mjs --dry-run
 *   node scripts/etl-attom-owners.mjs --page-start=1 --page-end=5
 *   node scripts/etl-attom-owners.mjs --skip-download
 *   node scripts/etl-attom-owners.mjs --overwrite-owner
 *   node scripts/etl-attom-owners.mjs --reset
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";
import { createClient } from "@supabase/supabase-js";

// ── ENV ─────────────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const env = {};
for (const envFile of [".env.local", ".env.production.local"]) {
  try {
    const envPath = resolve(__dirname, "..", envFile);
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) {
        const key = m[1].trim();
        if (!env[key]) env[key] = m[2].trim().replace(/^"|"$/g, "").replace(/\\n/g, "");
      }
    }
  } catch { /* skip */ }
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const DEWEY_API_KEY = process.env.DEWEY_API_KEY || env.DEWEY_API_KEY || "";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
if (!DEWEY_API_KEY) {
  console.error("Missing DEWEY_API_KEY env var");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── CLI ARGS ────────────────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => {
    const [k, v] = a.slice(2).split("=");
    return [k, v || "true"];
  })
);

const PAGE_START = parseInt(args["page-start"] || "1", 10);
const PAGE_END = parseInt(args["page-end"] || "999", 10);
const DRY_RUN = args["dry-run"] === "true";
const RESET = args.reset === "true";
const SKIP_DOWNLOAD = args["skip-download"] === "true";
const OVERWRITE_OWNER = args["overwrite-owner"] === "true";
const BATCH_SIZE = 500;

// ── CONSTANTS ───────────────────────────────────────────────────────────────
const API_URL =
  "https://api.deweydata.io/api/v1/external/data/prj_bnrmqv8r__cdst_f6du8thzbgqkujq3";
const DOWNLOAD_DIR = "/tmp/attom-owners";
const PROGRESS_FILE = resolve(__dirname, ".attom-owners-progress.json");

// FIPS county codes for our 5 metros. We trust the dataset is already filtered
// server-side, but double-check on the client to drop anything that slipped in.
const TARGET_FIPS = new Set([
  "06037",                                          // LA County
  "17031",                                          // Cook (Chicago)
  "48201",                                          // Harris (Houston)
  "12086",                                          // Miami-Dade
  "36005", "36047", "36061", "36081", "36085",      // NYC: Bronx, Kings, NY, Queens, Richmond
]);

const FIPS_TO_METRO = {
  "06037": "los-angeles",
  "17031": "chicago",
  "48201": "houston",
  "12086": "miami",
  "36005": "nyc", "36047": "nyc", "36061": "nyc", "36081": "nyc", "36085": "nyc",
};

const SIDELINE_DIR = resolve(__dirname, "..", "data");

// ── ADDRESS NORMALIZATION (mirrors etl-dewey-data.mjs) ─────────────────────
const STREET_TYPE_TO_ABBR = {
  STREET: "ST", AVENUE: "AVE", BOULEVARD: "BLVD", DRIVE: "DR",
  LANE: "LN", COURT: "CT", PLACE: "PL", ROAD: "RD", TERRACE: "TER",
  CIRCLE: "CIR", PARKWAY: "PKWY", HIGHWAY: "HWY", SQUARE: "SQ",
  ALLEY: "ALY", TRAIL: "TRL", WAY: "WAY", POINT: "PT",
  ST: "ST", AVE: "AVE", BLVD: "BLVD", DR: "DR", LN: "LN",
  CT: "CT", PL: "PL", RD: "RD", TER: "TER", CIR: "CIR",
  PKWY: "PKWY", HWY: "HWY", SQ: "SQ", TRL: "TRL", PT: "PT",
};
const DIRECTION_TO_ABBR = {
  NORTH: "N", SOUTH: "S", EAST: "E", WEST: "W",
  NORTHEAST: "NE", NORTHWEST: "NW", SOUTHEAST: "SE", SOUTHWEST: "SW",
  N: "N", S: "S", E: "E", W: "W", NE: "NE", NW: "NW", SE: "SE", SW: "SW",
};
const UNIT_PATTERNS = [
  /\bAPT\.?\s*#?\s*\S+/gi, /\bAPARTMENT\s*#?\s*\S+/gi,
  /\bUNIT\s*#?\s*\S+/gi, /\bSTE\.?\s*#?\s*\S+/gi,
  /\bSUITE\s*#?\s*\S+/gi, /\bRM\.?\s*#?\s*\S+/gi,
  /\bROOM\s*#?\s*\S+/gi, /\bFLR\.?\s*#?\s*\S+/gi,
  /\bFLOOR\s*#?\s*\S+/gi, /(?:^|\s)#\s*\S+/g,
];

function normalizeAddress(address) {
  if (!address) return "";
  let addr = address.toUpperCase().trim();
  for (const pat of UNIT_PATTERNS) addr = addr.replace(pat, "");
  addr = addr.replace(/\s+/g, " ").trim();
  const tokens = addr.split(" ");
  const result = [];
  for (const token of tokens) {
    if (DIRECTION_TO_ABBR[token]) result.push(DIRECTION_TO_ABBR[token]);
    else if (STREET_TYPE_TO_ABBR[token]) result.push(STREET_TYPE_TO_ABBR[token]);
    else result.push(token);
  }
  return result.join(" ").replace(/\s+/g, " ").trim();
}

// ── LOGGING ─────────────────────────────────────────────────────────────────
function log(msg) {
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  console.log(`[${ts}] ${msg}`);
}
function logError(msg, err) {
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  console.error(`[${ts}] ERROR: ${msg}`, err?.message || err || "");
}

// ── PROGRESS ────────────────────────────────────────────────────────────────
function loadProgress() {
  if (RESET) return defaultProgress();
  try {
    if (existsSync(PROGRESS_FILE)) {
      const raw = readFileSync(PROGRESS_FILE, "utf8").trim();
      if (raw) return JSON.parse(raw);
    }
  } catch { /* corrupted, restart */ }
  return defaultProgress();
}
function defaultProgress() {
  return {
    pagesDownloaded: [],
    filesProcessed: [],
    totalRowsFiltered: 0,
    totalCompanyRows: 0,
    totalMatchedBuildings: 0,
    totalOwnershipRecordsInserted: 0,
    totalBuildingsUpdated: 0,
    lastUpdated: null,
  };
}
function saveProgress(state) {
  if (DRY_RUN) return;
  state.lastUpdated = new Date().toISOString();
  writeFileSync(PROGRESS_FILE, JSON.stringify(state, null, 2));
}

// ── DEWEY API ───────────────────────────────────────────────────────────────
async function fetchPageList(page) {
  const res = await fetch(`${API_URL}?page=${page}`, {
    headers: { "X-API-KEY": DEWEY_API_KEY, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Page ${page} returned ${res.status}: ${await res.text()}`);
  return res.json();
}

async function downloadFile(url, destPath) {
  const res = await fetch(url, { headers: { "X-API-KEY": DEWEY_API_KEY } });
  if (!res.ok) throw new Error(`Download failed ${res.status}: ${url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  writeFileSync(destPath, buffer);
  return buffer.length;
}

// ── CSV READING ─────────────────────────────────────────────────────────────
// Dewey ships this customized dataset as gzipped CSV. We read with pandas in
// chunks (some files are 130+ MB compressed = ~1GB uncompressed) and filter
// in python so only the small filtered subset crosses to node as JSON.
const PYTHON_PARQUET_SCRIPT = `
import sys
import pandas as pd

TARGET_FIPS = {'06037','17031','48201','12086','36005','36047','36061','36081','36085'}

cols = [
    'ATTOMID', 'ASSESSORHISTORYYEAR',
    'PARCELNUMBERRAW', 'SITUSSTATECOUNTYFIPS',
    'PROPERTYADDRESSFULL', 'PROPERTYADDRESSCITY',
    'PROPERTYADDRESSSTATE', 'PROPERTYADDRESSZIP',
    'LATITUDE', 'LONGITUDE',
    'PARTYOWNER1NAMELAST', 'OWNERTYPEDESCRIPTION1',
    'CONTACTOWNERMAILADDRESSHOUSENUMBER',
    'CONTACTOWNERMAILADDRESSSTREETDIRECTION',
    'CONTACTOWNERMAILADDRESSSTREETNAME',
    'CONTACTOWNERMAILADDRESSSTREETSUFFIX',
    'CONTACTOWNERMAILADDRESSUNIT',
    'CONTACTOWNERMAILADDRESSCITY',
    'CONTACTOWNERMAILADDRESSSTATE',
    'CONTACTOWNERMAILADDRESSZIP',
    'ASSESSORLASTSALEDATE', 'ASSESSORLASTSALEAMOUNT',
    'TAXMARKETVALUETOTAL',
    'UNITSCOUNT', 'PROPERTYUSESTANDARDIZED',
]

# Peek header to figure out which of our wanted cols actually exist
header = pd.read_csv(sys.argv[1], compression='gzip', nrows=0, low_memory=False)
available = [c for c in cols if c in header.columns]

reader = pd.read_csv(
    sys.argv[1], compression='gzip',
    usecols=available, dtype=str, low_memory=False,
    chunksize=200_000,
)

for chunk in reader:
    df = chunk
    if 'SITUSSTATECOUNTYFIPS' in df.columns:
        df['SITUSSTATECOUNTYFIPS'] = df['SITUSSTATECOUNTYFIPS'].astype(str).str.zfill(5)
        df = df[df['SITUSSTATECOUNTYFIPS'].isin(TARGET_FIPS)]
    if len(df) == 0:
        continue

    if 'OWNERTYPEDESCRIPTION1' in df.columns:
        df = df[df['OWNERTYPEDESCRIPTION1'].fillna('').str.upper() == 'COMPANY']
    if len(df) == 0:
        continue

    if 'PARTYOWNER1NAMELAST' in df.columns:
        df = df[df['PARTYOWNER1NAMELAST'].fillna('').str.strip() != '']
    if len(df) == 0:
        continue

    # Multifamily only
    if 'UNITSCOUNT' in df.columns:
        units = pd.to_numeric(df['UNITSCOUNT'], errors='coerce').fillna(0)
        df = df[units >= 2]
    if len(df) == 0:
        continue

    if 'PROPERTYUSESTANDARDIZED' in df.columns:
        use = df['PROPERTYUSESTANDARDIZED'].fillna('').str.upper()
        df = df[~use.str.contains('SINGLE FAMILY', na=False)]
    if len(df) == 0:
        continue

    # Compose mailing address from parts (no FULL column in this dataset).
    # Vectorized: fillna(''), strip, concat with single spaces.
    addr_parts = [
        'CONTACTOWNERMAILADDRESSHOUSENUMBER',
        'CONTACTOWNERMAILADDRESSSTREETDIRECTION',
        'CONTACTOWNERMAILADDRESSSTREETNAME',
        'CONTACTOWNERMAILADDRESSSTREETSUFFIX',
        'CONTACTOWNERMAILADDRESSUNIT',
    ]
    addr_series = None
    for col in addr_parts:
        if col in df.columns:
            piece = df[col].fillna('').astype(str).str.strip()
            addr_series = piece if addr_series is None else (addr_series + ' ' + piece)
    if addr_series is not None:
        df['_owner_mailing_address'] = addr_series.str.replace(r'\\s+', ' ', regex=True).str.strip().replace('', None)
    else:
        df['_owner_mailing_address'] = None

    sys.stdout.write(df.to_json(orient='records', lines=True, default_handler=str))

if len(df) == 0:
    sys.exit(0)

# Convert Decimal columns -> float for JSON
import decimal
for col in df.columns:
    if df[col].dtype == object:
        try:
            sample = df[col].dropna().iloc[0] if len(df[col].dropna()) > 0 else None
            if isinstance(sample, decimal.Decimal):
                df[col] = df[col].apply(lambda x: float(x) if isinstance(x, decimal.Decimal) else x)
        except (IndexError, TypeError):
            pass

# Stringify dates
for col in ['TRANSFERINFOLASTSALEDATE']:
    if col in df.columns:
        df[col] = df[col].astype(str).replace('NaT', '')

sys.stdout.write(df.to_json(orient='records', lines=True, default_handler=str))
`;

function readParquetFile(filePath) {
  const pyScript = join(DOWNLOAD_DIR, "_read_parquet.py");
  writeFileSync(pyScript, PYTHON_PARQUET_SCRIPT);
  try {
    const stdout = execFileSync("python3", [pyScript, filePath], {
      maxBuffer: 1024 * 1024 * 512,
      encoding: "utf8",
    });
    const rows = [];
    for (const line of stdout.split("\n")) {
      if (!line.trim()) continue;
      try { rows.push(JSON.parse(line)); } catch { /* skip */ }
    }
    return rows;
  } catch (err) {
    logError(`Failed to read parquet: ${filePath}`, err);
    return [];
  }
}

// ── BUILDING MATCHING ───────────────────────────────────────────────────────
const apnIndex = new Map();    // apn -> building_id
const zipAddrIndex = new Map();// zip -> Map<normalizedAddr, building_id>
const coordCells = new Map();  // "lat10|lng10" -> [{lat, lng, id}]  (~50m cells)
const matchCache = new Map();

async function preloadBuildingsForZips(zips) {
  const newZips = zips.filter((z) => z && !zipAddrIndex.has(z));
  if (newZips.length === 0) return;

  for (let i = 0; i < newZips.length; i += 20) {
    const batch = newZips.slice(i, i + 20);
    const { data, error } = await supabase
      .from("buildings")
      .select("id, full_address, zip_code, latitude, longitude, apn, bbl")
      .in("zip_code", batch)
      .limit(20000);

    if (error) {
      logError("Failed to preload buildings for zips", error);
      continue;
    }

    for (const z of batch) {
      if (!zipAddrIndex.has(z)) zipAddrIndex.set(z, new Map());
    }

    for (const b of data || []) {
      const z = b.zip_code;
      if (!zipAddrIndex.has(z)) zipAddrIndex.set(z, new Map());
      const addrMap = zipAddrIndex.get(z);
      const norm = normalizeAddress(b.full_address);
      if (norm) {
        addrMap.set(norm, b.id);
        const street = norm.split(",")[0]?.trim();
        if (street && street !== norm) addrMap.set(street, b.id);
      }
      if (b.apn) apnIndex.set(String(b.apn).replace(/[^0-9A-Z]/gi, "").toUpperCase(), b.id);
      if (b.bbl) apnIndex.set(String(b.bbl).replace(/[^0-9A-Z]/gi, "").toUpperCase(), b.id);
      if (b.latitude && b.longitude) {
        // Bucket to ~0.0005° cells (~55m) and check 3x3 neighborhood at lookup
        const key = `${Math.round(b.latitude * 2000)}|${Math.round(b.longitude * 2000)}`;
        if (!coordCells.has(key)) coordCells.set(key, []);
        coordCells.get(key).push({ lat: b.latitude, lng: b.longitude, id: b.id });
      }
    }
  }
}

function matchBuilding(row) {
  const cacheKey = `${row.PARCELNUMBERRAW || ""}|${row.PROPERTYADDRESSFULL || ""}|${row.PROPERTYADDRESSZIP || ""}`;
  if (matchCache.has(cacheKey)) return matchCache.get(cacheKey);

  // Tier 1: APN
  if (row.PARCELNUMBERRAW) {
    const apn = String(row.PARCELNUMBERRAW).replace(/[^0-9A-Z]/gi, "").toUpperCase();
    if (apn && apnIndex.has(apn)) {
      matchCache.set(cacheKey, apnIndex.get(apn));
      return apnIndex.get(apn);
    }
  }

  // Tier 2: address + zip
  const zip = String(row.PROPERTYADDRESSZIP || "").trim().slice(0, 5);
  const norm = normalizeAddress(row.PROPERTYADDRESSFULL || "");
  if (zip && norm && zipAddrIndex.has(zip)) {
    const addrMap = zipAddrIndex.get(zip);
    if (addrMap.has(norm)) {
      matchCache.set(cacheKey, addrMap.get(norm));
      return addrMap.get(norm);
    }
    const street = norm.split(",")[0]?.trim();
    if (street && addrMap.has(street)) {
      matchCache.set(cacheKey, addrMap.get(street));
      return addrMap.get(street);
    }
  }

  // Tier 3: lat/lng proximity (~50m, scan 3x3 cells)
  const lat = parseFloat(row.LATITUDE);
  const lng = parseFloat(row.LONGITUDE);
  if (lat && lng && Math.abs(lat) > 1 && Math.abs(lng) > 1) {
    const cellLat = Math.round(lat * 2000);
    const cellLng = Math.round(lng * 2000);
    let best = null;
    let bestDist = Infinity;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const cell = coordCells.get(`${cellLat + dx}|${cellLng + dy}`);
        if (!cell) continue;
        for (const c of cell) {
          const dLat = (c.lat - lat) * 111000;
          const dLng = (c.lng - lng) * 111000 * Math.cos((lat * Math.PI) / 180);
          const dist = Math.sqrt(dLat * dLat + dLng * dLng);
          if (dist < bestDist && dist < 50) {
            bestDist = dist;
            best = c.id;
          }
        }
      }
    }
    if (best) {
      matchCache.set(cacheKey, best);
      return best;
    }
  }

  matchCache.set(cacheKey, null);
  return null;
}

// ── DATE / NUMBER PARSERS ───────────────────────────────────────────────────
function parseDate(s) {
  if (!s) return null;
  // ATTOM uses "1900-01-01" as a sentinel for "no sale on record"
  if (typeof s === "string" && s.startsWith("1900-01-01")) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}
function parseNum(v) {
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}
function parseSalePrice(v) {
  const n = parseFloat(v);
  // 0 is ATTOM sentinel for non-arms-length transfers (quitclaim, trustee, etc.)
  if (isNaN(n) || n === 0) return null;
  return n;
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ── DOWNLOAD PHASE ──────────────────────────────────────────────────────────
async function downloadAllPages(progress) {
  if (SKIP_DOWNLOAD) {
    log("Skipping download phase (--skip-download)");
    return;
  }
  mkdirSync(DOWNLOAD_DIR, { recursive: true });
  log(`Downloading pages ${PAGE_START}–${PAGE_END}...`);

  for (let page = PAGE_START; page <= PAGE_END; page++) {
    if (progress.pagesDownloaded.includes(page)) {
      log(`  Page ${page}: already downloaded, skipping`);
      continue;
    }

    let pageData;
    try {
      pageData = await fetchPageList(page);
    } catch (err) {
      if (err.message.includes("404") || err.message.includes("400")) {
        log(`  Page ${page}: no more pages (${err.message.slice(0, 60)})`);
        break;
      }
      logError(`  Page ${page} fetch failed`, err);
      await sleep(5000);
      continue;
    }

    const links = pageData.download_links || pageData.data || pageData.results || [];
    if (!links.length) { log(`  Page ${page}: empty, done.`); break; }
    log(`  Page ${page}: ${links.length} files`);

    for (const linkObj of links) {
      const url = linkObj.link || linkObj.download_url || linkObj.url;
      const fileName = linkObj.file_name || linkObj.filename || `page${page}_${Date.now()}.parquet`;
      const destPath = join(DOWNLOAD_DIR, fileName);
      if (existsSync(destPath)) continue;
      try {
        const bytes = await downloadFile(url, destPath);
        log(`    ${fileName} (${(bytes / 1024 / 1024).toFixed(1)} MB)`);
      } catch (err) {
        logError(`    Failed: ${fileName}`, err);
      }
      await sleep(500);
    }

    progress.pagesDownloaded.push(page);
    saveProgress(progress);
    await sleep(1000);
  }
  log("Download phase complete.");
}

// ── PROCESS PHASE ───────────────────────────────────────────────────────────
async function processAllFiles(progress) {
  if (!existsSync(DOWNLOAD_DIR)) {
    log("No download directory. Run without --skip-download first.");
    return;
  }
  const allFiles = readdirSync(DOWNLOAD_DIR).filter((f) => f.endsWith(".csv.gz")).sort();
  const FILES_PER_PAGE = 50;
  const sliceStart = (PAGE_START - 1) * FILES_PER_PAGE;
  const sliceEnd = PAGE_END * FILES_PER_PAGE;
  const files = allFiles.slice(sliceStart, sliceEnd);
  log(`Processing ${files.length} CSV files (of ${allFiles.length} total, slice ${sliceStart}-${sliceEnd})...`);

  // Most-recent-year-per-parcel dedup across ALL files. Key by ATTOMID.
  // If memory becomes a concern at full scale we'll switch to a per-file pass
  // that emits to disk and dedups at the end — for the 5-metro slice (~55M
  // rows, but only company subset) this should fit comfortably.
  const latestByParcel = new Map(); // ATTOMID -> { year, row }

  let totalRows = 0;
  let dropped = 0;

  for (const fileName of files) {
    if (progress.filesProcessed.includes(fileName)) {
      log(`  ${fileName}: already processed, skipping`);
      continue;
    }
    const filePath = join(DOWNLOAD_DIR, fileName);
    log(`  Reading ${fileName}...`);

    const rows = readParquetFile(filePath);
    log(`    ${rows.length} company rows after python filter`);
    totalRows += rows.length;

    for (const row of rows) {
      // Defensive double-check on FIPS (python already filters)
      const fips = String(row.SITUSSTATECOUNTYFIPS || "").padStart(5, "0");
      if (!TARGET_FIPS.has(fips)) { dropped++; continue; }

      const id = String(row.ATTOMID || "");
      if (!id) { dropped++; continue; }

      const year = parseInt(row.ASSESSORHISTORYYEAR, 10) || 0;
      const existing = latestByParcel.get(id);
      if (!existing || year > existing.year) {
        latestByParcel.set(id, { year, row });
      }
    }

    progress.filesProcessed.push(fileName);
    saveProgress(progress);
  }

  progress.totalRowsFiltered = totalRows;
  progress.totalCompanyRows = latestByParcel.size;
  log("");
  log(`Read ${totalRows} company rows total, ${dropped} dropped, ${latestByParcel.size} unique parcels (latest year only)`);
  return latestByParcel;
}

// ── MATCH + LOAD PHASE ──────────────────────────────────────────────────────
async function loadOwnership(latestByParcel, progress) {
  const parcels = [...latestByParcel.values()];
  log(`Matching ${parcels.length} parcels to buildings...`);

  // Preload buildings by zip in bulk before matching
  const uniqueZips = [...new Set(parcels.map((p) => String(p.row.PROPERTYADDRESSZIP || "").trim().slice(0, 5)).filter(Boolean))];
  log(`  ${uniqueZips.length} unique zips to preload`);
  for (let i = 0; i < uniqueZips.length; i += 200) {
    await preloadBuildingsForZips(uniqueZips.slice(i, i + 200));
    if ((i / 200) % 10 === 0) log(`  Preloaded ${Math.min(i + 200, uniqueZips.length)}/${uniqueZips.length} zips`);
  }

  // Build the records to insert + the building updates to apply
  const ownershipRecords = [];
  const buildingUpdates = new Map(); // building_id -> { owner_name, owner_type }
  const sidelinedByMetro = new Map(); // metro -> [parcel info]
  let matched = 0;
  let unmatched = 0;

  for (const { year, row } of parcels) {
    const buildingId = matchBuilding(row);
    if (!buildingId) {
      unmatched++;
      const fips = String(row.SITUSSTATECOUNTYFIPS || "").padStart(5, "0");
      const metro = FIPS_TO_METRO[fips] || "unknown";
      if (!sidelinedByMetro.has(metro)) sidelinedByMetro.set(metro, []);
      sidelinedByMetro.get(metro).push({
        attom_id: String(row.ATTOMID),
        parcel_id: row.PARCELNUMBERRAW || null,
        assessment_year: year,
        property_address: row.PROPERTYADDRESSFULL || null,
        property_city: row.PROPERTYADDRESSCITY || null,
        property_state: row.PROPERTYADDRESSSTATE || null,
        property_zip: row.PROPERTYADDRESSZIP || null,
        latitude: parseFloat(row.LATITUDE) || null,
        longitude: parseFloat(row.LONGITUDE) || null,
        property_use: row.PROPERTYUSESTANDARDIZED || null,
        units_count: parseInt(row.UNITSCOUNT, 10) || null,
        owner_name: String(row.PARTYOWNER1NAMELAST).trim(),
        owner_mailing_address: row._owner_mailing_address || null,
        owner_mailing_zip: row.CONTACTOWNERMAILADDRESSZIP || null,
        last_sale_date: parseDate(row.DEEDLASTSALEDATE),
        last_sale_price: parseNum(row.DEEDLASTSALEPRICE),
        assessed_value: parseNum(row.TAXMARKETVALUETOTAL),
      });
      continue;
    }
    matched++;

    ownershipRecords.push({
      building_id: buildingId,
      source_record_id: String(row.ATTOMID),
      assessment_year: year,
      parcel_id: row.PARCELNUMBERRAW ? String(row.PARCELNUMBERRAW) : null,
      owner_name: String(row.PARTYOWNER1NAMELAST).trim(),
      owner_type: "company",
      owner_mailing_address: row._owner_mailing_address || null,
      owner_mailing_city: row.CONTACTOWNERMAILADDRESSCITY || null,
      owner_mailing_state: row.CONTACTOWNERMAILADDRESSSTATE || null,
      owner_mailing_zip: row.CONTACTOWNERMAILADDRESSZIP
        ? String(row.CONTACTOWNERMAILADDRESSZIP).trim().slice(0, 10)
        : null,
      last_sale_date: parseDate(row.ASSESSORLASTSALEDATE),
      last_sale_price: parseSalePrice(row.ASSESSORLASTSALEAMOUNT),
      assessed_value: parseNum(row.TAXMARKETVALUETOTAL),
    });

    // Latest record wins for the building summary
    buildingUpdates.set(buildingId, {
      owner_name: String(row.PARTYOWNER1NAMELAST).trim(),
      owner_type: "company",
    });
  }

  log(`  Matched: ${matched}, Unmatched (sidelined): ${unmatched}`);
  progress.totalMatchedBuildings = matched;

  // Sideline files — one per metro. Unmatched multifamily parcels are
  // candidates for new buildings, but per project rules we don't auto-insert
  // them; user reviews per-city.
  if (sidelinedByMetro.size > 0) {
    mkdirSync(SIDELINE_DIR, { recursive: true });
    for (const [metro, items] of sidelinedByMetro) {
      const path = join(SIDELINE_DIR, `attom-sidelined-multifamily-${metro}.json`);
      writeFileSync(
        path,
        JSON.stringify({ generated_at: new Date().toISOString(), count: items.length, items }, null, 2)
      );
      log(`  Sidelined ${items.length} ${metro} parcels → ${path}`);
    }
  }

  if (DRY_RUN) {
    log("Dry run — skipping writes. Sample of first 3 records:");
    for (const r of ownershipRecords.slice(0, 3)) console.log(JSON.stringify(r, null, 2));
    return;
  }

  // 1. Upsert ownership records
  log(`Upserting ${ownershipRecords.length} ownership records...`);
  let upserted = 0;
  for (let i = 0; i < ownershipRecords.length; i += BATCH_SIZE) {
    const batch = ownershipRecords.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("building_ownership_records")
      .upsert(batch, { onConflict: "source_record_id,assessment_year" });
    if (error) {
      logError(`  Batch ${Math.floor(i / BATCH_SIZE) + 1} error`, error);
      for (const r of batch) {
        const { error: singleErr } = await supabase
          .from("building_ownership_records")
          .upsert(r, { onConflict: "source_record_id,assessment_year" });
        if (!singleErr) upserted++;
      }
    } else {
      upserted += batch.length;
    }
    if ((upserted % 5000) < BATCH_SIZE) {
      log(`  Ownership records progress: ${upserted}/${ownershipRecords.length}`);
    }
  }
  progress.totalOwnershipRecordsInserted = upserted;
  log(`  Ownership records done: ${upserted} upserted`);

  // 2. Update buildings — two passes per row, parallelized:
  //    a) owner_type = 'company' ALWAYS (we know it's company from ATTOM)
  //    b) owner_name only when null (or always if --overwrite-owner)
  // Splitting the writes lets us classify buildings whose owner_name already
  // came from another source (HPD/PLUTO/scrape) without overwriting that name.
  log(`Updating ${buildingUpdates.size} buildings (overwrite-owner=${OVERWRITE_OWNER})...`);
  let typed = 0;
  let named = 0;
  const updateRows = [...buildingUpdates.entries()].map(([id, u]) => ({ id, ...u }));
  const PARALLEL = 50;
  for (let i = 0; i < updateRows.length; i += PARALLEL) {
    const batch = updateRows.slice(i, i + PARALLEL);
    const results = await Promise.all(
      batch.map(async (u) => {
        const typeRes = await supabase
          .from("buildings")
          .update({ owner_type: u.owner_type })
          .eq("id", u.id);

        const nameQ = supabase
          .from("buildings")
          .update({ owner_name: u.owner_name })
          .eq("id", u.id);
        if (!OVERWRITE_OWNER) nameQ.is("owner_name", null);
        const nameRes = await nameQ;

        return { typeOk: !typeRes.error, nameOk: !nameRes.error };
      })
    );
    for (const r of results) {
      if (r.typeOk) typed++;
      if (r.nameOk) named++;
    }
    if (i % 2000 === 0) {
      log(`  Building updates progress: ${typed} typed / ${named} name-touched of ${updateRows.length}`);
    }
  }
  progress.totalBuildingsUpdated = typed;
  log(`  Building updates done: ${typed} typed, ${named} name-touched`);

  saveProgress(progress);
}

// ── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  log("=== ATTOM Owner Backfill (companies only) ===");
  log(`Pages: ${PAGE_START}–${PAGE_END}, DryRun: ${DRY_RUN}, Reset: ${RESET}, OverwriteOwner: ${OVERWRITE_OWNER}, SkipDownload: ${SKIP_DOWNLOAD}`);
  log("");

  const progress = loadProgress();
  log(`Resuming from: ${progress.filesProcessed.length} files processed, ${progress.pagesDownloaded.length} pages downloaded`);

  await downloadAllPages(progress);
  const latestByParcel = await processAllFiles(progress);
  if (!latestByParcel || latestByParcel.size === 0) {
    log("No data to load.");
    return;
  }
  await loadOwnership(latestByParcel, progress);

  log("");
  log("=== ETL Complete ===");
  log(`  Company rows read: ${progress.totalRowsFiltered}`);
  log(`  Unique parcels: ${progress.totalCompanyRows}`);
  log(`  Matched buildings: ${progress.totalMatchedBuildings}`);
  log(`  Ownership records inserted: ${progress.totalOwnershipRecordsInserted}`);
  log(`  Buildings updated: ${progress.totalBuildingsUpdated}`);
  saveProgress(progress);
}

main().catch((err) => {
  logError("Fatal error", err);
  process.exit(1);
});

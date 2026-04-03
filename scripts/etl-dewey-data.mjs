#!/usr/bin/env node
/**
 * ETL pipeline for Dewey Data rental listings.
 *
 * Downloads parquet files from Dewey API, filters to 5 metros,
 * normalizes addresses, matches to existing buildings, aggregates
 * rent stats, and loads into Supabase.
 *
 * Usage:
 *   node scripts/etl-dewey-data.mjs
 *   node scripts/etl-dewey-data.mjs --page-start=1 --page-end=10
 *   node scripts/etl-dewey-data.mjs --dry-run
 *   node scripts/etl-dewey-data.mjs --reset
 *   node scripts/etl-dewey-data.mjs --skip-download   # process already-downloaded files
 *   node scripts/etl-dewey-data.mjs --skip-new-buildings  # don't create new buildings
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { execSync, execFileSync } from "child_process";
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
  console.error("Missing DEWEY_API_KEY environment variable");
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
const SKIP_NEW_BUILDINGS = args["skip-new-buildings"] === "true";
const BATCH_SIZE = 500;

// ── CONSTANTS ───────────────────────────────────────────────────────────────
const DEWEY_API_URL =
  "https://api.deweydata.io/api/v1/external/data/prj_bnrmqv8r__fldr_cggezfmh4zsrfevk8";
const DOWNLOAD_DIR = "/tmp/dewey";
const PROGRESS_FILE = resolve(__dirname, ".dewey-etl-progress.json");

// ── METRO DEFINITIONS ───────────────────────────────────────────────────────
const METRO_DEFS = {
  nyc: {
    state: "NY",
    cities: new Set([
      "NEW YORK", "BROOKLYN", "QUEENS", "BRONX", "STATEN ISLAND",
      "NEW YORK CITY", "MANHATTAN", "ASTORIA", "FLUSHING", "JAMAICA",
      "LONG ISLAND CITY", "RIDGEWOOD", "WOODSIDE", "JACKSON HEIGHTS",
      "ELMHURST", "FOREST HILLS", "FRESH MEADOWS", "BAYSIDE", "KEW GARDENS",
      "REGO PARK", "SUNNYSIDE", "CORONA", "OZONE PARK", "HOWARD BEACH",
      "FAR ROCKAWAY", "WOODHAVEN", "SOUTH OZONE PARK", "EAST ELMHURST",
      "COLLEGE POINT", "WHITESTONE",
    ]),
    metro: "nyc",
  },
  "los-angeles": {
    state: "CA",
    cities: new Set([
      "LOS ANGELES", "WEST HOLLYWOOD", "SANTA MONICA", "BURBANK",
      "GLENDALE", "PASADENA", "LONG BEACH", "CULVER CITY", "INGLEWOOD",
      "BEVERLY HILLS", "TORRANCE", "ALHAMBRA", "ARCADIA", "DOWNEY",
      "WHITTIER", "POMONA", "EL MONTE", "WEST COVINA", "NORWALK",
      "COMPTON", "HAWTHORNE", "REDONDO BEACH", "HERMOSA BEACH",
      "MANHATTAN BEACH", "CARSON", "GARDENA", "LAWNDALE", "LAKEWOOD",
      "CERRITOS", "MONROVIA", "AZUSA", "COVINA", "LA VERNE", "CLAREMONT",
      "GLENDORA", "DUARTE", "IRWINDALE", "BALDWIN PARK", "SOUTH GATE",
      "BELL", "BELL GARDENS", "HUNTINGTON PARK", "MAYWOOD", "VERNON",
      "MONTEBELLO", "PICO RIVERA", "SANTA FE SPRINGS", "SIGNAL HILL",
      "RANCHO PALOS VERDES", "PALOS VERDES ESTATES", "ROLLING HILLS ESTATES",
      "SAN DIMAS", "DIAMOND BAR", "WALNUT", "ROWLAND HEIGHTS",
      "NORTH HOLLYWOOD", "STUDIO CITY", "SHERMAN OAKS", "ENCINO",
      "TARZANA", "WOODLAND HILLS", "CANOGA PARK", "RESEDA", "VAN NUYS",
      "PANORAMA CITY", "SUN VALLEY", "NORTHRIDGE", "GRANADA HILLS",
      "SYLMAR", "EAGLE ROCK", "HIGHLAND PARK", "SILVER LAKE", "ECHO PARK",
      "LOS FELIZ", "KOREATOWN", "MID WILSHIRE",
    ]),
    metro: "los-angeles",
  },
  chicago: {
    state: "IL",
    cities: new Set([
      "CHICAGO", "EVANSTON", "OAK PARK", "CICERO", "BERWYN",
      "SKOKIE", "WILMETTE", "WINNETKA", "GLENCOE",
    ]),
    metro: "chicago",
  },
  miami: {
    state: "FL",
    cities: new Set([
      "MIAMI", "MIAMI BEACH", "FORT LAUDERDALE", "HOLLYWOOD", "CORAL GABLES",
      "HIALEAH", "DORAL", "AVENTURA", "NORTH MIAMI", "NORTH MIAMI BEACH",
      "SUNNY ISLES BEACH", "HALLANDALE BEACH", "PEMBROKE PINES", "MIRAMAR",
      "DAVIE", "PLANTATION", "SUNRISE", "LAUDERHILL", "LAUDERDALE LAKES",
      "POMPANO BEACH", "DEERFIELD BEACH", "BOCA RATON", "DELRAY BEACH",
      "BOYNTON BEACH", "COCONUT GROVE", "KEY BISCAYNE", "HOMESTEAD",
      "KENDALL", "MIAMI GARDENS", "MIAMI LAKES", "SWEETWATER",
      "SOUTH MIAMI", "SURFSIDE", "BAL HARBOUR", "BAY HARBOR ISLANDS",
    ]),
    metro: "miami",
  },
  houston: {
    state: "TX",
    cities: new Set([
      "HOUSTON", "PASADENA", "SUGAR LAND", "PEARLAND", "KATY",
      "THE WOODLANDS", "SPRING", "CYPRESS", "HUMBLE", "BAYTOWN",
      "LEAGUE CITY", "MISSOURI CITY", "RICHMOND", "ROSENBERG",
      "FRIENDSWOOD", "DEER PARK", "LA PORTE", "WEBSTER", "CLEAR LAKE",
      "BELLAIRE", "WEST UNIVERSITY PLACE", "CONROE", "TOMBALL",
      "ATASCOCITA", "CHANNELVIEW", "GALENA PARK", "JACINTO CITY",
    ]),
    metro: "houston",
  },
};

// Build a fast lookup: state -> Set of city names
const STATE_CITY_LOOKUP = new Map();
for (const def of Object.values(METRO_DEFS)) {
  if (!STATE_CITY_LOOKUP.has(def.state)) {
    STATE_CITY_LOOKUP.set(def.state, { cities: new Set(), metros: [] });
  }
  const entry = STATE_CITY_LOOKUP.get(def.state);
  for (const c of def.cities) entry.cities.add(c);
  entry.metros.push(def);
}

// ── ADDRESS NORMALIZATION ───────────────────────────────────────────────────
// We normalize to abbreviated form since that's what the DB stores.
const STREET_TYPE_TO_ABBR = {
  STREET: "ST", AVENUE: "AVE", BOULEVARD: "BLVD", DRIVE: "DR",
  LANE: "LN", COURT: "CT", PLACE: "PL", ROAD: "RD", TERRACE: "TER",
  CIRCLE: "CIR", PARKWAY: "PKWY", HIGHWAY: "HWY", SQUARE: "SQ",
  ALLEY: "ALY", TRAIL: "TRL", WAY: "WAY", POINT: "PT",
  // Also handle already-abbreviated forms as passthrough
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
  /\bAPT\.?\s*#?\s*\S+/gi,
  /\bAPARTMENT\s*#?\s*\S+/gi,
  /\bUNIT\s*#?\s*\S+/gi,
  /\bSTE\.?\s*#?\s*\S+/gi,
  /\bSUITE\s*#?\s*\S+/gi,
  /\bRM\.?\s*#?\s*\S+/gi,
  /\bROOM\s*#?\s*\S+/gi,
  /\bFLR\.?\s*#?\s*\S+/gi,
  /\bFLOOR\s*#?\s*\S+/gi,
  /(?:^|\s)#\s*\S+/g,
];

function normalizeAddress(address) {
  if (!address) return "";
  let addr = address.toUpperCase().trim();

  // Strip unit/apt/suite
  for (const pat of UNIT_PATTERNS) {
    addr = addr.replace(pat, "");
  }

  // Normalize whitespace
  addr = addr.replace(/\s+/g, " ").trim();

  // Tokenize and normalize each word
  const tokens = addr.split(" ");
  const result = [];
  for (const token of tokens) {
    if (DIRECTION_TO_ABBR[token]) {
      result.push(DIRECTION_TO_ABBR[token]);
    } else if (STREET_TYPE_TO_ABBR[token]) {
      result.push(STREET_TYPE_TO_ABBR[token]);
    } else {
      result.push(token);
    }
  }

  return result.join(" ").replace(/\s+/g, " ").trim();
}

function generateSlug(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
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

// ── PROGRESS TRACKING ───────────────────────────────────────────────────────
function loadProgress() {
  if (RESET) return defaultProgress();
  try {
    if (existsSync(PROGRESS_FILE)) {
      const raw = readFileSync(PROGRESS_FILE, "utf8").trim();
      if (raw) return JSON.parse(raw);
    }
  } catch { /* corrupted, start fresh */ }
  return defaultProgress();
}

function defaultProgress() {
  return {
    pagesDownloaded: [],      // page numbers already downloaded
    filesProcessed: [],       // file names already processed
    totalListingsFiltered: 0,
    totalMatchedBuildings: 0,
    totalNewBuildings: 0,
    totalBuildingRentsUpserted: 0,
    totalNeighborhoodRentsUpserted: 0,
    lastUpdated: null,
  };
}

function saveProgress(state) {
  if (DRY_RUN) return;
  state.lastUpdated = new Date().toISOString();
  writeFileSync(PROGRESS_FILE, JSON.stringify(state, null, 2));
}

// ── METRO MATCHING ──────────────────────────────────────────────────────────
function getMetroForRow(state, city) {
  if (!state || !city) return null;
  const s = state.toUpperCase().trim();
  const c = city.toUpperCase().trim();

  const entry = STATE_CITY_LOOKUP.get(s);
  if (!entry || !entry.cities.has(c)) return null;

  // Find which metro it belongs to
  for (const def of entry.metros) {
    if (def.cities.has(c)) return def.metro;
  }
  return null;
}

// ── DEWEY API ───────────────────────────────────────────────────────────────
async function fetchPageList(page = 1) {
  const url = `${DEWEY_API_URL}?page=${page}`;
  const res = await fetch(url, {
    headers: { "X-API-KEY": DEWEY_API_KEY, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Dewey API page ${page} returned ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function downloadFile(downloadUrl, destPath) {
  const res = await fetch(downloadUrl, {
    headers: { "X-API-KEY": DEWEY_API_KEY },
  });
  if (!res.ok) {
    throw new Error(`Download failed ${res.status}: ${downloadUrl}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  writeFileSync(destPath, buffer);
  return buffer.length;
}

// ── PARQUET READING ─────────────────────────────────────────────────────────
// Shell out to python3 with pyarrow to convert parquet -> JSON lines on stdout.
// This is the most reliable approach since pyarrow is already installed.

const PYTHON_PARQUET_SCRIPT = `
import sys
import pyarrow.parquet as pq
import pandas as pd

TARGET_STATES = {'NY', 'CA', 'IL', 'FL', 'TX'}

df = pq.read_table(sys.argv[1]).to_pandas()
df = df[df['STATE'].isin(TARGET_STATES)]

if len(df) == 0:
    sys.exit(0)

# Convert Decimal columns to float
for col in df.columns:
    if df[col].dtype == object:
        try:
            import decimal
            sample = df[col].dropna().iloc[0] if len(df[col].dropna()) > 0 else None
            if isinstance(sample, decimal.Decimal):
                df[col] = df[col].apply(lambda x: float(x) if isinstance(x, decimal.Decimal) else x)
        except (IndexError, TypeError):
            pass

# Convert timestamps to ISO strings
for col in ['DATE_POSTED', 'SCRAPED_TIMESTAMP', 'AVAILABLE_AT']:
    if col in df.columns:
        df[col] = df[col].astype(str).replace('NaT', '')

# Output as JSON lines using pandas (vectorized, much faster)
sys.stdout.write(df.to_json(orient='records', lines=True, default_handler=str))
`;

function readParquetFile(filePath) {
  // Write a temp python script
  const pyScript = join(DOWNLOAD_DIR, "_read_parquet.py");
  writeFileSync(pyScript, PYTHON_PARQUET_SCRIPT);

  try {
    const stdout = execFileSync("python3", [pyScript, filePath], {
      maxBuffer: 1024 * 1024 * 512, // 512 MB
      encoding: "utf8",
    });

    const rows = [];
    for (const line of stdout.split("\n")) {
      if (!line.trim()) continue;
      try {
        rows.push(JSON.parse(line));
      } catch {
        // skip malformed lines
      }
    }
    return rows;
  } catch (err) {
    logError(`Failed to read parquet: ${filePath}`, err);
    return [];
  }
}

// ── BUILDING MATCHING ───────────────────────────────────────────────────────
// Bulk preload: zip -> Map<normalizedAddr, buildingId>
const zipCache = new Map(); // zip -> Map<upperAddr, buildingId>
const coordIndex = []; // [{lat, lng, id}] for proximity fallback
const matchCache = new Map(); // normalizedAddr|zip -> buildingId or null

async function preloadBuildingsForZips(zips) {
  const newZips = zips.filter((z) => z && !zipCache.has(z));
  if (newZips.length === 0) return;

  // Batch load buildings for all new zips in one query
  for (let i = 0; i < newZips.length; i += 20) {
    const batch = newZips.slice(i, i + 20);
    const { data, error } = await supabase
      .from("buildings")
      .select("id, full_address, zip_code, latitude, longitude")
      .in("zip_code", batch)
      .limit(10000);

    if (error) {
      logError("Failed to preload buildings for zips", error);
      continue;
    }

    // Index by zip -> normalized address
    for (const z of batch) {
      if (!zipCache.has(z)) zipCache.set(z, new Map());
    }

    for (const b of data || []) {
      const z = b.zip_code;
      if (!zipCache.has(z)) zipCache.set(z, new Map());
      const addrMap = zipCache.get(z);
      const norm = normalizeAddress(b.full_address);
      if (norm) addrMap.set(norm, b.id);
      // Also index partial matches (just street number + name)
      const parts = norm.split(",")[0]?.trim();
      if (parts && parts !== norm) addrMap.set(parts, b.id);
    }
  }

  log(`    Preloaded buildings for ${newZips.length} new zips (${newZips.join(", ").slice(0, 80)}...)`);
}

function matchBuilding(normalizedAddr, zip) {
  const cacheKey = `${normalizedAddr}|${zip}`;
  if (matchCache.has(cacheKey)) return matchCache.get(cacheKey);

  if (zip && zipCache.has(zip)) {
    const addrMap = zipCache.get(zip);
    // Try exact match
    if (addrMap.has(normalizedAddr)) {
      const id = addrMap.get(normalizedAddr);
      matchCache.set(cacheKey, id);
      return id;
    }
    // Try partial: just the street part (before any comma)
    const streetPart = normalizedAddr.split(",")[0]?.trim();
    if (streetPart && addrMap.has(streetPart)) {
      const id = addrMap.get(streetPart);
      matchCache.set(cacheKey, id);
      return id;
    }
    // Try fuzzy: check if any building address contains the dewey address
    for (const [addr, id] of addrMap) {
      if (addr.includes(normalizedAddr) || normalizedAddr.includes(addr)) {
        matchCache.set(cacheKey, id);
        return id;
      }
    }
  }

  matchCache.set(cacheKey, null);
  return null;
}

// ── METRO -> BOROUGH MAPPING ────────────────────────────────────────────────
function guessBoroughForNyc(city) {
  const c = (city || "").toUpperCase().trim();
  if (c === "MANHATTAN" || c === "NEW YORK") return "Manhattan";
  if (c === "BROOKLYN") return "Brooklyn";
  if (c === "QUEENS" || c === "ASTORIA" || c === "FLUSHING" || c === "JAMAICA" ||
      c === "LONG ISLAND CITY" || c === "RIDGEWOOD" || c === "WOODSIDE" ||
      c === "JACKSON HEIGHTS" || c === "ELMHURST" || c === "FOREST HILLS" ||
      c === "FRESH MEADOWS" || c === "BAYSIDE" || c === "KEW GARDENS" ||
      c === "REGO PARK" || c === "SUNNYSIDE" || c === "CORONA" ||
      c === "OZONE PARK" || c === "HOWARD BEACH" || c === "FAR ROCKAWAY" ||
      c === "WOODHAVEN" || c === "SOUTH OZONE PARK" || c === "EAST ELMHURST" ||
      c === "COLLEGE POINT" || c === "WHITESTONE") return "Queens";
  if (c === "BRONX") return "Bronx";
  if (c === "STATEN ISLAND") return "Staten Island";
  return "Manhattan"; // default
}

function getBoroughForRow(metro, city) {
  if (metro === "nyc") return guessBoroughForNyc(city);
  if (metro === "chicago") return "Chicago"; // will be refined later from 311 data
  if (metro === "miami") return city || "Miami";
  if (metro === "houston") return city || "Houston";
  if (metro === "los-angeles") return city || "Los Angeles";
  return city || "";
}

// ── STATISTICS HELPERS ──────────────────────────────────────────────────────
function median(arr) {
  if (!arr.length) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function percentile(arr, p) {
  if (!arr.length) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function avg(arr) {
  if (!arr.length) return null;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function truncateToMonth(dateStr) {
  // Turn "2024-07-15" or "2024-07-15T..." into "2024-07-01"
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

// ── SLEEP ───────────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── DOWNLOAD PHASE ──────────────────────────────────────────────────────────
async function downloadAllPages(progress) {
  if (SKIP_DOWNLOAD) {
    log("Skipping download phase (--skip-download)");
    return;
  }

  mkdirSync(DOWNLOAD_DIR, { recursive: true });
  log(`Downloading Dewey data pages ${PAGE_START}–${PAGE_END}...`);

  // Collect all download links across pages
  const allLinks = [];

  for (let page = PAGE_START; page <= PAGE_END; page++) {
    if (progress.pagesDownloaded.includes(page)) {
      log(`  Page ${page}: already downloaded, skipping`);
      continue;
    }

    log(`  Fetching page ${page} file list...`);
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

    // The API returns { download_links: [...] } or similar
    const links = pageData.download_links || pageData.data || pageData.results || [];
    if (!links.length) {
      log(`  Page ${page}: empty, done.`);
      break;
    }

    log(`  Page ${page}: ${links.length} files`);

    // Download each file
    for (const linkObj of links) {
      const downloadUrl = linkObj.link || linkObj.download_url || linkObj.url;
      const fileName = linkObj.file_name || linkObj.filename || `page${page}_${Date.now()}.parquet`;
      const destPath = join(DOWNLOAD_DIR, fileName);

      if (existsSync(destPath)) {
        continue; // already downloaded
      }

      try {
        const bytes = await downloadFile(downloadUrl, destPath);
        log(`    Downloaded ${fileName} (${(bytes / 1024 / 1024).toFixed(1)} MB)`);
      } catch (err) {
        logError(`    Failed to download ${fileName}`, err);
      }

      // Polite delay between downloads
      await sleep(500);
    }

    progress.pagesDownloaded.push(page);
    saveProgress(progress);

    // Polite delay between pages
    await sleep(1000);
  }

  log("Download phase complete.");
}

// ── PROCESS PHASE ───────────────────────────────────────────────────────────
async function processAllFiles(progress) {
  if (!existsSync(DOWNLOAD_DIR)) {
    log("No download directory found. Run without --skip-download first.");
    return { buildingAgg: new Map(), neighborhoodAgg: new Map(), amenityRows: [], unmatchedBuildings: new Map() };
  }

  const allFiles = readdirSync(DOWNLOAD_DIR)
    .filter((f) => f.endsWith(".parquet"))
    .sort(); // chronological by file name

  // When using --page-start/--page-end with --skip-download, partition the file list
  // so each worker processes a distinct slice. Pages are 50 files each.
  const FILES_PER_PAGE = 50;
  const sliceStart = (PAGE_START - 1) * FILES_PER_PAGE;
  const sliceEnd = PAGE_END * FILES_PER_PAGE;
  const files = allFiles.slice(sliceStart, sliceEnd);

  log(`Processing ${files.length} parquet files (of ${allFiles.length} total, slice ${sliceStart}-${sliceEnd})...`);

  // Aggregation buckets
  // building: building_id|month|beds -> [rents], [sqfts]
  const buildingAgg = new Map();
  // neighborhood: city|zip|month|beds -> [rents], [sqfts]
  const neighborhoodAgg = new Map();
  // amenity: city|zip|amenity|beds -> { withRents: [], withoutRents: [] }
  const amenityAgg = new Map();
  // Unmatched: normalizedAddr|zip -> { row data for new building creation }
  const unmatchedBuildings = new Map();

  let totalRows = 0;
  let filteredRows = 0;
  let matchedRows = 0;
  let unmatchedRows = 0;

  for (const fileName of files) {
    if (progress.filesProcessed.includes(fileName)) {
      log(`  ${fileName}: already processed, skipping`);
      continue;
    }

    const filePath = join(DOWNLOAD_DIR, fileName);
    log(`  Reading ${fileName}...`);

    const rows = readParquetFile(filePath);
    log(`    ${rows.length} total rows in file`);
    totalRows += rows.length;

    // Filter to our metros
    const filtered = [];
    for (const row of rows) {
      const state = (row.STATE || row.state || "").toUpperCase().trim();
      const city = (row.CITY || row.city || "").toUpperCase().trim();
      const metro = getMetroForRow(state, city);
      if (metro) {
        row._metro = metro;
        row._city = city;
        row._state = state;
        filtered.push(row);
      }
    }

    log(`    ${filtered.length} rows in target metros`);
    filteredRows += filtered.length;

    // Process each filtered row
    let fileMatched = 0;
    let fileUnmatched = 0;

    // Batch address matching: group by normalized address first
    const addrGroups = new Map();
    for (const row of filtered) {
      const rawAddr = row.ADDRESS || row.address || "";
      const zip = String(row.ZIP || row.zip || row.ZIPCODE || row.zipcode || "").trim().slice(0, 5);
      const normalizedAddr = normalizeAddress(rawAddr);

      if (!normalizedAddr) continue;

      const key = `${normalizedAddr}|${zip}`;
      if (!addrGroups.has(key)) {
        addrGroups.set(key, {
          normalizedAddr,
          zip,
          lat: parseFloat(row.LATITUDE || row.latitude || row.LAT || row.lat || 0) || null,
          lng: parseFloat(row.LONGITUDE || row.longitude || row.LNG || row.lng || row.LON || row.lon || 0) || null,
          rows: [],
          rawRow: row, // keep one raw row for new building creation
        });
      }
      addrGroups.get(key).rows.push(row);
    }

    // Preload all zips for this file in bulk (1-2 queries instead of thousands)
    const uniqueZips = [...new Set([...addrGroups.values()].map((g) => g.zip).filter(Boolean))];
    await preloadBuildingsForZips(uniqueZips);

    // Match buildings for each unique address group (now synchronous, in-memory)
    for (const [key, group] of addrGroups) {
      const buildingId = matchBuilding(group.normalizedAddr, group.zip);

      for (const row of group.rows) {
        const rent = parseFloat(row.RENT_PRICE || row.rent_price || row.RENT || row.rent || row.PRICE || row.price || 0);
        if (!rent || rent < 200 || rent > 50000) continue; // sanity check

        const beds = parseBeds(row.BEDS || row.beds || row.BEDROOMS || row.bedrooms);
        const sqft = parseFloat(row.SQFT || row.sqft || row.SQUARE_FEET || row.square_feet || 0) || null;
        const dateStr = row.DATE_POSTED || row.date_posted || row.SCRAPED_TIMESTAMP || row.scraped_timestamp || row.DATE || row.date || "";
        const month = truncateToMonth(dateStr);
        if (!month) continue;

        const city = row._city;
        const zip = String(row.ZIP || row.zip || row.ZIPCODE || row.zipcode || "").trim().slice(0, 5);
        const metro = row._metro;

        if (buildingId) {
          // Building-level aggregation
          const bKey = `${buildingId}|${month}|${beds}`;
          if (!buildingAgg.has(bKey)) {
            buildingAgg.set(bKey, { buildingId, month, beds, rents: [], sqfts: [] });
          }
          const bAgg = buildingAgg.get(bKey);
          bAgg.rents.push(rent);
          if (sqft && sqft > 50) bAgg.sqfts.push(sqft);
          fileMatched++;
        } else {
          fileUnmatched++;

          // Track for new building creation
          if (!unmatchedBuildings.has(key)) {
            unmatchedBuildings.set(key, {
              normalizedAddr: group.normalizedAddr,
              zip: group.zip,
              lat: group.lat,
              lng: group.lng,
              city,
              state: row._state,
              metro,
              rawAddress: row.ADDRESS || row.address || "",
              yearBuilt: row.YEAR_BUILT || row.year_built || null,
            });
          }
        }

        // Neighborhood aggregation (all rows, matched or not)
        const nKey = `${city}|${zip}|${month}|${beds}`;
        if (!neighborhoodAgg.has(nKey)) {
          neighborhoodAgg.set(nKey, { city, zip, month, beds, rents: [], sqfts: [] });
        }
        const nAgg = neighborhoodAgg.get(nKey);
        nAgg.rents.push(rent);
        if (sqft && sqft > 50) nAgg.sqfts.push(sqft);

        // Amenity aggregation
        const amenities = extractAmenities(row);
        const ALL_AMENITIES = ["POOL", "GYM", "DOORMAN", "LAUNDRY", "GARAGE", "FURNISHED", "CLUBHOUSE", "GRANITE", "STAINLESS"];
        for (const amenity of ALL_AMENITIES) {
          const aKey = `${city}|${zip}|${amenity}|${beds}`;
          if (!amenityAgg.has(aKey)) {
            amenityAgg.set(aKey, { city, zip, amenity, beds, withRents: [], withoutRents: [] });
          }
          const aEntry = amenityAgg.get(aKey);
          if (amenities.has(amenity)) {
            aEntry.withRents.push(rent);
          } else {
            aEntry.withoutRents.push(rent);
          }
        }
      }
    }

    matchedRows += fileMatched;
    unmatchedRows += fileUnmatched;
    log(`    Matched: ${fileMatched}, Unmatched: ${fileUnmatched}`);

    progress.filesProcessed.push(fileName);
    progress.totalListingsFiltered = filteredRows;
    saveProgress(progress);
  }

  log(`\nProcessing complete:`);
  log(`  Total rows read: ${totalRows}`);
  log(`  Filtered to metros: ${filteredRows}`);
  log(`  Matched to buildings: ${matchedRows}`);
  log(`  Unmatched: ${unmatchedRows}`);
  log(`  Building aggregation buckets: ${buildingAgg.size}`);
  log(`  Neighborhood aggregation buckets: ${neighborhoodAgg.size}`);
  log(`  Unique unmatched addresses: ${unmatchedBuildings.size}`);

  return { buildingAgg, neighborhoodAgg, amenityAgg, unmatchedBuildings };
}

function parseBeds(val) {
  if (val === null || val === undefined || val === "") return 0;
  const s = String(val).trim().toUpperCase();
  if (s === "STUDIO" || s === "0" || s === "S") return 0;
  const n = parseInt(s, 10);
  if (isNaN(n)) return 0;
  return Math.min(n, 5); // cap at 5+
}

function extractAmenities(row) {
  const amenities = new Set();
  // Dewey data has individual Y/N columns for each amenity
  if (row.POOL === "Y" || row.pool === "Y") amenities.add("POOL");
  if (row.GYM === "Y" || row.gym === "Y") amenities.add("GYM");
  if (row.DOORMAN === "Y" || row.doorman === "Y") amenities.add("DOORMAN");
  if (row.LAUNDRY === "Y" || row.laundry === "Y") amenities.add("LAUNDRY");
  if (row.GARAGE === "Y" || row.garage === "Y") amenities.add("GARAGE");
  if (row.FURNISHED === "Y" || row.furnished === "Y") amenities.add("FURNISHED");
  if (row.CLUBHOUSE === "Y" || row.clubhouse === "Y") amenities.add("CLUBHOUSE");
  if (row.GRANITE === "Y" || row.granite === "Y") amenities.add("GRANITE");
  if (row.STAINLESS === "Y" || row.stainless === "Y") amenities.add("STAINLESS");
  // Also check description field for keyword matches as fallback
  const desc = (row.DESCRIPTION || row.description || "").toUpperCase();
  if (desc.includes("POOL") || desc.includes("SWIMMING")) amenities.add("POOL");
  if (desc.includes("GYM") || desc.includes("FITNESS CENTER")) amenities.add("GYM");
  if (desc.includes("DOORMAN") || desc.includes("CONCIERGE")) amenities.add("DOORMAN");

  return amenities;
}

// ── LOADING PHASE ───────────────────────────────────────────────────────────
async function loadBuildingRents(buildingAgg, progress) {
  const rows = [];
  for (const [, agg] of buildingAgg) {
    if (agg.rents.length === 0) continue;
    const pricePerSqft = agg.sqfts.length > 0
      ? avg(agg.rents) / avg(agg.sqfts)
      : null;

    rows.push({
      building_id: agg.buildingId,
      month: agg.month,
      beds: agg.beds,
      median_rent: median(agg.rents),
      min_rent: Math.min(...agg.rents),
      max_rent: Math.max(...agg.rents),
      p25_rent: percentile(agg.rents, 25),
      p75_rent: percentile(agg.rents, 75),
      avg_sqft: avg(agg.sqfts),
      avg_price_per_sqft: pricePerSqft,
      listing_count: agg.rents.length,
    });
  }

  log(`Upserting ${rows.length} building rent rows...`);
  if (DRY_RUN) {
    log("  (dry run, skipping)");
    return;
  }

  let upserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("dewey_building_rents")
      .upsert(batch, { onConflict: "building_id,month,beds" });

    if (error) {
      logError(`  Batch ${Math.floor(i / BATCH_SIZE) + 1} error`, error);
      // Retry one by one
      for (const row of batch) {
        const { error: singleErr } = await supabase
          .from("dewey_building_rents")
          .upsert(row, { onConflict: "building_id,month,beds" });
        if (!singleErr) upserted++;
        else logError("  Single upsert failed", singleErr);
      }
    } else {
      upserted += batch.length;
    }

    if (upserted % 2000 < BATCH_SIZE) {
      log(`  Building rents progress: ${upserted}/${rows.length}`);
    }
  }

  progress.totalBuildingRentsUpserted = upserted;
  saveProgress(progress);
  log(`  Building rents done: ${upserted} upserted`);
}

async function loadNeighborhoodRents(neighborhoodAgg, progress) {
  const rows = [];
  for (const [, agg] of neighborhoodAgg) {
    if (agg.rents.length === 0) continue;
    rows.push({
      city: agg.city,
      neighborhood: null,
      zip: agg.zip,
      month: agg.month,
      beds: agg.beds,
      median_rent: median(agg.rents),
      p25_rent: percentile(agg.rents, 25),
      p75_rent: percentile(agg.rents, 75),
      avg_sqft: avg(agg.sqfts),
      listing_count: agg.rents.length,
    });
  }

  log(`Upserting ${rows.length} neighborhood rent rows...`);
  if (DRY_RUN) {
    log("  (dry run, skipping)");
    return;
  }

  let upserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("dewey_neighborhood_rents")
      .upsert(batch, { onConflict: "city,zip,month,beds" });

    if (error) {
      logError(`  Batch ${Math.floor(i / BATCH_SIZE) + 1} error`, error);
      for (const row of batch) {
        const { error: singleErr } = await supabase
          .from("dewey_neighborhood_rents")
          .upsert(row, { onConflict: "city,zip,month,beds" });
        if (!singleErr) upserted++;
        else logError("  Single upsert failed", singleErr);
      }
    } else {
      upserted += batch.length;
    }

    if (upserted % 2000 < BATCH_SIZE) {
      log(`  Neighborhood rents progress: ${upserted}/${rows.length}`);
    }
  }

  progress.totalNeighborhoodRentsUpserted = upserted;
  saveProgress(progress);
  log(`  Neighborhood rents done: ${upserted} upserted`);
}

async function loadAmenityPremiums(amenityAgg) {
  if (!amenityAgg) return;
  const rows = [];

  for (const [, entry] of amenityAgg) {
    // Only compute if we have enough samples on both sides
    if (entry.withRents.length < 5 || entry.withoutRents.length < 5) continue;

    const medWith = median(entry.withRents);
    const medWithout = median(entry.withoutRents);
    if (!medWith || !medWithout || medWithout === 0) continue;

    const premiumPct = ((medWith - medWithout) / medWithout) * 100;
    const premiumDollars = medWith - medWithout;

    rows.push({
      city: entry.city,
      zip: entry.zip || null,
      amenity: entry.amenity.toLowerCase(),
      beds: entry.beds,
      median_with: medWith,
      median_without: medWithout,
      premium_pct: Math.round(premiumPct * 100) / 100,
      premium_dollars: Math.round(premiumDollars * 100) / 100,
      sample_size: entry.withRents.length + entry.withoutRents.length,
      period: "all_time",
    });
  }

  log(`Upserting ${rows.length} amenity premium rows...`);
  if (DRY_RUN) {
    log("  (dry run, skipping)");
    return;
  }

  let upserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("dewey_amenity_premiums")
      .upsert(batch, { onConflict: "city,COALESCE(zip,''),amenity,beds,period" });

    if (error) {
      // The COALESCE conflict target may not work via PostgREST — fall back to individual inserts
      for (const row of batch) {
        // Delete + insert pattern for the complex unique constraint
        await supabase
          .from("dewey_amenity_premiums")
          .delete()
          .eq("city", row.city)
          .eq("amenity", row.amenity)
          .eq("beds", row.beds)
          .eq("period", row.period)
          .is("zip", row.zip ? undefined : null)
          .then(() => {});

        if (row.zip) {
          await supabase
            .from("dewey_amenity_premiums")
            .delete()
            .eq("city", row.city)
            .eq("zip", row.zip)
            .eq("amenity", row.amenity)
            .eq("beds", row.beds)
            .eq("period", row.period);
        } else {
          await supabase
            .from("dewey_amenity_premiums")
            .delete()
            .eq("city", row.city)
            .is("zip", null)
            .eq("amenity", row.amenity)
            .eq("beds", row.beds)
            .eq("period", row.period);
        }

        const { error: insertErr } = await supabase
          .from("dewey_amenity_premiums")
          .insert(row);

        if (!insertErr) upserted++;
        else logError("  Amenity premium insert failed", insertErr);
      }
    } else {
      upserted += batch.length;
    }
  }

  log(`  Amenity premiums done: ${upserted} upserted`);
}

// ── NEW BUILDING CREATION ───────────────────────────────────────────────────
async function createNewBuildings(unmatchedBuildings, progress) {
  if (SKIP_NEW_BUILDINGS) {
    log("Skipping new building creation (--skip-new-buildings)");
    return;
  }

  // Filter to those with valid coordinates
  const candidates = [];
  for (const [, info] of unmatchedBuildings) {
    if (info.lat && info.lng && Math.abs(info.lat) > 1 && Math.abs(info.lng) > 1) {
      candidates.push(info);
    }
  }

  log(`Creating ${candidates.length} new buildings (from ${unmatchedBuildings.size} unmatched)...`);
  if (DRY_RUN) {
    log("  (dry run, skipping)");
    return;
  }

  const buildings = candidates.map((info) => {
    const fullAddress = `${info.normalizedAddr}, ${titleCase(info.city)}, ${info.state} ${info.zip}`;
    const parsed = parseStreetAddress(info.normalizedAddr);
    return {
      full_address: fullAddress,
      house_number: parsed.houseNumber,
      street_name: parsed.streetName,
      borough: getBoroughForRow(info.metro, info.city),
      city: titleCase(info.city),
      state: info.state,
      zip_code: info.zip,
      metro: info.metro,
      slug: generateSlug(info.normalizedAddr),
      latitude: info.lat,
      longitude: info.lng,
      year_built: info.yearBuilt ? parseInt(info.yearBuilt, 10) || null : null,
      violation_count: 0,
      complaint_count: 0,
      review_count: 0,
      overall_score: null,
    };
  });

  let inserted = 0;
  for (let i = 0; i < buildings.length; i += BATCH_SIZE) {
    const batch = buildings.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("buildings").insert(batch);

    if (error) {
      if (error.code === "23505") {
        // Duplicate key — insert one by one
        for (const row of batch) {
          const { error: singleErr } = await supabase.from("buildings").insert(row);
          if (!singleErr) inserted++;
          // silently skip duplicates
        }
      } else {
        logError(`  Batch ${Math.floor(i / BATCH_SIZE) + 1} error`, error);
      }
    } else {
      inserted += batch.length;
    }

    if (inserted % 1000 < BATCH_SIZE) {
      log(`  New buildings progress: ${inserted}/${buildings.length}`);
    }
  }

  progress.totalNewBuildings = inserted;
  saveProgress(progress);
  log(`  New buildings done: ${inserted} inserted`);
}

function titleCase(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function parseStreetAddress(normalizedAddr) {
  const match = normalizedAddr.match(/^(\d+[-\d]*)\s+(.+)$/);
  if (!match) return { houseNumber: "", streetName: normalizedAddr };
  return { houseNumber: match[1], streetName: match[2] };
}

// ── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  log("=== Dewey Data ETL Pipeline ===");
  log(`Pages: ${PAGE_START}–${PAGE_END}, DryRun: ${DRY_RUN}, Reset: ${RESET}`);
  log(`SkipDownload: ${SKIP_DOWNLOAD}, SkipNewBuildings: ${SKIP_NEW_BUILDINGS}`);
  log("");

  const progress = loadProgress();
  log(`Resuming from: ${progress.filesProcessed.length} files processed, ${progress.pagesDownloaded.length} pages downloaded`);

  // Phase 1: Download
  await downloadAllPages(progress);

  // Phase 2: Process
  const { buildingAgg, neighborhoodAgg, amenityAgg, unmatchedBuildings } = await processAllFiles(progress);

  // Phase 3: Load building rents
  await loadBuildingRents(buildingAgg, progress);

  // Phase 4: Load neighborhood rents
  await loadNeighborhoodRents(neighborhoodAgg, progress);

  // Phase 5: Load amenity premiums
  await loadAmenityPremiums(amenityAgg);

  // Phase 6: Create new buildings for unmatched addresses
  await createNewBuildings(unmatchedBuildings, progress);

  // Summary
  log("");
  log("=== ETL Complete ===");
  log(`  Building rent rows upserted: ${progress.totalBuildingRentsUpserted}`);
  log(`  Neighborhood rent rows upserted: ${progress.totalNeighborhoodRentsUpserted}`);
  log(`  New buildings created: ${progress.totalNewBuildings}`);
  log(`  Total listings filtered: ${progress.totalListingsFiltered}`);
  saveProgress(progress);
}

main().catch((err) => {
  logError("Fatal error", err);
  process.exit(1);
});

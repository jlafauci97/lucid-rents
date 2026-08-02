#!/usr/bin/env node
/**
 * ETL pipeline: Recorder (deed/transfer events) — companies-only owner refresh.
 *
 * Scope:
 *   - 5 metros via FIPS county codes
 *   - Company grantees only (drops individuals — upstream only has last names)
 *   - Most recent recording per parcel (ATTOMID)
 *   - Matches against existing buildings ONLY (no sidelining, no new buildings)
 *
 * Writes:
 *   - building_ownership_records (source_type='recorder', recording_date set)
 *   - buildings.owner_name (only when NULL — additive, never overwrites)
 *   - buildings.owner_type = 'company' (always, when matched)
 *
 * Usage:
 *   node scripts/etl-attom-recorder.mjs --dry-run
 *   node scripts/etl-attom-recorder.mjs --skip-download
 *   node scripts/etl-attom-recorder.mjs --reset
 *   node scripts/etl-attom-recorder.mjs --overwrite-owner
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
  "https://api.deweydata.io/api/v1/external/data/prj_bnrmqv8r__cdst_mvroi938bhogszhr";
const DOWNLOAD_DIR = "/tmp/attom-recorder";
const PROGRESS_FILE = resolve(__dirname, ".attom-recorder-progress.json");

const TARGET_FIPS = new Set([
  "06037", "17031", "48201", "12086",
  "36005", "36047", "36061", "36081", "36085",
]);

// ── ADDRESS NORMALIZATION (matches etl-attom-owners.mjs) ───────────────────
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
  return addr.split(" ").map((t) => DIRECTION_TO_ABBR[t] || STREET_TYPE_TO_ABBR[t] || t)
    .join(" ").replace(/\s+/g, " ").trim();
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
  } catch { /* corrupted */ }
  return defaultProgress();
}
function defaultProgress() {
  return {
    pagesDownloaded: [],
    filesProcessed: [],
    totalRowsFiltered: 0,
    totalCompanyRows: 0,
    totalUniqueParcels: 0,
    totalMatchedBuildings: 0,
    totalOwnershipRecordsInserted: 0,
    totalBuildingsTyped: 0,
    totalBuildingsNamed: 0,
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

// ── PARQUET READING ─────────────────────────────────────────────────────────
const PYTHON_PARQUET_SCRIPT = `
import sys
import pyarrow.parquet as pq
import pandas as pd

TARGET_FIPS = {'06037','17031','48201','12086','36005','36047','36061','36081','36085'}

cols = [
    'ATTOMID', 'TRANSACTIONID', 'RECORDINGDATE', 'INSTRUMENTDATE',
    'APNORIGINAL', 'APNFORMATTED',
    'DOCUMENTRECORDINGCOUNTYFIPS',
    'PROPERTYADDRESSFULL', 'PROPERTYADDRESSCITY',
    'PROPERTYADDRESSSTATE', 'PROPERTYADDRESSZIP',
    'GRANTEE1NAMELAST', 'GRANTEE1INFOENTITYCLASSIFICATION',
    'GRANTEEMAILADDRESSFULL',
    'TRANSFERAMOUNT',
]

t = pq.read_table(sys.argv[1])
available = [c for c in cols if c in t.column_names]
df = t.select(available).to_pandas()

# Filter: target FIPS
if 'DOCUMENTRECORDINGCOUNTYFIPS' in df.columns:
    df['DOCUMENTRECORDINGCOUNTYFIPS'] = df['DOCUMENTRECORDINGCOUNTYFIPS'].astype(str).str.zfill(5)
    df = df[df['DOCUMENTRECORDINGCOUNTYFIPS'].isin(TARGET_FIPS)]
if len(df) == 0:
    sys.exit(0)

# Companies only — entity classification 'NON' = non-individual (company/entity)
if 'GRANTEE1INFOENTITYCLASSIFICATION' in df.columns:
    df = df[df['GRANTEE1INFOENTITYCLASSIFICATION'].fillna('').str.upper() == 'NON']
if len(df) == 0:
    sys.exit(0)

# Non-empty grantee name
if 'GRANTEE1NAMELAST' in df.columns:
    df = df[df['GRANTEE1NAMELAST'].fillna('').str.strip() != '']
if len(df) == 0:
    sys.exit(0)

# Stringify dates
for col in ['RECORDINGDATE', 'INSTRUMENTDATE']:
    if col in df.columns:
        df[col] = df[col].astype(str).replace('NaT', '')

# Decimal -> float for JSON
import decimal
for col in df.columns:
    if df[col].dtype == object:
        sample = df[col].dropna().iloc[0] if len(df[col].dropna()) > 0 else None
        if isinstance(sample, decimal.Decimal):
            df[col] = df[col].apply(lambda x: float(x) if isinstance(x, decimal.Decimal) else x)

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
const apnIndex = new Map();
const zipAddrIndex = new Map();
const coordCells = new Map();
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
    if (error) { logError("preload error", error); continue; }
    for (const z of batch) if (!zipAddrIndex.has(z)) zipAddrIndex.set(z, new Map());
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
        const key = `${Math.round(b.latitude * 2000)}|${Math.round(b.longitude * 2000)}`;
        if (!coordCells.has(key)) coordCells.set(key, []);
        coordCells.get(key).push({ lat: b.latitude, lng: b.longitude, id: b.id });
      }
    }
  }
}

function matchBuilding(row) {
  const cacheKey = `${row.APNFORMATTED || row.APNORIGINAL || ""}|${row.PROPERTYADDRESSFULL || ""}|${row.PROPERTYADDRESSZIP || ""}`;
  if (matchCache.has(cacheKey)) return matchCache.get(cacheKey);

  // Tier 1: APN
  for (const apnRaw of [row.APNFORMATTED, row.APNORIGINAL]) {
    if (!apnRaw) continue;
    const apn = String(apnRaw).replace(/[^0-9A-Z]/gi, "").toUpperCase();
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

  // Recorder data lacks lat/lng for most rows, so we skip Tier 3 proximity.
  matchCache.set(cacheKey, null);
  return null;
}

// ── HELPERS ─────────────────────────────────────────────────────────────────
function parseDate(s) {
  if (!s) return null;
  if (typeof s === "string" && s.startsWith("1900-01-01")) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}
function parseSalePrice(v) {
  const n = parseFloat(v);
  if (isNaN(n) || n === 0) return null;
  return n;
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ── DOWNLOAD ────────────────────────────────────────────────────────────────
async function downloadAllPages(progress) {
  if (SKIP_DOWNLOAD) { log("Skipping download (--skip-download)"); return; }
  mkdirSync(DOWNLOAD_DIR, { recursive: true });
  log(`Downloading pages ${PAGE_START}–${PAGE_END}...`);

  for (let page = PAGE_START; page <= PAGE_END; page++) {
    if (progress.pagesDownloaded.includes(page)) {
      log(`  Page ${page}: already downloaded`);
      continue;
    }
    let pageData;
    try {
      pageData = await fetchPageList(page);
    } catch (err) {
      if (err.message.includes("404") || err.message.includes("400")) {
        log(`  Page ${page}: no more pages`);
        break;
      }
      logError(`Page ${page} fetch failed`, err);
      await sleep(5000);
      continue;
    }
    const links = pageData.download_links || pageData.data || pageData.results || [];
    if (!links.length) { log(`  Page ${page}: empty`); break; }
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
        logError(`Failed: ${fileName}`, err);
      }
      await sleep(500);
    }
    progress.pagesDownloaded.push(page);
    saveProgress(progress);
    await sleep(1000);
  }
  log("Download complete.");
}

// ── PROCESS ─────────────────────────────────────────────────────────────────
async function processAllFiles(progress) {
  if (!existsSync(DOWNLOAD_DIR)) {
    log("No download dir. Run without --skip-download first.");
    return null;
  }
  const allFiles = readdirSync(DOWNLOAD_DIR)
    .filter((f) => f.endsWith(".parquet"))
    .sort();
  log(`Processing ${allFiles.length} parquet files...`);

  // Per parcel (ATTOMID), keep only the LATEST recording. Recorder data is
  // event-driven, so the latest deed = current owner.
  const latestByParcel = new Map();
  let totalRows = 0;

  for (const fileName of allFiles) {
    if (progress.filesProcessed.includes(fileName)) {
      log(`  ${fileName}: already processed`);
      continue;
    }
    const filePath = join(DOWNLOAD_DIR, fileName);
    log(`  Reading ${fileName}...`);
    const rows = readParquetFile(filePath);
    log(`    ${rows.length} company rows after python filter`);
    totalRows += rows.length;

    for (const row of rows) {
      const id = String(row.ATTOMID || "");
      if (!id) continue;
      const recDate = parseDate(row.RECORDINGDATE) || parseDate(row.INSTRUMENTDATE);
      if (!recDate) continue;
      const recTime = new Date(recDate).getTime();
      const existing = latestByParcel.get(id);
      if (!existing || recTime > existing.time) {
        latestByParcel.set(id, { time: recTime, recordingDate: recDate, row });
      }
    }
    progress.filesProcessed.push(fileName);
    saveProgress(progress);
  }

  progress.totalRowsFiltered = totalRows;
  progress.totalUniqueParcels = latestByParcel.size;
  log("");
  log(`Read ${totalRows} company rows total, ${latestByParcel.size} unique parcels (latest recording)`);
  return latestByParcel;
}

// ── LOAD ────────────────────────────────────────────────────────────────────
async function loadOwnership(latestByParcel, progress) {
  const parcels = [...latestByParcel.values()];
  log(`Matching ${parcels.length} parcels to existing buildings...`);

  const uniqueZips = [...new Set(
    parcels.map((p) => String(p.row.PROPERTYADDRESSZIP || "").trim().slice(0, 5)).filter(Boolean)
  )];
  log(`  ${uniqueZips.length} unique zips to preload`);
  for (let i = 0; i < uniqueZips.length; i += 200) {
    await preloadBuildingsForZips(uniqueZips.slice(i, i + 200));
    if ((i / 200) % 10 === 0) log(`  Preloaded ${Math.min(i + 200, uniqueZips.length)}/${uniqueZips.length} zips`);
  }

  const ownershipRecords = [];
  const buildingUpdates = new Map();
  let matched = 0;
  let unmatched = 0;

  for (const { recordingDate, row } of parcels) {
    const buildingId = matchBuilding(row);
    if (!buildingId) { unmatched++; continue; }
    matched++;

    const txnId = String(row.TRANSACTIONID || row.ATTOMID);
    ownershipRecords.push({
      building_id: buildingId,
      source_type: "recorder",
      source_record_id: `rec:${txnId}`,
      assessment_year: parseInt(recordingDate.slice(0, 4), 10),
      recording_date: recordingDate,
      parcel_id: row.APNFORMATTED || row.APNORIGINAL || null,
      owner_name: String(row.GRANTEE1NAMELAST).trim(),
      owner_type: "company",
      owner_mailing_address: row.GRANTEEMAILADDRESSFULL || null,
      owner_mailing_city: null,
      owner_mailing_state: null,
      owner_mailing_zip: null,
      last_sale_date: recordingDate,
      last_sale_price: parseSalePrice(row.TRANSFERAMOUNT),
      assessed_value: null,
    });

    buildingUpdates.set(buildingId, {
      owner_name: String(row.GRANTEE1NAMELAST).trim(),
      owner_type: "company",
    });
  }

  log(`  Matched: ${matched}, Unmatched (skipped, no sidelining for Recorder): ${unmatched}`);
  progress.totalMatchedBuildings = matched;

  if (DRY_RUN) {
    log("Dry run — sample of first 3 records:");
    for (const r of ownershipRecords.slice(0, 3)) console.log(JSON.stringify(r, null, 2));
    return;
  }

  // 1. Upsert ownership records
  log(`Upserting ${ownershipRecords.length} ownership records (recorder)...`);
  let upserted = 0;
  for (let i = 0; i < ownershipRecords.length; i += BATCH_SIZE) {
    const batch = ownershipRecords.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("building_ownership_records")
      .upsert(batch, { onConflict: "source_record_id,assessment_year" });
    if (error) {
      logError(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}`, error);
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
      log(`  Records progress: ${upserted}/${ownershipRecords.length}`);
    }
  }
  progress.totalOwnershipRecordsInserted = upserted;
  log(`  Records done: ${upserted} upserted`);

  // 2. Building updates — same pattern as etl-attom-owners.mjs
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
  progress.totalBuildingsTyped = typed;
  progress.totalBuildingsNamed = named;
  log(`  Building updates done: ${typed} typed, ${named} name-touched`);

  saveProgress(progress);
}

// ── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  log("=== ATTOM Recorder Owner Refresh (companies only, additive) ===");
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
  log(`  Unique parcels: ${progress.totalUniqueParcels}`);
  log(`  Matched buildings: ${progress.totalMatchedBuildings}`);
  log(`  Ownership records inserted: ${progress.totalOwnershipRecordsInserted}`);
  log(`  Buildings typed: ${progress.totalBuildingsTyped}, name-touched: ${progress.totalBuildingsNamed}`);
}

main().catch((err) => { logError("Fatal", err); process.exit(1); });

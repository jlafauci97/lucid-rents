#!/usr/bin/env node
/**
 * Dwellsy ETL: enrichment layer from Dewey Data's Dwellsy dataset.
 *
 * - Merges rent data into existing dewey_building_rents & dewey_neighborhood_rents
 * - Extracts enrichment: photos, amenities, deposits, vacancy, company profiles
 * - Updates buildings.management_company from COMPANY_NAME
 * - 20 concurrent file workers for throughput
 *
 * Usage:
 *   DEWEY_API_KEY=akv1_... node scripts/etl-dwellsy.mjs [--page=1] [--workers=20] [--dry-run]
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = {};
for (const envFile of [".env.local", ".env.production.local"]) {
  try {
    for (const line of readFileSync(resolve(__dirname, "..", envFile), "utf8").split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) { const k = m[1].trim(); if (!env[k]) env[k] = m[2].trim().replace(/^"|"$/g, ""); }
    }
  } catch {}
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const API_KEY = process.env.DEWEY_API_KEY || env.DEWEY_API_KEY || "";
const PAGE = parseInt(process.argv.find(a => a.startsWith("--page="))?.split("=")[1] || "1");
const WORKERS = parseInt(process.argv.find(a => a.startsWith("--workers="))?.split("=")[1] || "10");
const DRY_RUN = process.argv.includes("--dry-run");
const FILE_START = parseInt(process.argv.find(a => a.startsWith("--start="))?.split("=")[1] || "0");
const FILE_END = parseInt(process.argv.find(a => a.startsWith("--end="))?.split("=")[1] || "9999");
const API_URL = "https://api.deweydata.io/api/v1/external/data/prj_bnrmqv8r__fldr_i3zgo3788i84oeasj";
const DOWNLOAD_DIR = `/tmp/dwellsy/p${PAGE}_${FILE_START}`;
const BATCH = 500;

function log(m) { console.log(`[${new Date().toISOString().slice(11,19)}] P${PAGE}:${FILE_START}: ${m}`); }

// ── Metro definitions (same 5 cities) ──
const METROS = {
  NY: { cities: new Set(["NEW YORK","BROOKLYN","QUEENS","BRONX","STATEN ISLAND","MANHATTAN","ASTORIA","FLUSHING","JAMAICA","LONG ISLAND CITY","RIDGEWOOD","WOODSIDE","JACKSON HEIGHTS","ELMHURST","FOREST HILLS","FRESH MEADOWS","BAYSIDE","KEW GARDENS","REGO PARK","SUNNYSIDE","CORONA","OZONE PARK","FAR ROCKAWAY","COLLEGE POINT","WHITESTONE","WOODHAVEN","SOUTH OZONE PARK","HOWARD BEACH","EAST ELMHURST"]), metro: "nyc" },
  CA: { cities: new Set(["LOS ANGELES","WEST HOLLYWOOD","SANTA MONICA","BURBANK","GLENDALE","PASADENA","LONG BEACH","CULVER CITY","INGLEWOOD","BEVERLY HILLS","TORRANCE","ALHAMBRA","DOWNEY","COMPTON","HAWTHORNE","REDONDO BEACH","HERMOSA BEACH","MANHATTAN BEACH","CARSON","GARDENA","LAKEWOOD","CERRITOS","NORTH HOLLYWOOD","STUDIO CITY","SHERMAN OAKS","ENCINO","TARZANA","WOODLAND HILLS","CANOGA PARK","RESEDA","VAN NUYS","PANORAMA CITY","NORTHRIDGE","GRANADA HILLS","SYLMAR","EAGLE ROCK","HIGHLAND PARK","SILVER LAKE","ECHO PARK","KOREATOWN"]), metro: "los-angeles" },
  IL: { cities: new Set(["CHICAGO","EVANSTON","OAK PARK","CICERO","BERWYN","SKOKIE"]), metro: "chicago" },
  FL: { cities: new Set(["MIAMI","MIAMI BEACH","FORT LAUDERDALE","HOLLYWOOD","CORAL GABLES","HIALEAH","DORAL","AVENTURA","NORTH MIAMI","NORTH MIAMI BEACH","SUNNY ISLES BEACH","HALLANDALE BEACH","PEMBROKE PINES","MIRAMAR","DAVIE","PLANTATION","SUNRISE","POMPANO BEACH","DEERFIELD BEACH","BOCA RATON","COCONUT GROVE","KEY BISCAYNE","HOMESTEAD","KENDALL","MIAMI GARDENS","MIAMI LAKES","SOUTH MIAMI","SURFSIDE"]), metro: "miami" },
  TX: { cities: new Set(["HOUSTON","PASADENA","SUGAR LAND","PEARLAND","KATY","SPRING","CYPRESS","HUMBLE","BAYTOWN","LEAGUE CITY","MISSOURI CITY","RICHMOND","FRIENDSWOOD","DEER PARK","BELLAIRE","CONROE","TOMBALL"]), metro: "houston" },
};

// Also match by MSA codes for Dwellsy data
const MSA_TO_METRO = {
  "35620": "nyc",     // New York-Newark-Jersey City
  "31080": "los-angeles", // Los Angeles-Long Beach-Anaheim
  "16980": "chicago",  // Chicago-Naperville-Elgin
  "33100": "miami",    // Miami-Fort Lauderdale-Pompano Beach
  "26420": "houston",  // Houston-The Woodlands-Sugar Land
};

function getMetro(row) {
  // Try MSA code first (100% coverage in Dwellsy)
  const msa = String(row.MSA_CODE || "").trim();
  if (MSA_TO_METRO[msa]) return MSA_TO_METRO[msa];
  // Fallback to state+city (Dwellsy uses ADDRESS_STATE / ADDRESS_CITY)
  const state = (row.ADDRESS_STATE || row.STATE || "").toUpperCase().trim();
  const city = (row.ADDRESS_CITY || row.CITY || "").toUpperCase().trim();
  const m = METROS[state];
  return m && m.cities.has(city) ? m.metro : null;
}

// ── Address normalization (shared with etl-dewey-fast) ──
const ST_ABBR = { STREET:"ST",AVENUE:"AVE",BOULEVARD:"BLVD",DRIVE:"DR",LANE:"LN",COURT:"CT",PLACE:"PL",ROAD:"RD",TERRACE:"TER",CIRCLE:"CIR",PARKWAY:"PKWY",HIGHWAY:"HWY",WAY:"WAY" };
const DIR_ABBR = { NORTH:"N",SOUTH:"S",EAST:"E",WEST:"W",NORTHEAST:"NE",NORTHWEST:"NW",SOUTHEAST:"SE",SOUTHWEST:"SW" };
function norm(addr) {
  if (!addr) return "";
  let a = addr.toUpperCase().trim()
    .replace(/\bAPT\.?\s*#?\s*\S+/gi, "").replace(/\bUNIT\s*#?\s*\S+/gi, "")
    .replace(/\bSTE\.?\s*#?\s*\S+/gi, "").replace(/\bSUITE\s*#?\s*\S+/gi, "")
    .replace(/(?:^|\s)#\s*\S+/g, "").replace(/[,]/g, " ").replace(/\s+/g, " ").trim();
  return a.split(" ").map(t => DIR_ABBR[t] || ST_ABBR[t] || t).join(" ");
}

// ── Zip-based building cache with lat/lon ──
const zipCache = new Map();       // zip -> Map<normAddr, {id, mgmt, lat, lon}>
const zipLatLon = new Map();      // zip -> [{id, lat, lon}]
async function preloadZips(zips) {
  const fresh = zips.filter(z => z && !zipCache.has(z));
  if (!fresh.length) return;
  for (let i = 0; i < fresh.length; i += 5) {
    const batch = fresh.slice(i, i + 5);
    const { data } = await supabase.from("buildings").select("id, full_address, zip_code, management_company, latitude, longitude").in("zip_code", batch).limit(50000);
    for (const z of batch) {
      if (!zipCache.has(z)) zipCache.set(z, new Map());
      if (!zipLatLon.has(z)) zipLatLon.set(z, []);
    }
    for (const b of (data || [])) {
      if (!zipCache.has(b.zip_code)) zipCache.set(b.zip_code, new Map());
      if (!zipLatLon.has(b.zip_code)) zipLatLon.set(b.zip_code, []);
      const info = { id: b.id, mgmt: b.management_company, lat: b.latitude, lon: b.longitude };
      const n = norm(b.full_address);
      if (n) zipCache.get(b.zip_code).set(n, info);
      if (b.latitude && b.longitude) zipLatLon.get(b.zip_code).push(info);
    }
  }
}

// Haversine distance in meters
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

const matchCache = new Map();
function matchBuilding(addr, zip, lat, lon) {
  const k = `${addr}|${zip}`;
  if (matchCache.has(k)) return matchCache.get(k);
  const m = zipCache.get(zip);
  if (!m) { matchCache.set(k, null); return null; }

  // 1. Exact address match
  if (m.has(addr)) { matchCache.set(k, m.get(addr)); return m.get(addr); }

  // 2. Fuzzy address substring match
  for (const [a, info] of m) {
    if (a.includes(addr) || addr.includes(a)) { matchCache.set(k, info); return info; }
  }

  // 3. Lat/lon proximity match (within 30m = same building)
  if (lat && lon) {
    const candidates = zipLatLon.get(zip) || [];
    let best = null, bestDist = 30; // 30m threshold
    for (const c of candidates) {
      if (!c.lat || !c.lon) continue;
      const d = haversine(lat, lon, c.lat, c.lon);
      if (d < bestDist) { bestDist = d; best = c; }
    }
    if (best) { matchCache.set(k, best); return best; }
  }

  matchCache.set(k, null);
  return null;
}

// ── Building creation for unmatched addresses ──
const METRO_TO_STATE = { nyc: "NY", "los-angeles": "CA", chicago: "IL", miami: "FL", houston: "TX" };
const createdAddresses = new Map(); // dedupKey -> buildingId
let totalCreated = 0;

const QUEENS_HOODS = new Set(["ASTORIA","FLUSHING","JAMAICA","LONG ISLAND CITY","RIDGEWOOD","WOODSIDE","JACKSON HEIGHTS","ELMHURST","FOREST HILLS","FRESH MEADOWS","BAYSIDE","KEW GARDENS","REGO PARK","SUNNYSIDE","CORONA","OZONE PARK","FAR ROCKAWAY","COLLEGE POINT","WHITESTONE","WOODHAVEN","SOUTH OZONE PARK","HOWARD BEACH","EAST ELMHURST"]);

// Building creation is now batch-based inside processFile

// ── Stats ──
function median(a) { if (!a.length) return null; const s = [...a].sort((x,y)=>x-y); const m = s.length>>1; return s.length%2 ? s[m] : (s[m-1]+s[m])/2; }
function pct(a, p) { if (!a.length) return null; const s = [...a].sort((x,y)=>x-y); const i = (p/100)*(s.length-1); const lo=Math.floor(i),hi=Math.ceil(i); return lo===hi?s[lo]:s[lo]+(s[hi]-s[lo])*(i-lo); }

// ── Python parquet reader (Dwellsy columns) ──
// Dwellsy uses: ADDRESS_STATE, ADDRESS_CITY, ADDRESS_1, ADDRESS_ZIP,
// RENT_AMOUNT, BEDROOMS, SQUARE_FEET, CREATION_TS, DEACTIVATION_TIME,
// COMPANY_NAME, MSA_CODE, AMENITIES, PHOTOS, LISTING_DEPOSIT, PROPERTY_LISTING_STATUS
const PY_SCRIPT = `
import sys, pyarrow.parquet as pq, pandas as pd, decimal
df = pq.read_table(sys.argv[1]).to_pandas()
# Filter by MSA codes (100% coverage) or state abbreviation
target_states = {'NY','CA','IL','FL','TX'}
target_msas = {'35620','31080','16980','33100','26420'}
# Dwellsy columns: ADDRESS_STATE or SS_RAW_STATE_ABBREVIATION
state_col = 'ADDRESS_STATE' if 'ADDRESS_STATE' in df.columns else 'STATE' if 'STATE' in df.columns else None
msa_col = 'MSA_CODE' if 'MSA_CODE' in df.columns else None
if msa_col and state_col:
    msa_str = df[msa_col].astype(str).str.strip()
    mask = df[state_col].astype(str).str.strip().isin(target_states) | msa_str.isin(target_msas)
    df = df[mask]
elif state_col:
    df = df[df[state_col].astype(str).str.strip().isin(target_states)]
elif msa_col:
    df = df[df[msa_col].astype(str).str.strip().isin(target_msas)]
else:
    sys.exit(0)
if len(df) == 0: sys.exit(0)
for col in df.columns:
    if df[col].dtype == object:
        sample = df[col].dropna().iloc[0] if len(df[col].dropna()) > 0 else None
        if isinstance(sample, decimal.Decimal):
            df[col] = df[col].apply(lambda x: float(x) if isinstance(x, decimal.Decimal) else x)
for col in ['CREATION_TS','DEACTIVATION_TIME','DATE_POSTED','SCRAPED_TIMESTAMP','AVAILABLE_AT']:
    if col in df.columns: df[col] = df[col].astype(str).replace('NaT','')
sys.stdout.write(df.to_json(orient='records', lines=True, default_handler=str))
`;

function readParquet(path) {
  const pyPath = join(DOWNLOAD_DIR, `_r_${process.pid}.py`);
  writeFileSync(pyPath, PY_SCRIPT);
  try {
    const out = execFileSync("python3", [pyPath, path], { maxBuffer: 1024*1024*1024, encoding: "utf8" });
    return out.split("\n").filter(l => l.trim()).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch (e) { log(`ERROR reading ${path}: ${e.message?.slice(0,80)}`); return []; }
  finally { try { unlinkSync(pyPath); } catch {} }
}

function toMonth(d) {
  if (!d || d === "NaT" || d === "None") return null;
  const dt = new Date(d);
  if (isNaN(dt)) return null;
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-01`;
}

function daysBetween(d1, d2) {
  if (!d1 || !d2 || d1 === "NaT" || d2 === "NaT") return null;
  const a = new Date(d1), b = new Date(d2);
  if (isNaN(a) || isNaN(b)) return null;
  return Math.abs(b - a) / (1000 * 60 * 60 * 24);
}

// ── Shared aggregation maps (mutexed by single-thread file processing) ──
const buildingAgg = new Map();
const neighborhoodAgg = new Map();
const buildingMeta = new Map();     // buildingId -> { photos, amenities, deposits, daysOnMarket, companies, active, deactivated }
const companyAgg = new Map();       // company|metro -> { rents, buildings, listings, deposits, daysOnMarket, amenities }
const neighborhoodStats = new Map(); // metro|zip|month -> { deposits, daysOnMarket, active, deactivated }
const mgmtUpdates = new Map();      // buildingId -> company_name (latest)

let totalFiltered = 0, totalMatched = 0;

// ── Process a single file ──
async function processFile(link, fi, total) {
  const url = link.link;
  const fname = link.file_name;
  const fpath = join(DOWNLOAD_DIR, fname);

  // Download with timeout and progress
  log(`  [${fi+1}/${total}] Downloading ${fname}...`);
  const dlStart = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 300000); // 5min timeout
    const r = await fetch(url, { headers: { "X-API-KEY": API_KEY }, signal: controller.signal });
    clearTimeout(timeout);
    if (!r.ok) { log(`DL fail ${fname}: ${r.status}`); return; }
    writeFileSync(fpath, Buffer.from(await r.arrayBuffer()));
    const mb = (existsSync(fpath) ? readFileSync(fpath).length / 1048576 : 0).toFixed(1);
    log(`  [${fi+1}/${total}] Downloaded ${fname} (${mb}MB, ${((Date.now()-dlStart)/1000).toFixed(0)}s)`);
  } catch (e) { log(`DL error ${fname}: ${e.message?.slice(0,60)}`); return; }

  // Read + filter
  log(`  [${fi+1}/${total}] Parsing ${fname}...`);
  const rows = readParquet(fpath);
  try { unlinkSync(fpath); } catch {}

  const filtered = [];
  for (const row of rows) {
    const metro = getMetro(row);
    if (metro) { row._metro = metro; filtered.push(row); }
  }

  if (!filtered.length) { log(`  [${fi+1}/${total}] ${fname}: 0 metro rows`); return; }

  // Collect unique zips and preload
  const zips = [...new Set(filtered.map(r => String(r.ADDRESS_ZIP || r.ZIP || "").trim().slice(0,5)).filter(Boolean))];
  await preloadZips(zips);

  // ── PASS 1: identify unmatched addresses and batch-create new buildings ──
  const unmatchedBuildings = new Map(); // dedupKey -> building object
  for (const row of filtered) {
    const rent = parseFloat(row.RENT_AMOUNT || row.RENT_PRICE || 0);
    const zip = String(row.ADDRESS_ZIP || row.ZIP || "").trim().slice(0,5);
    const addr = norm(row.ADDRESS_1 || row.ADDRESS || "");
    const lat = parseFloat(row.LATITUDE) || null;
    const lon = parseFloat(row.LONGITUDE) || null;
    if (!addr || !zip || rent < 200) continue;
    const buildingInfo = matchBuilding(addr, zip, lat, lon);
    if (!buildingInfo) {
      const dedupKey = `${addr}|${zip}`;
      if (!createdAddresses.has(dedupKey) && !unmatchedBuildings.has(dedupKey)) {
        const rawAddr = (row.ADDRESS_1 || row.ADDRESS || "").trim();
        const city = (row.ADDRESS_CITY || row.CITY || "").trim();
        const state = METRO_TO_STATE[row._metro] || (row.ADDRESS_STATE || row.STATE || "").trim();
        const yearBuilt = parseInt(row.YEAR_BUILT) || null;
        let borough = city;
        if (row._metro === "nyc") {
          const c = city.toUpperCase();
          if (c === "NEW YORK" || c === "MANHATTAN") borough = "Manhattan";
          else if (c === "BROOKLYN") borough = "Brooklyn";
          else if (QUEENS_HOODS.has(c) || c === "QUEENS") borough = "Queens";
          else if (c === "BRONX") borough = "Bronx";
          else if (c === "STATEN ISLAND") borough = "Staten Island";
        }
        const slug = `${rawAddr}-${zip}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        unmatchedBuildings.set(dedupKey, {
          full_address: `${rawAddr}, ${borough || city}, ${state}, ${zip}`,
          street_name: rawAddr.replace(/^\d+\s+/, ""),
          house_number: rawAddr.match(/^(\d+)/)?.[1] || null,
          city, state, zip_code: zip, borough: borough || city, metro: row._metro,
          slug, latitude: lat, longitude: lon, year_built: yearBuilt,
          overall_score: 5.0, review_count: 0, violation_count: 0, complaint_count: 0,
          litigation_count: 0, dob_violation_count: 0, crime_count: 0,
          bedbug_report_count: 0, eviction_count: 0, permit_count: 0,
          _dedupKey: dedupKey, _addr: addr, _zip: zip,
        });
      }
    }
  }

  // Batch-insert new buildings (500 at a time)
  if (unmatchedBuildings.size > 0) {
    log(`  [${fi+1}/${total}] Creating ${unmatchedBuildings.size} new buildings...`);
    const batches = [...unmatchedBuildings.values()];
    for (let i = 0; i < batches.length; i += BATCH) {
      const chunk = batches.slice(i, i + BATCH);
      const toInsert = chunk.map(b => { const { _dedupKey, _addr, _zip, ...rest } = b; return rest; });
      const toInsertWithReturn = toInsert;
      const { data, error } = await supabase.from("buildings").insert(toInsertWithReturn).select("id, slug, zip_code");
      if (error) {
        // Batch failed (likely duplicate slugs) — insert one at a time, skip dupes
        let batchCreated = 0;
        for (const b of chunk) {
          const { _dedupKey, _addr, _zip, ...rest } = b;
          try {
            const { data: d2, error: e2 } = await supabase.from("buildings").insert(rest).select("id").single();
            if (d2?.id) {
              createdAddresses.set(_dedupKey, d2.id);
              if (!zipCache.has(_zip)) zipCache.set(_zip, new Map());
              zipCache.get(_zip).set(_addr, { id: d2.id, mgmt: null });
              matchCache.delete(_dedupKey);
              totalCreated++;
              batchCreated++;
            } else if (e2) {
              // Slug conflict — mark as failed so we don't retry
              createdAddresses.set(_dedupKey, null);
            }
          } catch { createdAddresses.set(_dedupKey, null); }
        }
        if (batchCreated > 0) log(`    fallback created ${batchCreated}/${chunk.length}`);
      } else if (data) {
        for (let j = 0; j < data.length && j < chunk.length; j++) {
          const b = chunk[j];
          const id = data[j]?.id;
          if (id) {
            createdAddresses.set(b._dedupKey, id);
            if (!zipCache.has(b._zip)) zipCache.set(b._zip, new Map());
            zipCache.get(b._zip).set(b._addr, { id, mgmt: null });
            matchCache.delete(b._dedupKey);
            totalCreated++;
          }
        }
      }
    }
  }

  // ── PASS 2: aggregate with 100% building IDs ──
  let matched = 0;
  for (const row of filtered) {
    const rent = parseFloat(row.RENT_AMOUNT || row.RENT_PRICE || 0);
    const beds = Math.min(parseInt(row.BEDROOMS || row.BEDS) || 0, 5);
    const sqft = parseFloat(row.SQUARE_FEET || row.SQFT || 0) || null;
    const month = toMonth(row.CREATION_TS || row.DATE_POSTED || row.SCRAPED_TIMESTAMP);
    const zip = String(row.ADDRESS_ZIP || row.ZIP || "").trim().slice(0,5);
    const addr = norm(row.ADDRESS_1 || row.ADDRESS || "");
    const lat = parseFloat(row.LATITUDE) || null;
    const lon = parseFloat(row.LONGITUDE) || null;

    // Try cache/match first, then check created addresses
    let buildingInfo = addr ? matchBuilding(addr, zip, lat, lon) : null;
    let buildingId = buildingInfo?.id || null;
    if (!buildingId) {
      const dedupKey = `${addr}|${zip}`;
      buildingId = createdAddresses.get(dedupKey) || null;
    }

    const company = (row.COMPANY_NAME || row.COMPANY || "").trim();
    const deposit = parseFloat(row.LISTING_DEPOSIT || 0) || null;
    const photos = (row.PHOTOS || "").split(";").map(s => s.trim()).filter(Boolean);
    const amenities = (row.AMENITIES || "").split(";").map(s => s.trim()).filter(Boolean);
    const isActive = (row.PROPERTY_LISTING_STATUS || "").toLowerCase() === "active";
    const dom = daysBetween(row.CREATION_TS || row.DATE_POSTED, row.DEACTIVATION_TIME);

    // ── Rent aggregation (merge into existing Dewey tables) ──
    if (rent >= 200 && rent <= 50000 && month) {
      if (buildingId) {
        const bk = `${buildingId}|${month}|${beds}`;
        if (!buildingAgg.has(bk)) buildingAgg.set(bk, { buildingId, month, beds, rents: [], sqfts: [] });
        buildingAgg.get(bk).rents.push(rent);
        if (sqft > 50) buildingAgg.get(bk).sqfts.push(sqft);
        matched++;
      }
      // Neighborhood always
      const nk = `${row._metro}|${zip}|${month}|${beds}`;
      if (!neighborhoodAgg.has(nk)) neighborhoodAgg.set(nk, { city: row._metro, zip, month, beds, rents: [], sqfts: [] });
      neighborhoodAgg.get(nk).rents.push(rent);
      if (sqft > 50) neighborhoodAgg.get(nk).sqfts.push(sqft);
    }

    // ── Building enrichment metadata ──
    if (buildingId) {
      if (!buildingMeta.has(buildingId)) {
        buildingMeta.set(buildingId, {
          photos: new Set(), amenities: new Set(), deposits: [], daysOnMarket: [],
          companies: new Map(), active: 0, deactivated: 0
        });
      }
      const bm = buildingMeta.get(buildingId);
      for (const p of photos) bm.photos.add(p);
      for (const a of amenities) bm.amenities.add(a);
      if (deposit && deposit > 0) bm.deposits.push(deposit);
      if (dom != null && dom >= 0 && dom < 365) bm.daysOnMarket.push(dom);
      if (company) bm.companies.set(company, (bm.companies.get(company) || 0) + 1);
      if (isActive) bm.active++;
      else bm.deactivated++;

      // Track latest company for management_company update
      if (company) mgmtUpdates.set(buildingId, company);
    }

    // ── Company aggregation ──
    if (company && rent >= 200 && rent <= 50000) {
      const ck = `${company}|${row._metro}`;
      if (!companyAgg.has(ck)) {
        companyAgg.set(ck, { company, metro: row._metro, rents: [], buildings: new Set(), deposits: [], daysOnMarket: [], amenities: new Map(), active: 0, deactivated: 0 });
      }
      const ca = companyAgg.get(ck);
      ca.rents.push(rent);
      if (buildingId) ca.buildings.add(buildingId);
      if (deposit && deposit > 0) ca.deposits.push(deposit);
      if (dom != null && dom >= 0 && dom < 365) ca.daysOnMarket.push(dom);
      for (const a of amenities) ca.amenities.set(a, (ca.amenities.get(a) || 0) + 1);
      if (isActive) ca.active++;
      else ca.deactivated++;
    }

    // ── Neighborhood vacancy stats ──
    if (month && zip) {
      const nsk = `${row._metro}|${zip}|${month}`;
      if (!neighborhoodStats.has(nsk)) {
        neighborhoodStats.set(nsk, { metro: row._metro, zip, month, deposits: [], daysOnMarket: [], active: 0, deactivated: 0 });
      }
      const ns = neighborhoodStats.get(nsk);
      if (deposit && deposit > 0) ns.deposits.push(deposit);
      if (dom != null && dom >= 0 && dom < 365) ns.daysOnMarket.push(dom);
      if (isActive) ns.active++;
      else ns.deactivated++;
    }
  }

  totalFiltered += filtered.length;
  totalMatched += matched;
  log(`  [${fi+1}/${total}] ${fname}: ${filtered.length} metro, ${matched} matched, ${buildingMeta.size} buildings enriched`);
}

// ── MAIN ──
async function main() {
  log(`Starting Dwellsy ETL page ${PAGE} with ${WORKERS} workers${DRY_RUN ? " (DRY RUN)" : ""}`);
  mkdirSync(DOWNLOAD_DIR, { recursive: true });

  // Fetch file list
  const res = await fetch(`${API_URL}?page=${PAGE}`, { headers: { "X-API-KEY": API_KEY } });
  if (!res.ok) { log(`API error: ${res.status}`); process.exit(1); }
  const data = await res.json();
  const links = data.download_links || [];
  log(`${links.length} files on page ${PAGE}`);

  // Process only our assigned file range
  const start = Math.max(0, FILE_START);
  const end = Math.min(links.length, FILE_END);
  log(`Processing files ${start}-${end-1} of ${links.length}`);
  for (let i = start; i < end; i++) {
    await processFile(links[i], i, links.length);
  }

  log(`Processing done: ${totalFiltered} filtered, ${totalMatched} matched (${totalCreated} new buildings created)`);
  log(`  ${buildingAgg.size} bldg rent buckets, ${neighborhoodAgg.size} hood rent buckets`);
  log(`  ${buildingMeta.size} buildings enriched, ${companyAgg.size} companies, ${neighborhoodStats.size} hood stat buckets`);

  if (DRY_RUN) {
    log("DRY RUN — skipping upserts");
    return;
  }

  log(`Buildings created inline: ${totalCreated}`);

  // ══════════════════════════════════════════════════════════════════════
  // UPSERT PHASE — all in parallel batches
  // ══════════════════════════════════════════════════════════════════════

  // 1. Building rents → merge into dewey_building_rents
  const bRows = [];
  for (const [, v] of buildingAgg) {
    bRows.push({
      building_id: v.buildingId, month: v.month, beds: v.beds,
      median_rent: median(v.rents), min_rent: Math.min(...v.rents), max_rent: Math.max(...v.rents),
      p25_rent: pct(v.rents, 25), p75_rent: pct(v.rents, 75),
      avg_sqft: v.sqfts.length ? v.sqfts.reduce((s,x)=>s+x,0)/v.sqfts.length : null,
      avg_price_per_sqft: v.sqfts.length ? median(v.rents) / (v.sqfts.reduce((s,x)=>s+x,0)/v.sqfts.length) : null,
      listing_count: v.rents.length,
    });
  }
  log(`Upserting ${bRows.length} building rent rows (merged)...`);
  for (let i = 0; i < bRows.length; i += BATCH) {
    const { error } = await supabase.from("dewey_building_rents").upsert(bRows.slice(i, i + BATCH), { onConflict: "building_id,month,beds" });
    if (error) log(`  bldg rent upsert err batch ${i}: ${error.message?.slice(0,80)}`);
  }

  // 2. Neighborhood rents → merge into dewey_neighborhood_rents
  const nRows = [];
  for (const [, v] of neighborhoodAgg) {
    nRows.push({
      city: v.city, zip: v.zip, month: v.month, beds: v.beds,
      median_rent: median(v.rents), p25_rent: pct(v.rents, 25), p75_rent: pct(v.rents, 75),
      avg_sqft: v.sqfts.length ? v.sqfts.reduce((s,x)=>s+x,0)/v.sqfts.length : null,
      listing_count: v.rents.length,
    });
  }
  log(`Upserting ${nRows.length} neighborhood rent rows (merged)...`);
  for (let i = 0; i < nRows.length; i += BATCH) {
    const { error } = await supabase.from("dewey_neighborhood_rents").upsert(nRows.slice(i, i + BATCH), { onConflict: "city,zip,month,beds" });
    if (error) log(`  hood rent upsert err batch ${i}: ${error.message?.slice(0,80)}`);
  }

  // 3. Building enrichment → dwellsy_building_meta
  const metaRows = [];
  for (const [buildingId, bm] of buildingMeta) {
    const topCompany = bm.companies.size > 0
      ? [...bm.companies.entries()].sort((a, b) => b[1] - a[1])[0][0]
      : null;
    metaRows.push({
      building_id: buildingId,
      photos: [...bm.photos].slice(0, 20), // cap at 20 photos
      amenities: [...bm.amenities],
      avg_deposit: bm.deposits.length ? median(bm.deposits) : null,
      avg_days_on_market: bm.daysOnMarket.length ? median(bm.daysOnMarket) : null,
      active_listing_count: bm.active,
      last_company_name: topCompany,
      last_updated: new Date().toISOString(),
    });
  }
  log(`Upserting ${metaRows.length} building meta rows...`);
  for (let i = 0; i < metaRows.length; i += BATCH) {
    const { error } = await supabase.from("dwellsy_building_meta").upsert(metaRows.slice(i, i + BATCH), { onConflict: "building_id" });
    if (error) log(`  meta upsert err batch ${i}: ${error.message?.slice(0,80)}`);
  }

  // 4. Company profiles → dwellsy_company_profiles
  const compRows = [];
  for (const [, ca] of companyAgg) {
    const topAmenities = [...ca.amenities.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(e => e[0]);
    compRows.push({
      company_name: ca.company,
      metro: ca.metro,
      total_listings: ca.rents.length,
      active_listings: ca.active,
      avg_rent: median(ca.rents),
      avg_deposit: ca.deposits.length ? median(ca.deposits) : null,
      avg_days_on_market: ca.daysOnMarket.length ? median(ca.daysOnMarket) : null,
      building_count: ca.buildings.size,
      top_amenities: topAmenities,
      last_updated: new Date().toISOString(),
    });
  }
  log(`Upserting ${compRows.length} company profile rows...`);
  for (let i = 0; i < compRows.length; i += BATCH) {
    const { error } = await supabase.from("dwellsy_company_profiles").upsert(compRows.slice(i, i + BATCH), { onConflict: "company_name,metro" });
    if (error) log(`  company upsert err batch ${i}: ${error.message?.slice(0,80)}`);
  }

  // 5. Neighborhood stats → dwellsy_neighborhood_stats
  const nsRows = [];
  for (const [, ns] of neighborhoodStats) {
    const totalListings = ns.active + ns.deactivated;
    nsRows.push({
      metro: ns.metro,
      zip: ns.zip,
      month: ns.month,
      avg_deposit: ns.deposits.length ? median(ns.deposits) : null,
      avg_days_on_market: ns.daysOnMarket.length ? median(ns.daysOnMarket) : null,
      active_listings: ns.active,
      deactivated_listings: ns.deactivated,
      vacancy_rate: totalListings > 0 ? ns.active / totalListings : null,
    });
  }
  log(`Upserting ${nsRows.length} neighborhood stat rows...`);
  for (let i = 0; i < nsRows.length; i += BATCH) {
    const { error } = await supabase.from("dwellsy_neighborhood_stats").upsert(nsRows.slice(i, i + BATCH), { onConflict: "metro,zip,month" });
    if (error) log(`  hood stats upsert err batch ${i}: ${error.message?.slice(0,80)}`);
  }

  // 6. Update buildings.management_company where we have new data
  log(`Updating management_company for ${mgmtUpdates.size} buildings...`);
  const mgmtBatches = [...mgmtUpdates.entries()];
  for (let i = 0; i < mgmtBatches.length; i += 50) {
    const batch = mgmtBatches.slice(i, i + 50);
    await Promise.all(batch.map(([buildingId, company]) =>
      supabase.from("buildings").update({ management_company: company }).eq("id", buildingId).is("management_company", null)
    ));
  }

  // Cleanup
  try { const { rmdirSync } = await import("fs"); rmdirSync(DOWNLOAD_DIR, { recursive: true }); } catch {}

  log(`=== PAGE ${PAGE} COMPLETE ===`);
  log(`  Rents: ${bRows.length} bldg, ${nRows.length} hood (merged into dewey tables)`);
  log(`  Enrichment: ${metaRows.length} meta, ${compRows.length} companies, ${nsRows.length} hood stats`);
  log(`  Management companies: ${mgmtUpdates.size} buildings updated`);
}

main().catch(e => { log(`FATAL: ${e.message}`); process.exit(1); });

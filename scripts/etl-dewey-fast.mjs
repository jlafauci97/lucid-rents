#!/usr/bin/env node
/**
 * Fast ETL: processes ONE page at a time, upserts immediately, deletes files.
 * Usage: node scripts/etl-dewey-fast.mjs --page=1
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
const API_URL = "https://api.deweydata.io/api/v1/external/data/prj_bnrmqv8r__fldr_cggezfmh4zsrfevk8";
const DOWNLOAD_DIR = `/tmp/dewey/p${PAGE}`;
const BATCH = 500;

function log(m) { console.log(`[${new Date().toISOString().slice(11,19)}] P${PAGE}: ${m}`); }

// Metro definitions
const METROS = {
  NY: { cities: new Set(["NEW YORK","BROOKLYN","QUEENS","BRONX","STATEN ISLAND","MANHATTAN","ASTORIA","FLUSHING","JAMAICA","LONG ISLAND CITY","RIDGEWOOD","WOODSIDE","JACKSON HEIGHTS","ELMHURST","FOREST HILLS","FRESH MEADOWS","BAYSIDE","KEW GARDENS","REGO PARK","SUNNYSIDE","CORONA","OZONE PARK","FAR ROCKAWAY","COLLEGE POINT","WHITESTONE","WOODHAVEN","SOUTH OZONE PARK","HOWARD BEACH","EAST ELMHURST"]), metro: "nyc" },
  CA: { cities: new Set(["LOS ANGELES","WEST HOLLYWOOD","SANTA MONICA","BURBANK","GLENDALE","PASADENA","LONG BEACH","CULVER CITY","INGLEWOOD","BEVERLY HILLS","TORRANCE","ALHAMBRA","DOWNEY","COMPTON","HAWTHORNE","REDONDO BEACH","HERMOSA BEACH","MANHATTAN BEACH","CARSON","GARDENA","LAKEWOOD","CERRITOS","NORTH HOLLYWOOD","STUDIO CITY","SHERMAN OAKS","ENCINO","TARZANA","WOODLAND HILLS","CANOGA PARK","RESEDA","VAN NUYS","PANORAMA CITY","NORTHRIDGE","GRANADA HILLS","SYLMAR","EAGLE ROCK","HIGHLAND PARK","SILVER LAKE","ECHO PARK","KOREATOWN"]), metro: "los-angeles" },
  IL: { cities: new Set(["CHICAGO","EVANSTON","OAK PARK","CICERO","BERWYN","SKOKIE"]), metro: "chicago" },
  FL: { cities: new Set(["MIAMI","MIAMI BEACH","FORT LAUDERDALE","HOLLYWOOD","CORAL GABLES","HIALEAH","DORAL","AVENTURA","NORTH MIAMI","NORTH MIAMI BEACH","SUNNY ISLES BEACH","HALLANDALE BEACH","PEMBROKE PINES","MIRAMAR","DAVIE","PLANTATION","SUNRISE","POMPANO BEACH","DEERFIELD BEACH","BOCA RATON","COCONUT GROVE","KEY BISCAYNE","HOMESTEAD","KENDALL","MIAMI GARDENS","MIAMI LAKES","SOUTH MIAMI","SURFSIDE"]), metro: "miami" },
  TX: { cities: new Set(["HOUSTON","PASADENA","SUGAR LAND","PEARLAND","KATY","SPRING","CYPRESS","HUMBLE","BAYTOWN","LEAGUE CITY","MISSOURI CITY","RICHMOND","FRIENDSWOOD","DEER PARK","BELLAIRE","CONROE","TOMBALL"]), metro: "houston" },
};

function getMetro(state, city) {
  const m = METROS[state];
  return m && m.cities.has(city) ? m.metro : null;
}

// Address normalization
const ST_ABBR = { STREET:"ST",AVENUE:"AVE",BOULEVARD:"BLVD",DRIVE:"DR",LANE:"LN",COURT:"CT",PLACE:"PL",ROAD:"RD",TERRACE:"TER",CIRCLE:"CIR",PARKWAY:"PKWY",HIGHWAY:"HWY",WAY:"WAY" };
const DIR_ABBR = { NORTH:"N",SOUTH:"S",EAST:"E",WEST:"W",NORTHEAST:"NE",NORTHWEST:"NW",SOUTHEAST:"SE",SOUTHWEST:"SW" };
function norm(addr) {
  if (!addr) return "";
  let a = addr.toUpperCase().trim()
    .replace(/\bAPT\.?\s*#?\s*\S+/gi, "").replace(/\bUNIT\s*#?\s*\S+/gi, "")
    .replace(/\bSTE\.?\s*#?\s*\S+/gi, "").replace(/\bSUITE\s*#?\s*\S+/gi, "")
    .replace(/(?:^|\s)#\s*\S+/g, "").replace(/\s+/g, " ").trim();
  return a.split(" ").map(t => DIR_ABBR[t] || ST_ABBR[t] || t).join(" ");
}

// Zip-based building cache
const zipCache = new Map();
async function preloadZips(zips) {
  const fresh = zips.filter(z => z && !zipCache.has(z));
  if (!fresh.length) return;
  for (let i = 0; i < fresh.length; i += 20) {
    const batch = fresh.slice(i, i + 20);
    const { data } = await supabase.from("buildings").select("id, full_address, zip_code").in("zip_code", batch).limit(10000);
    for (const z of batch) if (!zipCache.has(z)) zipCache.set(z, new Map());
    for (const b of (data || [])) {
      if (!zipCache.has(b.zip_code)) zipCache.set(b.zip_code, new Map());
      const n = norm(b.full_address);
      if (n) zipCache.get(b.zip_code).set(n, b.id);
      const street = n.split(",")[0]?.trim();
      if (street && street !== n) zipCache.get(b.zip_code).set(street, b.id);
    }
  }
}

const matchCache = new Map();
function match(addr, zip) {
  const k = `${addr}|${zip}`;
  if (matchCache.has(k)) return matchCache.get(k);
  const m = zipCache.get(zip);
  if (!m) { matchCache.set(k, null); return null; }
  if (m.has(addr)) { matchCache.set(k, m.get(addr)); return m.get(addr); }
  const street = addr.split(",")[0]?.trim();
  if (street && m.has(street)) { matchCache.set(k, m.get(street)); return m.get(street); }
  for (const [a, id] of m) {
    if (a.includes(addr) || addr.includes(a)) { matchCache.set(k, id); return id; }
  }
  matchCache.set(k, null);
  return null;
}

// Stats
function median(a) { if (!a.length) return null; const s = [...a].sort((x,y)=>x-y); const m = s.length>>1; return s.length%2 ? s[m] : (s[m-1]+s[m])/2; }
function pct(a, p) { if (!a.length) return null; const s = [...a].sort((x,y)=>x-y); const i = (p/100)*(s.length-1); const lo=Math.floor(i),hi=Math.ceil(i); return lo===hi?s[lo]:s[lo]+(s[hi]-s[lo])*(i-lo); }

// Python parquet reader
const PY_SCRIPT = `
import sys, pyarrow.parquet as pq, pandas as pd
df = pq.read_table(sys.argv[1]).to_pandas()
df = df[df['STATE'].isin({'NY','CA','IL','FL','TX'})]
if len(df) == 0: sys.exit(0)
import decimal
for col in df.columns:
    if df[col].dtype == object:
        sample = df[col].dropna().iloc[0] if len(df[col].dropna()) > 0 else None
        if isinstance(sample, decimal.Decimal):
            df[col] = df[col].apply(lambda x: float(x) if isinstance(x, decimal.Decimal) else x)
for col in ['DATE_POSTED','SCRAPED_TIMESTAMP','AVAILABLE_AT']:
    if col in df.columns: df[col] = df[col].astype(str).replace('NaT','')
sys.stdout.write(df.to_json(orient='records', lines=True, default_handler=str))
`;

function readParquet(path) {
  const pyPath = join(DOWNLOAD_DIR, "_r.py");
  writeFileSync(pyPath, PY_SCRIPT);
  try {
    const out = execFileSync("python3", [pyPath, path], { maxBuffer: 1024*1024*512, encoding: "utf8" });
    return out.split("\n").filter(l => l.trim()).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch (e) { log(`ERROR reading ${path}: ${e.message?.slice(0,80)}`); return []; }
}

function toMonth(d) {
  if (!d) return null;
  const dt = new Date(d);
  if (isNaN(dt)) return null;
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-01`;
}

// ── MAIN ──
async function main() {
  log(`Starting page ${PAGE}`);
  mkdirSync(DOWNLOAD_DIR, { recursive: true });

  // Fetch page file list
  const res = await fetch(`${API_URL}?page=${PAGE}`, { headers: { "X-API-KEY": API_KEY } });
  if (!res.ok) { log(`API error: ${res.status}`); process.exit(1); }
  const data = await res.json();
  const links = data.download_links || [];
  log(`${links.length} files on page ${PAGE}`);

  const buildingAgg = new Map();
  const neighborhoodAgg = new Map();
  let totalFiltered = 0, totalMatched = 0;

  for (let fi = 0; fi < links.length; fi++) {
    const link = links[fi];
    const url = link.link;
    const fname = link.file_name;
    const fpath = join(DOWNLOAD_DIR, fname);

    // Download
    try {
      const r = await fetch(url, { headers: { "X-API-KEY": API_KEY } });
      if (!r.ok) { log(`DL fail ${fname}: ${r.status}`); continue; }
      writeFileSync(fpath, Buffer.from(await r.arrayBuffer()));
    } catch (e) { log(`DL error ${fname}: ${e.message?.slice(0,60)}`); continue; }

    // Read + filter
    const rows = readParquet(fpath);

    // Delete immediately
    try { unlinkSync(fpath); } catch {}

    const filtered = [];
    for (const row of rows) {
      const state = (row.STATE || "").toUpperCase().trim();
      const city = (row.CITY || "").toUpperCase().trim();
      const metro = getMetro(state, city);
      if (metro) { row._metro = metro; row._city = city; filtered.push(row); }
    }

    if (!filtered.length) { log(`  [${fi+1}/${links.length}] ${fname}: 0 metro rows`); continue; }
    totalFiltered += filtered.length;

    // Collect unique zips and preload
    const zips = [...new Set(filtered.map(r => String(r.ZIP || "").trim().slice(0,5)).filter(Boolean))];
    await preloadZips(zips);

    // Match and aggregate
    let matched = 0;
    for (const row of filtered) {
      const rent = parseFloat(row.RENT_PRICE || 0);
      if (!rent || rent < 200 || rent > 50000) continue;
      const beds = Math.min(parseInt(row.BEDS) || 0, 5);
      const sqft = parseFloat(row.SQFT || 0) || null;
      const month = toMonth(row.DATE_POSTED || row.SCRAPED_TIMESTAMP);
      if (!month) continue;
      const zip = String(row.ZIP || "").trim().slice(0,5);
      const addr = norm(row.ADDRESS || "");
      const buildingId = addr ? match(addr, zip) : null;

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

    totalMatched += matched;
    log(`  [${fi+1}/${links.length}] ${fname}: ${filtered.length} metro, ${matched} matched`);
  }

  log(`Processing done: ${totalFiltered} filtered, ${totalMatched} matched, ${buildingAgg.size} bldg buckets, ${neighborhoodAgg.size} hood buckets`);

  // Upsert building rents
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
  log(`Upserting ${bRows.length} building rent rows...`);
  for (let i = 0; i < bRows.length; i += BATCH) {
    const { error } = await supabase.from("dewey_building_rents").upsert(bRows.slice(i, i + BATCH), { onConflict: "building_id,month,beds" });
    if (error) log(`  bldg upsert err batch ${i}: ${error.message?.slice(0,80)}`);
  }
  log(`Building rents done: ${bRows.length}`);

  // Upsert neighborhood rents
  const nRows = [];
  for (const [, v] of neighborhoodAgg) {
    nRows.push({
      city: v.city, zip: v.zip, month: v.month, beds: v.beds,
      median_rent: median(v.rents), p25_rent: pct(v.rents, 25), p75_rent: pct(v.rents, 75),
      avg_sqft: v.sqfts.length ? v.sqfts.reduce((s,x)=>s+x,0)/v.sqfts.length : null,
      listing_count: v.rents.length,
    });
  }
  log(`Upserting ${nRows.length} neighborhood rent rows...`);
  for (let i = 0; i < nRows.length; i += BATCH) {
    const { error } = await supabase.from("dewey_neighborhood_rents").upsert(nRows.slice(i, i + BATCH), { onConflict: "city,zip,month,beds" });
    if (error) log(`  hood upsert err batch ${i}: ${error.message?.slice(0,80)}`);
  }
  log(`Neighborhood rents done: ${nRows.length}`);

  // Cleanup
  try { unlinkSync(join(DOWNLOAD_DIR, "_r.py")); } catch {}
  try { const { rmdirSync } = await import("fs"); rmdirSync(DOWNLOAD_DIR); } catch {}

  log(`=== PAGE ${PAGE} COMPLETE === bldg:${bRows.length} hood:${nRows.length}`);
}

main().catch(e => { log(`FATAL: ${e.message}`); process.exit(1); });

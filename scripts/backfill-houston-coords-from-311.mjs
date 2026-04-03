#!/usr/bin/env node
/**
 * FAST Houston coords backfill — loads everything into memory, matches in-memory,
 * then blasts updates with high concurrency.
 *
 * Run: node scripts/backfill-houston-coords-from-311.mjs
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

const envPath = resolve(process.cwd(), ".env.local");
const env = {};
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, "");
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const HOUSTON_BOUNDS = { minLat: 29.4, maxLat: 30.3, minLng: -96.1, maxLng: -94.7 };
const CONCURRENCY = 30;
const CITY_NAMES_RE = /\s+(HOUSTON|HOUSTON TEXAS|HOUSTON TX)\b.*$/i;

function normalizeAddress(addr) {
  if (!addr) return null;
  return addr.toUpperCase()
    .replace(/[.,#]/g, "").replace(/\s+/g, " ")
    .replace(CITY_NAMES_RE, "")
    .replace(/\s+\+\s+\d{5}$/, "").replace(/\s+[A-Z]{2}\s+\d{5}(-\d{4})?$/, "")
    .replace(/\s+\d{5}(-\d{4})?$/, "")
    .replace(/\s+(APT|UNIT|#|FL|FLOOR|STE|SUITE|RM|ROOM)\s*\S*$/i, "")
    .replace(/\bSTREET\b/g, "ST").replace(/\bAVENUE\b/g, "AVE").replace(/\bBOULEVARD\b/g, "BLVD")
    .replace(/\bDRIVE\b/g, "DR").replace(/\bPLACE\b/g, "PL").replace(/\bCOURT\b/g, "CT")
    .replace(/\bLANE\b/g, "LN").replace(/\bROAD\b/g, "RD").replace(/\bTERRACE\b/g, "TER")
    .replace(/\bCIRCLE\b/g, "CIR").replace(/\bPARKWAY\b/g, "PKWY").replace(/\bHIGHWAY\b/g, "HWY")
    .replace(/\bAV\b/g, "AVE")
    .replace(/\bNORTH\b/g, "N").replace(/\bSOUTH\b/g, "S").replace(/\bEAST\b/g, "E").replace(/\bWEST\b/g, "W")
    .trim();
}

function stripDir(a) { return a?.replace(/^(\d+[-\d]*\s+)[NSEW]\s+/, "$1"); }
function stripSuffix(a) { return a?.replace(/\s+(ST|AVE|BLVD|DR|PL|CT|LN|RD|TER|CIR|PKWY|HWY|WAY|LOOP|TRAIL|TRL|PATH|CRES|SQ|XING)$/, ""); }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function loadAll(table, filter, fields, label) {
  const rows = [];
  let offset = 0, retries = 0;
  while (true) {
    let q = supabase.from(table).select(fields);
    for (const [k, v] of Object.entries(filter)) {
      if (v === null) q = q.is(k, null);
      else if (typeof v === "object" && v.not) q = q.not(k, "is", v.not);
      else q = q.eq(k, v);
    }
    const { data, error } = await q.range(offset, offset + 5000 - 1);
    if (error) { retries++; if (retries > 10) break; await sleep(2000 * retries); continue; }
    retries = 0;
    if (!data || data.length === 0) break;
    rows.push(...data);
    offset += data.length;
    if (rows.length % 50000 === 0) console.log(`  ${label}: ${rows.length.toLocaleString()}...`);
    if (data.length < 5000) break;
  }
  console.log(`  ${label}: ${rows.length.toLocaleString()} total`);
  return rows;
}

/** Run promises with concurrency limit */
async function parallelMap(items, fn, concurrency) {
  let idx = 0, done = 0;
  const total = items.length;
  async function worker() {
    while (idx < total) {
      const i = idx++;
      await fn(items[i], i);
      done++;
      if (done % 2000 === 0) console.log(`  Progress: ${done.toLocaleString()} / ${total.toLocaleString()}`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, total) }, () => worker()));
}

async function main() {
  console.log("Houston FAST Coords Backfill");
  console.log("=".repeat(50));

  // Phase 1: Load buildings missing coords
  console.log("\n[1/4] Loading buildings missing coords...");
  const buildings = await loadAll("buildings",
    { metro: "houston", latitude: null },
    "id, full_address, zip_code",
    "Buildings"
  );

  if (buildings.length === 0) { console.log("All buildings have coords!"); return; }

  // Build address -> building map (multiple keys per building for fuzzy matching)
  const addrMap = new Map();
  for (const b of buildings) {
    let street = b.full_address.split(",")[0]?.trim() || b.full_address;
    street = street.replace(CITY_NAMES_RE, "").replace(/\s+\d{5}(-\d{4})?$/, "").trim();
    const norm = normalizeAddress(street);
    if (!norm || norm.length < 5) continue;
    const entry = { id: b.id, hasZip: !!b.zip_code };
    addrMap.set(norm, entry);
    const nd = stripDir(norm); if (nd && nd !== norm) addrMap.set(nd, entry);
    const ns = stripSuffix(norm); if (ns && ns !== norm) addrMap.set(ns, entry);
    const nds = stripSuffix(nd || norm); if (nds && nds !== norm) addrMap.set(nds, entry);
  }
  console.log(`  Address keys: ${addrMap.size.toLocaleString()}`);

  // Phase 2: Load ALL complaints with coords (custom loader — can't use generic for NOT NULL)
  console.log("\n[2/4] Loading complaints with coords...");
  const complaints = [];
  {
    let offset = 0, retries = 0;
    while (true) {
      const { data, error } = await supabase.from("complaints_311")
        .select("incident_address, latitude, longitude, zip_code")
        .eq("metro", "houston")
        .not("latitude", "is", null)
        .not("longitude", "is", null)
        .range(offset, offset + 5000 - 1);
      if (error) { retries++; if (retries > 10) break; await sleep(2000 * retries); continue; }
      retries = 0;
      if (!data || data.length === 0) break;
      complaints.push(...data);
      offset += data.length;
      if (complaints.length % 50000 === 0) console.log(`  Complaints: ${complaints.length.toLocaleString()}...`);
      if (data.length < 5000) break;
    }
    console.log(`  Complaints: ${complaints.length.toLocaleString()} total`);
  }

  // Phase 3: Match in-memory (instant)
  console.log("\n[3/4] Matching addresses in memory...");
  const updates = new Map(); // building_id -> { lat, lng, zip }

  for (const c of complaints) {
    const lat = parseFloat(c.latitude);
    const lng = parseFloat(c.longitude);
    if (isNaN(lat) || isNaN(lng)) continue;
    if (lat < HOUSTON_BOUNDS.minLat || lat > HOUSTON_BOUNDS.maxLat ||
        lng < HOUSTON_BOUNDS.minLng || lng > HOUSTON_BOUNDS.maxLng) continue;

    let street = c.incident_address;
    if (!street) continue;
    street = street.split(",")[0]?.trim() || street;
    street = street.replace(CITY_NAMES_RE, "").replace(/\s+\+\s+\d{5}$/, "").replace(/\s+\d{5}(-\d{4})?$/, "").trim();
    const norm = normalizeAddress(street);
    if (!norm || norm.length < 5) continue;

    const building = addrMap.get(norm) || addrMap.get(stripDir(norm)) || addrMap.get(stripSuffix(norm)) || addrMap.get(stripSuffix(stripDir(norm)));
    if (!building || updates.has(building.id)) continue;

    const upd = { latitude: lat, longitude: lng };
    if (c.zip_code && !building.hasZip) upd.zip_code = c.zip_code;
    updates.set(building.id, upd);

    // Remove from map so we don't match again
    addrMap.delete(norm);
  }

  console.log(`  Matched: ${updates.size.toLocaleString()} buildings`);
  console.log(`  Unmatched: ${addrMap.size.toLocaleString()} buildings remaining`);

  // Phase 4: Blast updates with concurrency
  console.log(`\n[4/4] Writing ${updates.size.toLocaleString()} updates (concurrency=${CONCURRENCY})...`);
  let success = 0, fail = 0;
  const entries = [...updates.entries()];

  await parallelMap(entries, async ([id, data]) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const { error } = await supabase.from("buildings").update(data).eq("id", id);
      if (!error) { success++; return; }
      if (attempt < 2) await sleep(500 * (attempt + 1));
    }
    fail++;
  }, CONCURRENCY);

  console.log(`\n${"=".repeat(50)}`);
  console.log(`Done! Updated: ${success.toLocaleString()}, Failed: ${fail}`);
  console.log(`Buildings still missing coords: ~${(buildings.length - success).toLocaleString()}`);
}

main().catch(console.error);

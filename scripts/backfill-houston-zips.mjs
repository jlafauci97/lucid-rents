#!/usr/bin/env node
/**
 * Backfill zip codes for Houston buildings that have coords but no zip.
 * Two strategies:
 * 1. Match against 311 complaints by address (has zip)
 * 2. Forward geocode via Census to extract zip from matched address
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

const CONCURRENCY = 20;
const CITY_NAMES_RE = /\s+(HOUSTON|HOUSTON TEXAS|HOUSTON TX)\b.*$/i;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

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

async function geocodeZip(address) {
  const url = `https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress?address=${encodeURIComponent(address)}&benchmark=Public_AR_Current&vintage=Current_Current&format=json`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const data = await res.json();
    const match = data?.result?.addressMatches?.[0];
    if (!match) return null;
    const parts = match.matchedAddress?.split(",") || [];
    const zipMatch = parts[parts.length - 1]?.trim();
    return /^\d{5}$/.test(zipMatch) ? zipMatch : null;
  } catch { return null; }
}

async function main() {
  console.log("Houston Zip Code Backfill");
  console.log("=".repeat(50));

  // Load buildings with coords but no zip
  console.log("\n[1/4] Loading buildings missing zip...");
  const buildings = [];
  let offset = 0, retries = 0;
  while (true) {
    const { data, error } = await supabase.from("buildings")
      .select("id, full_address, latitude, longitude")
      .eq("metro", "houston")
      .not("latitude", "is", null)
      .is("zip_code", null)
      .order("id", { ascending: true })
      .range(offset, offset + 5000 - 1);
    if (error) { retries++; if (retries > 10) break; await sleep(2000 * retries); continue; }
    retries = 0;
    if (!data || data.length === 0) break;
    buildings.push(...data);
    offset += data.length;
    if (data.length < 5000) break;
  }
  console.log(`  Found: ${buildings.length}`);
  if (buildings.length === 0) { console.log("All done!"); return; }

  // Build address -> building map
  const addrMap = new Map();
  for (const b of buildings) {
    const norm = normalizeAddress(b.full_address.split(",")[0]?.trim() || b.full_address);
    if (norm) addrMap.set(norm, b);
  }

  // Load complaints with zip codes for address matching
  console.log("\n[2/4] Loading complaints with zips for address matching...");
  const zipFromComplaints = new Map(); // normalized addr -> zip
  offset = 0; retries = 0;
  while (true) {
    const { data, error } = await supabase.from("complaints_311")
      .select("incident_address, zip_code")
      .eq("metro", "houston")
      .not("zip_code", "is", null)
      .range(offset, offset + 5000 - 1);
    if (error) { retries++; if (retries > 10) break; await sleep(2000 * retries); continue; }
    retries = 0;
    if (!data || data.length === 0) break;
    for (const c of data) {
      if (!c.zip_code || !c.incident_address) continue;
      let street = c.incident_address.split(",")[0]?.trim() || c.incident_address;
      street = street.replace(CITY_NAMES_RE, "").replace(/\s+\+\s+\d{5}$/, "").replace(/\s+\d{5}(-\d{4})?$/, "").trim();
      const norm = normalizeAddress(street);
      if (norm && !zipFromComplaints.has(norm)) zipFromComplaints.set(norm, c.zip_code);
    }
    offset += data.length;
    if (data.length < 5000) break;
  }
  console.log(`  Loaded ${zipFromComplaints.size.toLocaleString()} unique address-zip mappings`);

  // Match in-memory
  console.log("\n[3/4] Matching addresses to zips...");
  const matched = [];
  const unmatched = [];

  for (const b of buildings) {
    const norm = normalizeAddress(b.full_address.split(",")[0]?.trim() || b.full_address);
    const zip = norm ? zipFromComplaints.get(norm) : null;
    if (zip) {
      matched.push({ id: b.id, zip });
    } else {
      unmatched.push(b);
    }
  }
  console.log(`  Matched from complaints: ${matched.length}`);
  console.log(`  Need forward geocoding: ${unmatched.length}`);

  // Update matched ones
  if (matched.length > 0) {
    let success = 0, idx = 0;
    async function updateWorker() {
      while (idx < matched.length) {
        const { id, zip } = matched[idx++];
        const { error } = await supabase.from("buildings").update({ zip_code: zip }).eq("id", id);
        if (!error) success++;
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, matched.length) }, () => updateWorker()));
    console.log(`  Updated: ${success}`);
  }

  // Forward geocode remaining
  console.log(`\n[4/4] Forward geocoding ${unmatched.length} addresses for zip...`);
  let geocoded = 0, failed = 0, gIdx = 0;

  async function geocodeWorker() {
    while (gIdx < unmatched.length) {
      const b = unmatched[gIdx++];
      const addr = `${b.full_address}, Houston, TX`;
      const zip = await geocodeZip(addr);
      if (zip) {
        const { error } = await supabase.from("buildings").update({ zip_code: zip }).eq("id", b.id);
        if (!error) geocoded++;
        else failed++;
      } else {
        failed++;
      }
      const total = geocoded + failed;
      if (total % 200 === 0) console.log(`  ${total} / ${unmatched.length} (${geocoded} updated)`);
      await sleep(100);
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, unmatched.length) }, () => geocodeWorker()));

  console.log(`\n${"=".repeat(50)}`);
  console.log(`Done! Zips from complaints: ${matched.length}, Forward geocoded: ${geocoded}, Failed: ${failed}`);
}

main().catch(console.error);

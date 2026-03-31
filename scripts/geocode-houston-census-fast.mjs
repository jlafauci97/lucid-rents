#!/usr/bin/env node
/**
 * Fast Census batch geocoder for Houston — loads all buildings into memory first,
 * filters in-memory, then sends to Census batch API with concurrent DB updates.
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
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

const CENSUS_URL = "https://geocoding.geo.census.gov/geocoder/geographies/addressbatch";
const BATCH_SIZE = 3000;
const CONCURRENCY = 30;
const HOUSTON_BOUNDS = { minLat: 29.4, maxLat: 30.3, minLng: -96.1, maxLng: -94.7 };

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function cleanAddress(addr) {
  return addr.replace(/\s+/g, " ")
    .replace(/\bApt\.?\s*\S+/gi, "").replace(/\bUnit\.?\s*\S+/gi, "")
    .replace(/\bSte\.?\s*\S+/gi, "").replace(/\b#\S+/g, "").trim();
}

function buildCsv(buildings) {
  return buildings.map(b => {
    const street = cleanAddress(b.full_address);
    const escaped = street.includes(",") ? `"${street}"` : street;
    return `${b.id},${escaped},Houston,TX,${b.zip_code || ""}`;
  }).join("\n");
}

function parseCensusResponse(text) {
  const results = new Map();
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const fields = [];
    let cur = "", inQ = false;
    for (const ch of line) {
      if (ch === '"') inQ = !inQ;
      else if (ch === "," && !inQ) { fields.push(cur.trim().replace(/^"|"$/g, "")); cur = ""; }
      else cur += ch;
    }
    fields.push(cur.trim().replace(/^"|"$/g, ""));

    if (fields[2] !== "Match") continue;
    const [lngS, latS] = (fields[5] || "").split(",");
    const lng = parseFloat(lngS), lat = parseFloat(latS);
    if (isNaN(lat) || isNaN(lng)) continue;
    if (lat < HOUSTON_BOUNDS.minLat || lat > HOUSTON_BOUNDS.maxLat ||
        lng < HOUSTON_BOUNDS.minLng || lng > HOUSTON_BOUNDS.maxLng) continue;
    const zipM = (fields[4] || "").match(/(\d{5})(?:\s*$|,)/);
    results.set(fields[0], { lat, lng, zip: zipM?.[1] || null });
  }
  return results;
}

async function submitBatch(csv, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const boundary = "----Batch" + Date.now();
      const body = `--${boundary}\r\nContent-Disposition: form-data; name="addressFile"; filename="a.csv"\r\nContent-Type: text/csv\r\n\r\n${csv}\r\n--${boundary}\r\nContent-Disposition: form-data; name="benchmark"\r\n\r\nPublic_AR_Current\r\n--${boundary}\r\nContent-Disposition: form-data; name="vintage"\r\n\r\nCurrent_Current\r\n--${boundary}--`;
      const res = await fetch(CENSUS_URL, {
        method: "POST",
        headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
        body,
        signal: AbortSignal.timeout(120000),
      });
      if (!res.ok) { if (attempt < retries) { await sleep(5000 * attempt); continue; } return new Map(); }
      return parseCensusResponse(await res.text());
    } catch (e) {
      console.error(`  Census error (attempt ${attempt}):`, e.message);
      if (attempt < retries) await sleep(5000 * attempt);
    }
  }
  return new Map();
}

async function parallelUpdate(entries, buildingMap) {
  let success = 0, idx = 0;
  async function worker() {
    while (idx < entries.length) {
      const [id, { lat, lng, zip }] = entries[idx++];
      const b = buildingMap.get(id);
      const data = { latitude: lat, longitude: lng };
      if (zip && !b?.zip_code) data.zip_code = zip;
      for (let a = 0; a < 3; a++) {
        const { error } = await supabase.from("buildings").update(data).eq("id", id);
        if (!error) { success++; break; }
        if (a < 2) await sleep(300);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, entries.length) }, () => worker()));
  return success;
}

async function main() {
  console.log("Houston Census Batch Geocoder (FAST)");
  console.log("=".repeat(50));

  // Load ALL Houston buildings into memory, then filter
  console.log("\nLoading all Houston buildings...");
  const allBuildings = [];
  let offset = 0, retries = 0;
  while (true) {
    const { data, error } = await supabase.from("buildings")
      .select("id, full_address, zip_code, latitude")
      .eq("metro", "houston")
      .order("id", { ascending: true })
      .range(offset, offset + 5000 - 1);
    if (error) { retries++; if (retries > 15) break; await sleep(2000 * retries); continue; }
    retries = 0;
    if (!data || data.length === 0) break;
    allBuildings.push(...data);
    offset += data.length;
    if (allBuildings.length % 50000 === 0) console.log(`  Loaded ${allBuildings.length.toLocaleString()}...`);
    if (data.length < 5000) break;
  }
  console.log(`  Total loaded: ${allBuildings.length.toLocaleString()}`);

  // Filter to only those missing coords
  const needsGeocode = allBuildings.filter(b => b.latitude === null);
  console.log(`  Missing coords: ${needsGeocode.length.toLocaleString()}`);

  if (needsGeocode.length === 0) { console.log("All done!"); return; }

  // Build lookup map
  const buildingMap = new Map(needsGeocode.map(b => [b.id, b]));

  // Process in batches through Census API
  let totalGeocoded = 0, totalFailed = 0;

  for (let i = 0; i < needsGeocode.length; i += BATCH_SIZE) {
    const batch = needsGeocode.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(needsGeocode.length / BATCH_SIZE);

    console.log(`\nBatch ${batchNum}/${totalBatches} (${batch.length} addresses)...`);

    const csv = buildCsv(batch);
    const results = await submitBatch(csv);
    const matched = results.size;

    console.log(`  Census matched: ${matched}/${batch.length} (${((matched / batch.length) * 100).toFixed(1)}%)`);

    if (matched > 0) {
      const updated = await parallelUpdate([...results.entries()], buildingMap);
      totalGeocoded += updated;
      console.log(`  Updated: ${updated}`);
    }

    totalFailed += batch.length - matched;
    console.log(`  Running total: ${totalGeocoded} geocoded, ${totalFailed} failed`);

    await sleep(1500); // Be nice to Census API
  }

  const hitRate = totalGeocoded / (totalGeocoded + totalFailed || 1) * 100;
  console.log(`\n${"=".repeat(50)}`);
  console.log(`Done! Geocoded: ${totalGeocoded}, Failed: ${totalFailed}, Hit rate: ${hitRate.toFixed(1)}%`);
  console.log(`Remaining without coords: ~${needsGeocode.length - totalGeocoded}`);
}

main().catch(console.error);

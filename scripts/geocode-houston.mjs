#!/usr/bin/env node
/**
 * Batch geocode Houston buildings using multiple free geocoding services.
 * Tries multiple address formats and services for maximum hit rate.
 *
 * Run: node scripts/geocode-houston.mjs
 * Resume: auto-resumes from last progress file.
 * Reset: delete scripts/.geocode-houston-progress.json
 */
import { createRequire } from "module";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";

// Parse .env.local
const envPath = resolve(process.cwd(), ".env.local");
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const idx = trimmed.indexOf("=");
  if (idx === -1) continue;
  const key = trimmed.slice(0, idx).trim();
  const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
  if (!process.env[key]) process.env[key] = val;
}

const require = createRequire(import.meta.url);
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PROGRESS_FILE = resolve(process.cwd(), "scripts/.geocode-houston-progress.json");
const BATCH_SIZE = 200;
const CONCURRENCY = 5; // parallel geocode requests

// Houston metro bounding box (generous — covers suburbs)
const HOUSTON_BOUNDS = { minLat: 29.4, maxLat: 30.3, minLng: -96.1, maxLng: -94.7 };

function loadProgress() {
  if (existsSync(PROGRESS_FILE)) {
    return JSON.parse(readFileSync(PROGRESS_FILE, "utf8"));
  }
  return { totalGeocoded: 0, totalFailed: 0, lastId: null, pass: 1 };
}

function saveProgress(progress) {
  writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

function isInHouston(lat, lng) {
  return (
    lat >= HOUSTON_BOUNDS.minLat && lat <= HOUSTON_BOUNDS.maxLat &&
    lng >= HOUSTON_BOUNDS.minLng && lng <= HOUSTON_BOUNDS.maxLng
  );
}

/** Clean up address for better geocoding */
function normalizeAddress(addr) {
  return addr
    .replace(/\s+/g, " ")
    .replace(/\bApt\.?\s*\S+/gi, "")
    .replace(/\bUnit\.?\s*\S+/gi, "")
    .replace(/\bSte\.?\s*\S+/gi, "")
    .replace(/\b#\S+/g, "")
    .replace(/\s+,/, ",")
    .trim();
}

// ─── Census Geocoder (locations endpoint — faster than geographies) ───
async function geocodeCensus(address) {
  const url = `https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress?address=${encodeURIComponent(address)}&benchmark=Public_AR_Current&vintage=Current_Current&format=json`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const data = await res.json();
    const match = data?.result?.addressMatches?.[0];
    if (!match) return null;
    const { x: lng, y: lat } = match.coordinates;
    if (!isInHouston(lat, lng)) return null;
    // Extract zip from matched address: "123 MAIN ST, HOUSTON, TX, 77001"
    const addrParts = match.matchedAddress?.split(",") || [];
    const zipMatch = addrParts[addrParts.length - 1]?.trim();
    const zip = /^\d{5}$/.test(zipMatch) ? zipMatch : null;
    return { lat, lng, zip };
  } catch {
    return null;
  }
}

// ─── Nominatim (OpenStreetMap) — good fallback ───
let lastNominatimCall = 0;
async function geocodeNominatim(address) {
  // Enforce 1 req/sec rate limit
  const now = Date.now();
  const wait = Math.max(0, 1100 - (now - lastNominatimCall));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastNominatimCall = Date.now();

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=us&addressdetails=1`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { "User-Agent": "LucidRents/1.0 (houston-geocode)" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.[0]) return null;
    const lat = parseFloat(data[0].lat);
    const lng = parseFloat(data[0].lon);
    if (!isInHouston(lat, lng)) return null;
    const zip = data[0].address?.postcode?.split("-")[0] || null;
    return { lat, lng, zip };
  } catch {
    return null;
  }
}

/**
 * Try geocoding with multiple address variants for maximum hit rate.
 * Returns { lat, lng, zip } or null.
 */
async function geocodeBuilding(building) {
  const raw = building.full_address;
  const clean = normalizeAddress(raw);
  const zip = building.zip_code || "";

  // Build address variants — more specific first
  const variants = [];
  if (zip) {
    variants.push(`${clean}, Houston, TX ${zip}`);
  }
  variants.push(`${clean}, Houston, TX`);
  variants.push(`${clean}, Houston, Texas`);
  // Try without direction prefix (e.g. "N Main St" → "Main St")
  const noDir = clean.replace(/^\b(N|S|E|W|NE|NW|SE|SW)\b\.?\s+/i, "");
  if (noDir !== clean) {
    variants.push(`${noDir}, Houston, TX`);
  }

  // Try Census with each variant
  for (const addr of variants) {
    const result = await geocodeCensus(addr);
    if (result) return { ...result, source: "census" };
    await new Promise((r) => setTimeout(r, 150));
  }

  // Fallback: try Nominatim with best variants
  for (const addr of variants.slice(0, 2)) {
    const result = await geocodeNominatim(addr);
    if (result) return { ...result, source: "nominatim" };
  }

  return null;
}

/** Process a batch of buildings with limited concurrency */
async function processBatch(buildings, progress, totalCount) {
  let idx = 0;
  let batchGeocoded = 0;
  let batchFailed = 0;

  async function worker() {
    while (idx < buildings.length) {
      const i = idx++;
      const building = buildings[i];

      const result = await geocodeBuilding(building);

      if (result) {
        const updateData = { latitude: result.lat, longitude: result.lng };
        if (result.zip && !building.zip_code) {
          updateData.zip_code = result.zip;
        }
        const { error: updateErr } = await supabase
          .from("buildings")
          .update(updateData)
          .eq("id", building.id);

        if (updateErr) {
          console.error(`  DB error ${building.id}:`, updateErr.message);
          batchFailed++;
        } else {
          batchGeocoded++;
        }
      } else {
        batchFailed++;
      }

      progress.lastId = building.id;
      progress.totalGeocoded += (result ? 1 : 0);
      progress.totalFailed += (result ? 0 : 1);

      const total = progress.totalGeocoded + progress.totalFailed;
      if (total % 25 === 0) {
        const pct = ((progress.totalGeocoded / (total)) * 100).toFixed(1);
        console.log(`  ${progress.totalGeocoded} geocoded, ${progress.totalFailed} failed (${total} processed, ${pct}% hit rate)`);
        saveProgress(progress);
      }
    }
  }

  // Run workers in parallel
  const workers = Array.from({ length: Math.min(CONCURRENCY, buildings.length) }, () => worker());
  await Promise.all(workers);

  return { batchGeocoded, batchFailed };
}

async function main() {
  const progress = loadProgress();
  console.log("Houston Geocoding Backfill");
  console.log("=".repeat(50));
  console.log(`Previously: ${progress.totalGeocoded} geocoded, ${progress.totalFailed} failed`);

  // Count total missing
  const { count } = await supabase
    .from("buildings")
    .select("*", { count: "exact", head: true })
    .eq("metro", "houston")
    .is("latitude", null);

  console.log(`Buildings still missing coordinates: ${count}`);
  if (count === 0) {
    console.log("All buildings geocoded!");
    return;
  }

  // Reset failed count for this run (we re-attempt everything missing)
  progress.totalFailed = 0;
  let hasMore = true;

  while (hasMore) {
    const { data: buildings, error } = await supabase
      .from("buildings")
      .select("id, full_address, zip_code, borough")
      .eq("metro", "houston")
      .is("latitude", null)
      .order("id", { ascending: true })
      .limit(BATCH_SIZE);

    if (error) {
      console.error("Fetch error:", error.message);
      break;
    }

    if (!buildings || buildings.length === 0) {
      hasMore = false;
      break;
    }

    console.log(`\nProcessing batch of ${buildings.length}...`);
    await processBatch(buildings, progress, count);
    saveProgress(progress);

    const remaining = count - progress.totalGeocoded;
    console.log(`Batch done. Total geocoded: ${progress.totalGeocoded}, Remaining: ~${remaining}`);
  }

  saveProgress(progress);

  // Final stats
  const { count: remaining } = await supabase
    .from("buildings")
    .select("*", { count: "exact", head: true })
    .eq("metro", "houston")
    .is("latitude", null);

  const hitRate = ((progress.totalGeocoded / (progress.totalGeocoded + progress.totalFailed)) * 100).toFixed(1);
  console.log("\n" + "=".repeat(50));
  console.log(`Done! Geocoded: ${progress.totalGeocoded}, Failed: ${progress.totalFailed}`);
  console.log(`Hit rate: ${hitRate}%`);
  console.log(`Buildings still missing coords: ${remaining}`);
}

main().catch(console.error);

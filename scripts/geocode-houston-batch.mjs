#!/usr/bin/env node
/**
 * Batch geocode Houston buildings using the Census Bureau Batch Geocoder.
 * Processes up to 10,000 addresses per batch upload (CSV → multipart POST).
 * Much faster than one-at-a-time geocoding.
 *
 * Run: node scripts/geocode-houston-batch.mjs
 * Resume: auto-resumes from progress file.
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

const PROGRESS_FILE = resolve(process.cwd(), "scripts/.geocode-houston-batch-progress.json");
const BATCH_SIZE = 5000; // Census batch API accepts up to 10K but 5K is more reliable
const DB_FETCH_SIZE = 2000;
const CENSUS_BATCH_URL = "https://geocoding.geo.census.gov/geocoder/geographies/addressbatch";

// Houston metro bounding box
const HOUSTON_BOUNDS = { minLat: 29.4, maxLat: 30.3, minLng: -96.1, maxLng: -94.7 };

function loadProgress() {
  if (existsSync(PROGRESS_FILE)) {
    return JSON.parse(readFileSync(PROGRESS_FILE, "utf8"));
  }
  return { totalGeocoded: 0, totalFailed: 0, totalProcessed: 0 };
}

function saveProgress(progress) {
  writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

function isInHouston(lat, lng) {
  return lat >= HOUSTON_BOUNDS.minLat && lat <= HOUSTON_BOUNDS.maxLat &&
    lng >= HOUSTON_BOUNDS.minLng && lng <= HOUSTON_BOUNDS.maxLng;
}

/**
 * Build a CSV for the Census Batch Geocoder.
 * Format: Unique ID, Street address, City, State, ZIP
 */
function buildCsv(buildings) {
  const lines = [];
  for (const b of buildings) {
    // Clean the address - remove apt/unit numbers that confuse the geocoder
    const street = b.full_address
      .replace(/\s+/g, " ")
      .replace(/\bApt\.?\s*\S+/gi, "")
      .replace(/\bUnit\.?\s*\S+/gi, "")
      .replace(/\bSte\.?\s*\S+/gi, "")
      .replace(/\b#\S+/g, "")
      .trim();

    // CSV format: id, street, city, state, zip
    const zip = b.zip_code || "";
    // Escape commas in addresses
    const escapedStreet = street.includes(",") ? `"${street}"` : street;
    lines.push(`${b.id},${escapedStreet},Houston,TX,${zip}`);
  }
  return lines.join("\n");
}

/**
 * Parse the Census Batch Geocoder response.
 * Response format (CSV): "id","input_address","match_status","match_type","matched_address","lng_lat","tiger_id","side","state_fips","county_fips","tract","block"
 * The lng_lat field is: longitude,latitude (note: reversed!)
 */
function parseResponse(responseText) {
  const results = new Map();
  const lines = responseText.split("\n");

  for (const line of lines) {
    if (!line.trim()) continue;

    // Parse CSV carefully — fields may be quoted
    const fields = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        fields.push(current.trim().replace(/^"|"$/g, ""));
        current = "";
      } else {
        current += ch;
      }
    }
    fields.push(current.trim().replace(/^"|"$/g, ""));

    const id = fields[0];
    const matchStatus = fields[2];
    const matchedAddress = fields[4] || "";
    const lngLat = fields[5] || "";

    if (matchStatus !== "Match") continue;

    const [lngStr, latStr] = lngLat.split(",");
    const lng = parseFloat(lngStr);
    const lat = parseFloat(latStr);

    if (isNaN(lat) || isNaN(lng)) continue;
    if (!isInHouston(lat, lng)) continue;

    // Extract zip from matched address (last 5 digits before end)
    const zipMatch = matchedAddress.match(/(\d{5})(?:\s*$|,)/);
    const zip = zipMatch ? zipMatch[1] : null;

    results.set(id, { lat, lng, zip });
  }

  return results;
}

/**
 * Submit a batch to the Census Geocoder.
 */
async function submitBatch(csvContent, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Build multipart form data manually
      const boundary = "----CensusBatchBoundary" + Date.now();
      const body = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="addressFile"; filename="addresses.csv"',
        "Content-Type: text/csv",
        "",
        csvContent,
        `--${boundary}`,
        'Content-Disposition: form-data; name="benchmark"',
        "",
        "Public_AR_Current",
        `--${boundary}`,
        'Content-Disposition: form-data; name="vintage"',
        "",
        "Current_Current",
        `--${boundary}--`,
      ].join("\r\n");

      const res = await fetch(CENSUS_BATCH_URL, {
        method: "POST",
        headers: {
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
        },
        body,
        signal: AbortSignal.timeout(120000), // 2 min timeout for batch
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error(`  Census API ${res.status}: ${text.slice(0, 200)}`);
        if (attempt < retries) {
          console.log(`  Retrying (${attempt}/${retries})...`);
          await new Promise((r) => setTimeout(r, 5000 * attempt));
          continue;
        }
        return new Map();
      }

      const responseText = await res.text();
      return parseResponse(responseText);
    } catch (err) {
      console.error(`  Batch request error (attempt ${attempt}):`, err.message);
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 5000 * attempt));
        continue;
      }
      return new Map();
    }
  }
  return new Map();
}

/**
 * Update buildings in Supabase with geocoded results.
 */
async function updateBuildings(results, buildingMap) {
  let updated = 0;
  const CHUNK = 50;
  const entries = [...results.entries()];

  for (let i = 0; i < entries.length; i += CHUNK) {
    const chunk = entries.slice(i, i + CHUNK);
    const updates = chunk.map(([id, { lat, lng, zip }]) => {
      const building = buildingMap.get(id);
      const updateData = { latitude: lat, longitude: lng };
      if (zip && !building?.zip_code) {
        updateData.zip_code = zip;
      }
      return supabase
        .from("buildings")
        .update(updateData)
        .eq("id", id)
        .then(({ error }) => {
          if (error) {
            console.error(`  Update error ${id}:`, error.message);
            return 0;
          }
          return 1;
        });
    });

    const results = await Promise.all(updates);
    updated += results.reduce((a, b) => a + b, 0);
  }

  return updated;
}

async function main() {
  const progress = loadProgress();
  console.log("Houston Batch Geocoding");
  console.log("=".repeat(50));
  console.log(`Previously: ${progress.totalGeocoded} geocoded, ${progress.totalFailed} failed`);

  console.log(`Fetching buildings...`);

  let hasMore = true;
  let batchNum = 0;
  let lastId = "";

  while (hasMore) {
    batchNum++;

    // Fetch buildings from DB using cursor pagination to avoid timeouts
    let query = supabase
      .from("buildings")
      .select("id, full_address, zip_code")
      .eq("metro", "houston")
      .is("latitude", null)
      .order("id", { ascending: true })
      .limit(DB_FETCH_SIZE);
    if (lastId) query = query.gt("id", lastId);

    const { data: buildings, error } = await query;

    if (error) {
      console.error("DB fetch error:", error.message);
      // Retry once after a pause
      await new Promise(r => setTimeout(r, 3000));
      const retry = await query;
      if (retry.error) { console.error("Retry failed:", retry.error.message); break; }
      if (!retry.data?.length) { hasMore = false; break; }
    }

    if (!buildings || buildings.length === 0) {
      hasMore = false;
      break;
    }

    // Build lookup map
    const buildingMap = new Map(buildings.map((b) => [b.id, b]));

    // Process in sub-batches for the Census API
    for (let i = 0; i < buildings.length; i += BATCH_SIZE) {
      const subBatch = buildings.slice(i, i + BATCH_SIZE);
      const subBatchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalSubBatches = Math.ceil(buildings.length / BATCH_SIZE);

      console.log(`\nBatch ${batchNum}, sub-batch ${subBatchNum}/${totalSubBatches} (${subBatch.length} addresses)...`);

      const csv = buildCsv(subBatch);
      const results = await submitBatch(csv);

      const matched = results.size;
      const unmatched = subBatch.length - matched;

      console.log(`  Census matched: ${matched}/${subBatch.length} (${((matched / subBatch.length) * 100).toFixed(1)}%)`);

      if (matched > 0) {
        const updated = await updateBuildings(results, buildingMap);
        progress.totalGeocoded += updated;
        console.log(`  Updated in DB: ${updated}`);
      }

      progress.totalFailed += unmatched;
      progress.totalProcessed += subBatch.length;
      saveProgress(progress);

      // Small delay between sub-batches
      await new Promise((r) => setTimeout(r, 2000));
    }

    const hitRate = progress.totalGeocoded / (progress.totalProcessed || 1) * 100;
    console.log(`\nRunning totals: ${progress.totalGeocoded} geocoded, ${progress.totalFailed} failed (${hitRate.toFixed(1)}% hit rate)`);

    // Update cursor for next batch
    if (buildings && buildings.length > 0) {
      lastId = buildings[buildings.length - 1].id;
    }
    console.log(`Running totals: ${progress.totalGeocoded} geocoded, ${progress.totalFailed} failed`);
  }

  saveProgress(progress);

  const hitRate = progress.totalGeocoded / (progress.totalProcessed || 1) * 100;
  console.log("\n" + "=".repeat(50));
  console.log(`Done! Geocoded: ${progress.totalGeocoded}, Failed: ${progress.totalFailed}`);
  console.log(`Hit rate: ${hitRate.toFixed(1)}%`);
}

main().catch(console.error);

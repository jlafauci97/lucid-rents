#!/usr/bin/env node
/**
 * Backfill Chicago buildings from Building Violations dataset.
 *
 * Fetches unique building addresses from the Chicago Building Violations dataset
 * on data.cityofchicago.org, deduplicates by address, and upserts into the
 * buildings table with metro='chicago'.
 *
 * Data source: Building Violations (22u3-xenr)
 * https://data.cityofchicago.org/resource/22u3-xenr.json
 *
 * Usage:
 *   node scripts/backfill-chicago-buildings.mjs
 *   node scripts/backfill-chicago-buildings.mjs --limit=50000
 *   node scripts/backfill-chicago-buildings.mjs --offset=10000
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

// Load .env.local manually
const envPath = resolve(process.cwd(), ".env.local");
const env = {};
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, "").replace(/\\n/g, "");
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const CHICAGO_TOKEN = (env.CHICAGO_OPEN_DATA_APP_TOKEN || "").trim();
const ENDPOINT = "https://data.cityofchicago.org/resource/22u3-xenr.json";
const PAGE_SIZE = 5000;
const BATCH_SIZE = 500;

const args = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => {
    const [k, v] = a.slice(2).split("=");
    return [k, v || "true"];
  })
);
const LIMIT = parseInt(args.limit || "999999999", 10);
const OFFSET = parseInt(args.offset || "0", 10);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function generateSlug(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// Chicago community area number -> name mapping
const COMMUNITY_AREAS = {
  "1": "Rogers Park", "2": "West Ridge", "3": "Uptown", "4": "Lincoln Square",
  "5": "North Center", "6": "Lake View", "7": "Lincoln Park", "8": "Near North Side",
  "9": "Edison Park", "10": "Norwood Park", "11": "Jefferson Park", "12": "Forest Glen",
  "13": "North Park", "14": "Albany Park", "15": "Portage Park", "16": "Irving Park",
  "17": "Dunning", "18": "Montclare", "19": "Belmont Cragin", "20": "Hermosa",
  "21": "Avondale", "22": "Logan Square", "23": "Humboldt Park", "24": "West Town",
  "25": "Austin", "26": "West Garfield Park", "27": "East Garfield Park",
  "28": "Near West Side", "29": "North Lawndale", "30": "South Lawndale",
  "31": "Lower West Side", "32": "Loop", "33": "Near South Side",
  "34": "Armour Square", "35": "Douglas", "36": "Oakland", "37": "Fuller Park",
  "38": "Grand Boulevard", "39": "Kenwood", "40": "Washington Park",
  "41": "Hyde Park", "42": "Woodlawn", "43": "South Shore",
  "44": "Chatham", "45": "Avalon Park", "46": "South Chicago",
  "47": "Burnside", "48": "Calumet Heights", "49": "Roseland",
  "50": "Pullman", "51": "South Deering", "52": "East Side",
  "53": "West Pullman", "54": "Riverdale", "55": "Hegewisch",
  "56": "Garfield Ridge", "57": "Archer Heights", "58": "Brighton Park",
  "59": "McKinley Park", "60": "Bridgeport", "61": "New City",
  "62": "West Elsdon", "63": "Gage Park", "64": "Clearing",
  "65": "West Lawn", "66": "Chicago Lawn", "67": "West Englewood",
  "68": "Englewood", "69": "Greater Grand Crossing", "70": "Ashburn",
  "71": "Auburn Gresham", "72": "Beverly", "73": "Washington Heights",
  "74": "Mount Greenwood", "75": "Morgan Park", "76": "O'Hare",
  "77": "Edgewater",
};

function parseAddress(addressStr) {
  if (!addressStr) return null;
  const addr = addressStr.trim().toUpperCase();
  const match = addr.match(/^(\d+[-\d]*)\s+(.+)$/);
  if (!match) return { house_number: "", street_name: addr };
  return { house_number: match[1], street_name: match[2] };
}

async function fetchRecords(offset, limit) {
  const params = new URLSearchParams({
    $limit: String(limit),
    $offset: String(offset),
    $order: ":id",
    $select: "id,address,street_number,street_direction,street_name,street_type,property_group,latitude,longitude,violation_date",
  });
  if (CHICAGO_TOKEN) params.set("$$app_token", CHICAGO_TOKEN);

  const url = `${ENDPOINT}?${params}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Chicago API ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function main() {
  console.log(`\n=== Chicago Building Backfill (from Building Violations) ===`);
  console.log(`Limit: ${LIMIT}, Offset: ${OFFSET}\n`);

  // Fetch all records and deduplicate by address
  const addressMap = new Map();
  let offset = OFFSET;
  let totalFetched = 0;

  while (totalFetched < LIMIT) {
    const fetchSize = Math.min(PAGE_SIZE, LIMIT - totalFetched);
    console.log(`Fetching records ${offset}–${offset + fetchSize}...`);

    const records = await fetchRecords(offset, fetchSize);
    if (!records || records.length === 0) {
      console.log("No more records.");
      break;
    }

    for (const r of records) {
      if (!r.address) continue;
      const addrStr = r.address.trim().toUpperCase();
      if (!addrStr || addrStr.length < 5) continue;

      const key = addrStr;
      if (!addressMap.has(key)) {
        const parsed = parseAddress(addrStr);
        if (!parsed) continue;

        const communityNum = String(r.property_group || "").trim();
        const neighborhood = COMMUNITY_AREAS[communityNum] || "";

        const fullAddress = `${addrStr}, Chicago, IL`;
        addressMap.set(key, {
          full_address: fullAddress,
          house_number: parsed.house_number,
          street_name: parsed.street_name,
          borough: neighborhood,
          city: "Chicago",
          state: "IL",
          metro: "chicago",
          slug: generateSlug(addrStr),
          latitude: r.latitude ? parseFloat(r.latitude) : null,
          longitude: r.longitude ? parseFloat(r.longitude) : null,
          violation_count: 0,
          complaint_count: 0,
          review_count: 0,
          overall_score: null,
        });
      }
    }

    totalFetched += records.length;
    offset += records.length;
    console.log(`  Fetched ${records.length}, unique buildings so far: ${addressMap.size}`);

    if (records.length < fetchSize) break;
    await sleep(300);
  }

  console.log(`\nDeduped to ${addressMap.size} unique buildings. Upserting...`);

  // Upsert in batches
  const buildings = Array.from(addressMap.values());
  let inserted = 0;

  for (let i = 0; i < buildings.length; i += BATCH_SIZE) {
    const batch = buildings.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("buildings").insert(batch);

    if (error) {
      if (error.code === "23505") {
        // Duplicate key — insert one by one to get non-duplicates through
        for (const row of batch) {
          const { error: singleErr } = await supabase.from("buildings").insert(row);
          if (!singleErr) inserted++;
        }
      } else {
        console.error(`  Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, error.message);
      }
    } else {
      inserted += batch.length;
    }

    if (inserted % 1000 < BATCH_SIZE) {
      console.log(`  Progress: ${inserted}/${buildings.length}`);
    }
  }

  console.log(`\nDone! Total buildings upserted: ${inserted}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

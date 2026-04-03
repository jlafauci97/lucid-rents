#!/usr/bin/env node
/**
 * Sync LA Metro Bus stops to Supabase from local GTFS files.
 *
 * Usage:
 *   1. Download the GTFS zip:
 *      curl -L https://gitlab.com/LACMTA/gtfs_bus/-/raw/master/gtfs_bus.zip -o /tmp/gtfs_bus.zip
 *   2. Extract:
 *      unzip -o /tmp/gtfs_bus.zip stops.txt routes.txt trips.txt stop_times.txt -d /tmp/gtfs_bus/
 *   3. Run:
 *      node scripts/sync-la-bus-stops.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

const GTFS_DIR = "/tmp/gtfs_bus";
const BATCH_SIZE = 500;

// Load .env.local if running locally
import { readFileSync as readEnv } from "fs";
try {
  const envFile = readEnv(".env.local", "utf-8");
  for (const line of envFile.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    // Strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    // Strip trailing \n escape sequences and whitespace
    process.env[key] = val.replace(/\\n/g, "").trim();
  }
} catch { /* ignore if no .env.local */ }

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function parseCsv(filePath) {
  const text = readFileSync(resolve(GTFS_DIR, filePath), "utf-8");
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = cols[j]?.trim()?.replace(/"/g, "") || "";
    }
    rows.push(row);
  }
  return rows;
}

async function main() {
  console.log("Parsing GTFS files...");

  // 1. Parse routes.txt → route_id → route_short_name
  const routes = parseCsv("routes.txt");
  const routeIdToName = new Map();
  for (const r of routes) {
    if (r.route_id && r.route_short_name) {
      routeIdToName.set(r.route_id, r.route_short_name);
    }
  }
  console.log(`  routes.txt: ${routes.length} routes`);

  // 2. Parse trips.txt → trip_id → route_id
  const trips = parseCsv("trips.txt");
  const tripToRoute = new Map();
  for (const t of trips) {
    if (t.trip_id && t.route_id) {
      tripToRoute.set(t.trip_id, t.route_id);
    }
  }
  console.log(`  trips.txt: ${trips.length} trips`);

  // 3. Parse stops.txt → stop map
  const stopsData = parseCsv("stops.txt");
  const stops = new Map();
  for (const s of stopsData) {
    const lat = parseFloat(s.stop_lat);
    const lng = parseFloat(s.stop_lon);
    if (!s.stop_id || !s.stop_name || isNaN(lat) || isNaN(lng)) continue;
    stops.set(s.stop_id, {
      type: "bus",
      stop_id: `la-bus-${s.stop_id}`,
      name: s.stop_name,
      latitude: lat,
      longitude: lng,
      routes: [],
      ada_accessible: null,
      metro: "los-angeles",
    });
  }
  console.log(`  stops.txt: ${stops.size} stops`);

  // 4. Parse stop_times.txt → assign routes to stops
  console.log("  Parsing stop_times.txt (this may take a moment)...");
  const stText = readFileSync(resolve(GTFS_DIR, "stop_times.txt"), "utf-8");
  const stLines = stText.trim().split("\n");
  const stHeaders = stLines[0].split(",").map((h) => h.trim().replace(/"/g, ""));
  const stTripIdx = stHeaders.indexOf("trip_id");
  const stStopIdx = stHeaders.indexOf("stop_id");

  let assigned = 0;
  for (let i = 1; i < stLines.length; i++) {
    const cols = stLines[i].split(",");
    const tripId = cols[stTripIdx]?.trim();
    const stopId = cols[stStopIdx]?.trim();
    const routeId = tripToRoute.get(tripId);
    if (!stopId || !routeId) continue;
    const routeName = routeIdToName.get(routeId) || routeId;
    const stop = stops.get(stopId);
    if (stop && !stop.routes.includes(routeName)) {
      stop.routes.push(routeName);
      assigned++;
    }
  }
  console.log(`  stop_times.txt: ${stLines.length - 1} entries, ${assigned} route assignments`);

  // 5. Upsert to Supabase
  const rows = Array.from(stops.values()).map((s) => ({
    ...s,
    updated_at: new Date().toISOString(),
  }));

  console.log(`\nUpserting ${rows.length} bus stops to Supabase...`);
  let upserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("transit_stops")
      .upsert(batch, { onConflict: "type,stop_id" });
    if (error) {
      console.error(`Batch ${i / BATCH_SIZE + 1} error:`, error.message);
    } else {
      upserted += batch.length;
    }
    if ((i / BATCH_SIZE + 1) % 5 === 0) {
      console.log(`  Progress: ${upserted}/${rows.length}`);
    }
  }

  console.log(`\nDone! Upserted ${upserted} LA Metro bus stops.`);
}

main().catch(console.error);

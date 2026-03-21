#!/usr/bin/env node

/**
 * Backfill LA Metro transit stops from GTFS data.
 *
 * Downloads the LA Metro GTFS feed, extracts stops.txt, classifies each stop
 * as 'rail' (Metro Rail lines) or 'bus', and upserts into the transit_stops
 * table with metro='los-angeles'.
 *
 * Data source: LA Metro GTFS
 * https://gitlab.com/LACMTA/gtfs_rail/-/raw/master/google_transit.zip  (rail)
 * https://gitlab.com/LACMTA/gtfs_bus/-/raw/master/google_transit.zip   (bus)
 *
 * Usage:
 *   node scripts/backfill-la-transit.mjs                   # rail + bus
 *   node scripts/backfill-la-transit.mjs --source=rail     # rail only
 *   node scripts/backfill-la-transit.mjs --source=bus      # bus only
 *   node scripts/backfill-la-transit.mjs --dry-run         # preview without inserting
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { createWriteStream, mkdtempSync } from "fs";
import { tmpdir } from "os";
import { execSync } from "child_process";

// ── Load .env.local ──────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env.local");
const envText = fs.readFileSync(envPath, "utf8");
const env = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, "").replace(/\\n/g, "");
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// ── CLI args ─────────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => {
    const [k, v] = a.slice(2).split("=");
    return [k, v || "true"];
  })
);
const SOURCE = args.source || "all";
const DRY_RUN = args["dry-run"] === "true";
const BATCH_SIZE = 500;

// ── GTFS feed URLs ───────────────────────────────────────────────────
// LA Metro publishes separate GTFS feeds for rail and bus on GitLab.
// The developer.metro.net URL redirects to these.
const GTFS_RAIL_URL = "https://gitlab.com/LACMTA/gtfs_rail/-/raw/master/google_transit.zip";
const GTFS_BUS_URL = "https://gitlab.com/LACMTA/gtfs_bus/-/raw/master/google_transit.zip";

// ── Rail line detection ──────────────────────────────────────────────
// Metro Rail route IDs/names in the GTFS feed.
// These cover: Red (B), Purple (D), Blue (A), Expo (E), Gold (L),
// Green (C), Crenshaw/LAX (K)
const RAIL_ROUTE_IDS = new Set([
  "801", // Red / B Line
  "802", // Purple / D Line
  "803", // Yellow / L Line (formerly Gold)
  "804", // Green / C Line
  "805", // Blue / A Line
  "806", // Expo / E Line
  "807", // Crenshaw / K Line
]);

const RAIL_ROUTE_NAMES = new Map([
  ["801", "B Line (Red)"],
  ["802", "D Line (Purple)"],
  ["803", "L Line (Gold)"],
  ["804", "C Line (Green)"],
  ["805", "A Line (Blue)"],
  ["806", "E Line (Expo)"],
  ["807", "K Line (Crenshaw)"],
]);

// ── Helpers ──────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Download a zip file, extract stops.txt, and return its content.
 */
async function downloadAndExtractStops(url, label) {
  const tmpDir = mkdtempSync(path.join(tmpdir(), "la-transit-"));
  const zipPath = path.join(tmpDir, "gtfs.zip");

  console.log(`  Downloading ${label} GTFS from ${url}...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${label} GTFS: ${res.status} ${res.statusText}`);

  const fileStream = createWriteStream(zipPath);
  await pipeline(Readable.fromWeb(res.body), fileStream);
  console.log(`  Downloaded to ${zipPath}`);

  // Extract stops.txt using unzip
  try {
    execSync(`unzip -o -d "${tmpDir}" "${zipPath}" stops.txt`, { stdio: "pipe" });
  } catch (e) {
    throw new Error(`Failed to extract stops.txt from ${label} GTFS zip: ${e.message}`);
  }

  const stopsPath = path.join(tmpDir, "stops.txt");
  if (!fs.existsSync(stopsPath)) {
    throw new Error(`stops.txt not found in ${label} GTFS zip`);
  }

  const content = fs.readFileSync(stopsPath, "utf8");

  // Also extract routes.txt and stop_times.txt / trips.txt if available for route mapping
  let routesContent = null;
  let tripsContent = null;
  let stopTimesContent = null;

  try {
    execSync(`unzip -o -d "${tmpDir}" "${zipPath}" routes.txt trips.txt stop_times.txt`, { stdio: "pipe" });
    routesContent = fs.existsSync(path.join(tmpDir, "routes.txt"))
      ? fs.readFileSync(path.join(tmpDir, "routes.txt"), "utf8")
      : null;
    tripsContent = fs.existsSync(path.join(tmpDir, "trips.txt"))
      ? fs.readFileSync(path.join(tmpDir, "trips.txt"), "utf8")
      : null;
    stopTimesContent = fs.existsSync(path.join(tmpDir, "stop_times.txt"))
      ? fs.readFileSync(path.join(tmpDir, "stop_times.txt"), "utf8")
      : null;
  } catch {
    // Optional files; route mapping will be skipped if not available
  }

  // Clean up
  fs.rmSync(tmpDir, { recursive: true, force: true });

  return { stopsContent: content, routesContent, tripsContent, stopTimesContent };
}

/**
 * Parse a CSV string (handles quoted fields with commas).
 */
function parseCSV(text) {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length === 0) return [];

  // Remove BOM if present
  const headerLine = lines[0].replace(/^\uFEFF/, "");
  const headers = parseCSVLine(headerLine);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length < headers.length) continue;
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j].trim()] = (values[j] || "").trim();
    }
    rows.push(row);
  }
  return rows;
}

function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

/**
 * Build a mapping: stop_id -> set of route_ids
 * Uses trips.txt + stop_times.txt to connect stops to routes.
 */
function buildStopRouteMap(tripsContent, stopTimesContent) {
  if (!tripsContent || !stopTimesContent) return null;

  // trip_id -> route_id from trips.txt
  const tripToRoute = new Map();
  const trips = parseCSV(tripsContent);
  for (const t of trips) {
    if (t.trip_id && t.route_id) {
      tripToRoute.set(t.trip_id, t.route_id);
    }
  }

  // stop_id -> set of route_ids from stop_times.txt
  const stopRoutes = new Map();
  const stopTimes = parseCSV(stopTimesContent);
  for (const st of stopTimes) {
    if (!st.stop_id || !st.trip_id) continue;
    const routeId = tripToRoute.get(st.trip_id);
    if (!routeId) continue;
    if (!stopRoutes.has(st.stop_id)) stopRoutes.set(st.stop_id, new Set());
    stopRoutes.get(st.stop_id).add(routeId);
  }

  return stopRoutes;
}

/**
 * Parse stops from GTFS stops.txt and classify as rail or bus.
 */
function parseStops(stopsContent, stopRouteMap, isRailFeed) {
  const rows = parseCSV(stopsContent);
  const stops = [];

  for (const row of rows) {
    const stopId = row.stop_id;
    const name = row.stop_name;
    const lat = parseFloat(row.stop_lat);
    const lon = parseFloat(row.stop_lon);

    // Skip entries without valid coordinates
    if (!stopId || !name || isNaN(lat) || isNaN(lon)) continue;

    // Skip parent stations with location_type=1 (we want the actual stops)
    // location_type: 0 or empty = stop, 1 = station, 2 = entrance
    if (row.location_type === "1") continue;

    // Determine routes for this stop
    const routeIds = stopRouteMap ? stopRouteMap.get(stopId) : null;
    const routeNames = [];
    let type;

    if (isRailFeed) {
      // Everything in the rail feed is rail
      type = "rail";
      if (routeIds) {
        for (const rid of routeIds) {
          const name = RAIL_ROUTE_NAMES.get(rid) || rid;
          routeNames.push(name);
        }
      }
    } else {
      // Bus feed
      type = "bus";
      if (routeIds) {
        for (const rid of routeIds) {
          routeNames.push(rid);
        }
      }
    }

    // ADA accessibility: wheelchair_boarding field in GTFS
    // 0 or empty = no info, 1 = accessible, 2 = not accessible
    const ada = row.wheelchair_boarding === "1"
      ? true
      : row.wheelchair_boarding === "2"
        ? false
        : null;

    stops.push({
      type,
      stop_id: `la-metro-${stopId}`,
      name,
      latitude: lat,
      longitude: lon,
      routes: routeNames.length > 0 ? routeNames : [],
      ada_accessible: ada,
      metro: "los-angeles",
    });
  }

  return stops;
}

/**
 * Upsert stops into Supabase in batches.
 */
async function upsertStops(stops) {
  let inserted = 0;
  for (let i = 0; i < stops.length; i += BATCH_SIZE) {
    const batch = stops.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("transit_stops")
      .upsert(batch, { onConflict: "type,stop_id", ignoreDuplicates: false });

    if (error) {
      console.error(`  Error upserting batch at offset ${i}:`, error.message);
      // If the error is about the type check constraint, provide guidance
      if (error.message.includes("transit_stops_type_check") || error.message.includes("check")) {
        console.error(`\n  The transit_stops table type constraint needs to be updated to include 'rail'.`);
        console.error(`  Run this SQL in the Supabase dashboard:\n`);
        console.error(`    ALTER TABLE transit_stops DROP CONSTRAINT transit_stops_type_check;`);
        console.error(`    ALTER TABLE transit_stops ADD CONSTRAINT transit_stops_type_check`);
        console.error(`      CHECK (type IN ('subway', 'bus', 'citibike', 'ferry', 'rail'));\n`);
        process.exit(1);
      }
    } else {
      inserted += batch.length;
      console.log(`  Upserted ${inserted}/${stops.length} stops`);
    }
    if (i + BATCH_SIZE < stops.length) await sleep(200);
  }
  return inserted;
}

// ── Main ─────────────────────────────────────────────────────────────
async function main() {
  console.log("=== Backfill LA Transit Stops ===\n");

  if (DRY_RUN) console.log("  [DRY RUN] No data will be written to the database.\n");

  const allStops = [];

  // ── Rail ────────────────────────────────────────────────────────────
  if (SOURCE === "all" || SOURCE === "rail") {
    console.log("[Rail] Fetching LA Metro Rail GTFS...");
    const { stopsContent, tripsContent, stopTimesContent } =
      await downloadAndExtractStops(GTFS_RAIL_URL, "rail");

    const stopRouteMap = buildStopRouteMap(tripsContent, stopTimesContent);
    const railStops = parseStops(stopsContent, stopRouteMap, true);
    console.log(`[Rail] Parsed ${railStops.length} rail stops`);
    allStops.push(...railStops);
  }

  // ── Bus ─────────────────────────────────────────────────────────────
  if (SOURCE === "all" || SOURCE === "bus") {
    console.log("[Bus] Fetching LA Metro Bus GTFS...");
    const { stopsContent, tripsContent, stopTimesContent } =
      await downloadAndExtractStops(GTFS_BUS_URL, "bus");

    const stopRouteMap = buildStopRouteMap(tripsContent, stopTimesContent);
    const busStops = parseStops(stopsContent, stopRouteMap, false);
    console.log(`[Bus] Parsed ${busStops.length} bus stops`);
    allStops.push(...busStops);
  }

  // ── Dedup by (type, stop_id) ────────────────────────────────────────
  const deduped = new Map();
  for (const stop of allStops) {
    const key = `${stop.type}:${stop.stop_id}`;
    if (!deduped.has(key)) {
      deduped.set(key, stop);
    } else {
      // Merge routes
      const existing = deduped.get(key);
      const merged = new Set([...existing.routes, ...stop.routes]);
      existing.routes = [...merged];
    }
  }
  const stops = [...deduped.values()];

  console.log(`\nTotal unique stops: ${stops.length}`);
  console.log(`  Rail: ${stops.filter((s) => s.type === "rail").length}`);
  console.log(`  Bus:  ${stops.filter((s) => s.type === "bus").length}`);

  if (DRY_RUN) {
    console.log("\n[DRY RUN] Sample stops:");
    for (const s of stops.slice(0, 10)) {
      console.log(`  ${s.type} | ${s.stop_id} | ${s.name} | (${s.latitude}, ${s.longitude}) | routes: ${s.routes.join(", ")}`);
    }
    console.log("\nDone (dry run). No data written.");
    return;
  }

  // ── Upsert ──────────────────────────────────────────────────────────
  console.log("\nUpserting into transit_stops...");
  const count = await upsertStops(stops);
  console.log(`\nDone. Upserted ${count} LA Metro transit stops.`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

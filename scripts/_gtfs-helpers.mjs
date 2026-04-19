/**
 * Shared GTFS helpers for transit_stops ingestion scripts.
 *
 * Extracted from scripts/backfill-la-transit.mjs. Used by:
 *   - scripts/backfill-chicago-transit.mjs  (CTA + Metra)
 *   - scripts/backfill-miami-transit.mjs    (Miami-Dade + Tri-Rail)
 *   - scripts/backfill-la-transit.mjs       (legacy, pre-shared)
 *
 * This module:
 *   - Downloads a GTFS .zip from a URL
 *   - Extracts stops.txt / routes.txt / trips.txt / stop_times.txt
 *   - Parses CSV (RFC-ish, handles quoted commas)
 *   - Builds a stop_id -> routeIds map by joining trips + stop_times
 *   - Batches upserts to `transit_stops` table with conflict handling
 */

import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { createWriteStream, mkdtempSync } from "fs";
import { tmpdir } from "os";
import { execSync } from "child_process";

const BATCH_SIZE = 500;

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Download a GTFS zip and extract the key files.
 * Returns an object with the raw text content of each file (or null if missing).
 * Cleans up the temp dir after reading.
 */
export async function downloadAndExtractGtfs(url, label) {
  const tmpDir = mkdtempSync(path.join(tmpdir(), `gtfs-${label}-`));
  const zipPath = path.join(tmpDir, "gtfs.zip");

  console.log(`  [${label}] Downloading GTFS from ${url}...`);
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`Failed to download ${label} GTFS: ${res.status} ${res.statusText}`);
  }

  const fileStream = createWriteStream(zipPath);
  await pipeline(Readable.fromWeb(res.body), fileStream);
  const sizeKb = (fs.statSync(zipPath).size / 1024).toFixed(0);
  console.log(`  [${label}] Downloaded ${sizeKb} KB`);

  // Extract key files (use -o to overwrite, -q to suppress noise).
  // Not all feeds include all files; unzip returns non-zero if any requested file is missing,
  // so we extract one at a time and tolerate individual failures.
  const files = ["stops.txt", "routes.txt", "trips.txt", "stop_times.txt"];
  for (const f of files) {
    try {
      execSync(`unzip -o -q -d "${tmpDir}" "${zipPath}" "${f}"`, { stdio: "pipe" });
    } catch {
      // optional — skip
    }
  }

  const readIfExists = (f) => {
    const p = path.join(tmpDir, f);
    return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
  };

  const result = {
    stopsContent: readIfExists("stops.txt"),
    routesContent: readIfExists("routes.txt"),
    tripsContent: readIfExists("trips.txt"),
    stopTimesContent: readIfExists("stop_times.txt"),
  };

  // Clean up
  fs.rmSync(tmpDir, { recursive: true, force: true });

  if (!result.stopsContent) {
    throw new Error(`[${label}] stops.txt not found in GTFS zip`);
  }

  return result;
}

/**
 * Parse a CSV string into an array of row objects keyed by header name.
 * Handles quoted fields containing commas or escaped quotes.
 */
export function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];

  const headerLine = lines[0].replace(/^\uFEFF/, "");
  const headers = parseCSVLine(headerLine).map((h) => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length < headers.length / 2) continue; // skip obviously malformed
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = (values[j] || "").trim();
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
 * Build a Map<stop_id, Set<route_id>> by joining trips.txt and stop_times.txt.
 * Returns null if either file is missing.
 */
export function buildStopRouteMap(tripsContent, stopTimesContent) {
  if (!tripsContent || !stopTimesContent) return null;

  const tripToRoute = new Map();
  const trips = parseCSV(tripsContent);
  for (const t of trips) {
    if (t.trip_id && t.route_id) {
      tripToRoute.set(t.trip_id, t.route_id);
    }
  }

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
 * Build a Map<route_id, { short_name, long_name, type }> from routes.txt.
 * Returns null if routes.txt is missing.
 *
 * GTFS route_type values (spec):
 *   0=tram, 1=subway/metro, 2=rail (commuter/intercity), 3=bus,
 *   4=ferry, 5=cable tram, 6=aerial lift, 7=funicular, 11=trolleybus, 12=monorail
 */
export function buildRouteInfoMap(routesContent) {
  if (!routesContent) return null;
  const rows = parseCSV(routesContent);
  const map = new Map();
  for (const r of rows) {
    if (!r.route_id) continue;
    map.set(r.route_id, {
      short_name: r.route_short_name || "",
      long_name: r.route_long_name || "",
      type: r.route_type || "",
    });
  }
  return map;
}

/**
 * Classify a GTFS route_type string into our transit_stops.type enum.
 * Returns one of: 'subway' | 'rail' | 'bus' | 'ferry' | null
 *
 * We treat:
 *   0 (tram/light rail) -> rail
 *   1 (subway/metro)    -> subway
 *   2 (commuter rail)   -> rail
 *   3 (bus)             -> bus
 *   4 (ferry)           -> ferry
 *   11 (trolleybus)     -> bus
 *   12 (monorail)       -> rail
 *   Extended 100s (rail services)      -> rail
 *   Extended 200s (coach/bus services) -> bus
 *   Extended 400s (urban railway)      -> subway
 *   Extended 700s (bus service)        -> bus
 *   Extended 900s (tram service)       -> rail
 *   Extended 1000s (water transport)   -> ferry
 */
export function classifyRouteType(routeTypeStr) {
  if (!routeTypeStr) return null;
  const t = parseInt(routeTypeStr, 10);
  if (isNaN(t)) return null;
  if (t === 0) return "rail";
  if (t === 1) return "subway";
  if (t === 2) return "rail";
  if (t === 3) return "bus";
  if (t === 4) return "ferry";
  if (t === 11) return "bus";
  if (t === 12) return "rail";
  if (t >= 100 && t <= 199) return "rail";
  if (t >= 200 && t <= 299) return "bus";
  if (t >= 400 && t <= 499) return "subway";
  if (t >= 700 && t <= 799) return "bus";
  if (t >= 900 && t <= 999) return "rail";
  if (t >= 1000 && t <= 1099) return "ferry";
  return null;
}

/**
 * Parse stops from stops.txt, classifying each by the majority/first route type
 * associated with that stop via stopRouteMap + routeInfoMap.
 *
 * Args:
 *   stopsContent       - raw stops.txt content
 *   stopRouteMap       - Map<stop_id, Set<route_id>>  (may be null)
 *   routeInfoMap       - Map<route_id, {short_name, long_name, type}> (may be null)
 *   metro              - metro slug ('chicago', 'miami', ...)
 *   stopIdPrefix       - prefix for our stop_id column (e.g. 'cta-')
 *   defaultType        - fallback type if classification fails (e.g. 'bus')
 *   typeOverride       - if set, force all stops to this type (useful for single-modality feeds)
 *
 * Returns array of rows ready for upsert into transit_stops.
 */
export function parseStops({
  stopsContent,
  stopRouteMap,
  routeInfoMap,
  metro,
  stopIdPrefix,
  defaultType = "bus",
  typeOverride = null,
}) {
  const rows = parseCSV(stopsContent);
  const stops = [];

  for (const row of rows) {
    const stopId = row.stop_id;
    const name = row.stop_name;
    const lat = parseFloat(row.stop_lat);
    const lon = parseFloat(row.stop_lon);

    if (!stopId || !name || isNaN(lat) || isNaN(lon)) continue;
    // Skip parent stations (we want the boardable stops/platforms)
    if (row.location_type === "1") continue;

    // Determine type + route names
    const routeIds = stopRouteMap ? stopRouteMap.get(stopId) : null;
    const routeNames = [];
    let type = typeOverride || defaultType;

    if (routeIds && routeInfoMap) {
      // If any route at this stop is subway/rail, prefer that classification
      // (a stop might serve both a bus line and a light-rail line — classify as
      // the higher-modality).
      const typesSeen = new Set();
      for (const rid of routeIds) {
        const info = routeInfoMap.get(rid);
        if (!info) continue;
        const classified = classifyRouteType(info.type);
        if (classified) typesSeen.add(classified);

        // Route label: prefer short_name, fallback to long_name
        const label = info.short_name || info.long_name || rid;
        if (label && !routeNames.includes(label)) routeNames.push(label);
      }
      if (!typeOverride) {
        // Priority order: subway > rail > ferry > bus
        if (typesSeen.has("subway")) type = "subway";
        else if (typesSeen.has("rail")) type = "rail";
        else if (typesSeen.has("ferry")) type = "ferry";
        else if (typesSeen.has("bus")) type = "bus";
      }
    } else if (routeIds) {
      // No routeInfoMap — just record raw route IDs
      for (const rid of routeIds) routeNames.push(rid);
    }

    const ada =
      row.wheelchair_boarding === "1"
        ? true
        : row.wheelchair_boarding === "2"
          ? false
          : null;

    stops.push({
      type,
      stop_id: `${stopIdPrefix}${stopId}`,
      name,
      latitude: lat,
      longitude: lon,
      routes: routeNames,
      ada_accessible: ada,
      metro,
    });
  }

  return stops;
}

/**
 * Deduplicate a stops array by (type, stop_id). Merges `routes` arrays on collision.
 */
export function dedupeStops(stops) {
  const deduped = new Map();
  for (const stop of stops) {
    const key = `${stop.type}:${stop.stop_id}`;
    if (!deduped.has(key)) {
      deduped.set(key, stop);
    } else {
      const existing = deduped.get(key);
      const merged = new Set([...(existing.routes || []), ...(stop.routes || [])]);
      existing.routes = [...merged];
    }
  }
  return [...deduped.values()];
}

/**
 * Upsert stops into Supabase in batches of BATCH_SIZE.
 */
export async function upsertStops(supabase, stops, { dryRun = false } = {}) {
  if (dryRun) {
    console.log(`  [DRY RUN] Would upsert ${stops.length} stops. Sample:`);
    for (const s of stops.slice(0, 5)) {
      console.log(`    ${s.type} | ${s.stop_id} | ${s.name} | routes: ${s.routes.slice(0, 3).join(", ")}`);
    }
    return stops.length;
  }

  let inserted = 0;
  for (let i = 0; i < stops.length; i += BATCH_SIZE) {
    const batch = stops.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("transit_stops")
      .upsert(batch, { onConflict: "type,stop_id", ignoreDuplicates: false });

    if (error) {
      console.error(`  Error upserting batch at offset ${i}:`, error.message);
      if (error.message.includes("transit_stops_type_check") || error.message.includes("check constraint")) {
        console.error(`\n  The transit_stops type constraint may need to be updated.`);
        console.error(`  Allowed: subway, bus, citibike, ferry, rail\n`);
      }
      throw error;
    }
    inserted += batch.length;
    if (inserted % 2000 === 0 || inserted === stops.length) {
      console.log(`  Upserted ${inserted}/${stops.length}`);
    }
    if (i + BATCH_SIZE < stops.length) await sleep(100);
  }
  return inserted;
}

/**
 * Load supabase client + CLI args.
 * Returns { supabase, args } where args is { source, "dry-run", ... }.
 */
export function bootstrap(__dirname, { createClient }) {
  const envPath = path.join(__dirname, "..", ".env.local");
  const envText = fs.readFileSync(envPath, "utf8");
  const env = {};
  for (const line of envText.split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, "").replace(/\\n/g, "");
  }

  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const args = Object.fromEntries(
    process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => {
      const [k, v] = a.slice(2).split("=");
      return [k, v === undefined ? "true" : v];
    })
  );

  return { supabase, args };
}

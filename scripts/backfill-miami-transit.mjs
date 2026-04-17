#!/usr/bin/env node

/**
 * Backfill Miami transit stops from GTFS data.
 *
 * Sources:
 *   - Miami-Dade Transit (MDT) — Metrorail + Metromover + Metrobus
 *     https://www.miamidade.gov/transit/googletransit/current/google_transit.zip
 *
 * Current state (2026-04-11): Miami has ZERO transit stops loaded. Building
 * pages silently return null from /api/transit/nearby and the WalkabilityScore
 * card renders nothing. This script is the first ingestion.
 *
 * MDT's single GTFS feed covers all three modalities:
 *   - Metrorail    — heavy rail, 23 stations. GTFS route_type=1 → 'subway'
 *   - Metromover   — automated people mover downtown. GTFS route_type=1 → 'subway'
 *                    (it's technically a people mover, but renters treat it as
 *                    rapid transit; classifying as 'subway' is correct for
 *                    walkability scoring purposes)
 *   - Metrobus     — GTFS route_type=3 → 'bus'
 *
 * Tri-Rail: the sfrta.fl.gov GTFS feed appears to have been taken down
 * (checked 2026-04-11; the zip URL 308-redirects to a WordPress homepage).
 * Not a huge loss — Tri-Rail only has 18 stations spanning Miami/Broward/Palm
 * Beach, and most rental-relevant stops are in downtown Miami which MDT
 * already covers via Metrorail. If we find a working Tri-Rail feed later, add
 * it as a second `ingestFeed()` call with `typeOverride: 'rail'`.
 *
 * Brightline: privately operated, does not publish GTFS.
 *
 * Uses shared helpers from _gtfs-helpers.mjs. Idempotent upsert on
 * (type, stop_id) with prefix 'mdt-'.
 *
 * Usage:
 *   node scripts/backfill-miami-transit.mjs
 *   node scripts/backfill-miami-transit.mjs --dry-run
 *
 * Plan: docs/superpowers/plans/2026-04-10-walk-score-integration.md
 */

import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

import {
  downloadAndExtractGtfs,
  buildStopRouteMap,
  buildRouteInfoMap,
  parseStops,
  dedupeStops,
  upsertStops,
  bootstrap,
} from "./_gtfs-helpers.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { supabase, args } = bootstrap(__dirname, { createClient });

const DRY_RUN = args["dry-run"] === "true";

const MDT_GTFS_URL = "https://www.miamidade.gov/transit/googletransit/current/google_transit.zip";

async function ingestFeed({ url, label, stopIdPrefix, typeOverride }) {
  console.log(`\n[${label}] Fetching...`);
  const { stopsContent, routesContent, tripsContent, stopTimesContent } =
    await downloadAndExtractGtfs(url, label);

  const stopRouteMap = buildStopRouteMap(tripsContent, stopTimesContent);
  const routeInfoMap = buildRouteInfoMap(routesContent);

  const stops = parseStops({
    stopsContent,
    stopRouteMap,
    routeInfoMap,
    metro: "miami",
    stopIdPrefix,
    defaultType: "bus",
    typeOverride,
  });

  const byType = stops.reduce((acc, s) => {
    acc[s.type] = (acc[s.type] || 0) + 1;
    return acc;
  }, {});
  console.log(`[${label}] Parsed ${stops.length} stops: ${JSON.stringify(byType)}`);

  return stops;
}

async function main() {
  console.log("=== Backfill Miami Transit Stops ===");
  if (DRY_RUN) console.log("  [DRY RUN] No data will be written.\n");

  const allStops = [];

  const mdtStops = await ingestFeed({
    url: MDT_GTFS_URL,
    label: "MDT",
    stopIdPrefix: "mdt-",
    // No typeOverride — classification comes from GTFS route_type:
    //   route_type=1 (metrorail, metromover) -> 'subway'
    //   route_type=3 (metrobus) -> 'bus'
  });
  allStops.push(...mdtStops);

  const deduped = dedupeStops(allStops);

  const summary = deduped.reduce((acc, s) => {
    acc[s.type] = (acc[s.type] || 0) + 1;
    return acc;
  }, {});
  console.log(`\nTotal unique stops after dedup: ${deduped.length}`);
  console.log(`  By type: ${JSON.stringify(summary)}`);

  console.log("\nUpserting into transit_stops...");
  const count = await upsertStops(supabase, deduped, { dryRun: DRY_RUN });
  console.log(`\nDone. Upserted ${count} Miami transit stops.`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

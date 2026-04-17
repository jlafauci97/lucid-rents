#!/usr/bin/env node

/**
 * Backfill Chicago transit stops from GTFS data.
 *
 * Sources:
 *   - CTA  (Chicago Transit Authority) — L trains + buses
 *     https://www.transitchicago.com/downloads/sch_data/google_transit.zip
 *   - Metra (commuter rail)
 *     https://schedules.metrarail.com/gtfs/schedule.zip
 *
 * Current state (2026-04-11): Chicago has 156 CTA L stops loaded. This script
 * adds CTA bus stops (~11K) and Metra rail stops (~240). After this runs,
 * Chicago building pages will render a real WalkabilityScore instead of
 * silently returning null from /api/transit/nearby.
 *
 * Uses shared helpers from _gtfs-helpers.mjs. Classification is driven by
 * GTFS route_type (1=subway, 2=rail, 3=bus), so stops serving both L and bus
 * routes are classified as 'subway' (L wins over bus in the priority order).
 *
 * Idempotent: upserts on (type, stop_id) with prefixes 'cta-' and 'metra-'.
 *
 * Usage:
 *   node scripts/backfill-chicago-transit.mjs                    # all
 *   node scripts/backfill-chicago-transit.mjs --source=cta       # CTA only
 *   node scripts/backfill-chicago-transit.mjs --source=metra     # Metra only
 *   node scripts/backfill-chicago-transit.mjs --dry-run
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

const SOURCE = args.source || "all";
const DRY_RUN = args["dry-run"] === "true";

// GTFS feed URLs — verified live 2026-04-11
const CTA_GTFS_URL = "https://www.transitchicago.com/downloads/sch_data/google_transit.zip";
const METRA_GTFS_URL = "https://schedules.metrarail.com/gtfs/schedule.zip";

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
    metro: "chicago",
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
  console.log("=== Backfill Chicago Transit Stops ===");
  if (DRY_RUN) console.log("  [DRY RUN] No data will be written.\n");

  const allStops = [];

  if (SOURCE === "all" || SOURCE === "cta") {
    const ctaStops = await ingestFeed({
      url: CTA_GTFS_URL,
      label: "CTA",
      stopIdPrefix: "cta-",
    });
    allStops.push(...ctaStops);
  }

  if (SOURCE === "all" || SOURCE === "metra") {
    // Metra is commuter rail only — force type override to avoid
    // depending on routes.txt being present or correct.
    const metraStops = await ingestFeed({
      url: METRA_GTFS_URL,
      label: "Metra",
      stopIdPrefix: "metra-",
      typeOverride: "rail",
    });
    allStops.push(...metraStops);
  }

  const deduped = dedupeStops(allStops);

  const summary = deduped.reduce((acc, s) => {
    acc[s.type] = (acc[s.type] || 0) + 1;
    return acc;
  }, {});
  console.log(`\nTotal unique stops after dedup: ${deduped.length}`);
  console.log(`  By type: ${JSON.stringify(summary)}`);

  console.log("\nUpserting into transit_stops...");
  const count = await upsertStops(supabase, deduped, { dryRun: DRY_RUN });
  console.log(`\nDone. Upserted ${count} Chicago transit stops.`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

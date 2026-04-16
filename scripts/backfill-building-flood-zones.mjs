#!/usr/bin/env node

/**
 * Backfill `buildings.flood_zone` for Miami + Houston buildings by running
 * point-in-polygon queries against the freshly-ingested FEMA NFHL data.
 *
 * Note: we only populate `flood_zone` (not subtype/assessed_at). The subtype
 * is available on demand via flood_zone_for_point() and assessed_at is just
 * metadata. Keeping the backfill column-minimal avoids ALTER TABLE lock
 * contention with the live cron sync.
 *
 * Strategy: use a single SQL UPDATE statement per metro that joins each
 * building against `flood_zones` via ST_Contains, picking the most-severe
 * zone. This is faster than doing one RPC call per building (which would be
 * 260K round-trips for Miami).
 *
 * We do the work in a SQL function wrapper (`backfill_flood_zones_for_metro`)
 * rather than a single massive UPDATE because:
 *   1. A ~260K-row UPDATE in one statement on the buildings table is asking
 *      for a lock timeout in production.
 *   2. We want progress logging batch-by-batch.
 *
 * Idempotent: re-running produces no changes unless flood_zones data has
 * grown.
 *
 * Usage:
 *   node scripts/backfill-building-flood-zones.mjs                  # both
 *   node scripts/backfill-building-flood-zones.mjs --metro=miami
 *   node scripts/backfill-building-flood-zones.mjs --metro=houston
 *
 * Plan: docs/superpowers/plans/2026-04-10-fema-flood-zones.md
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

const envPath = resolve(process.cwd(), ".env.local");
const env = {};
for (const line of readFileSync(envPath, "utf8").split("\n")) {
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

const METRO_FILTER = args.metro || null;
const DRY_RUN = args["dry-run"] === "true";

const CHUNK_SIZE = 100;

async function backfillMetro(metro) {
  console.log(`\n=== ${metro} ===`);

  if (DRY_RUN) {
    console.log("  [DRY RUN] Would process in chunks of 100.");
    return;
  }

  // Chunked approach: repeatedly call backfill_flood_zones_chunk which
  // updates a small batch and returns how many it updated. We stop when
  // it returns 0 (or a zone_code-null count that's stable, meaning
  // remaining buildings are all outside mapped polygons).
  //
  // Why chunks: PostgREST caps RPC calls at ~60s. A single batch of 100
  // completes in ~2-5s for Miami/Houston with the GIST index.

  let totalUpdated = 0;
  let totalProcessed = 0;
  let emptyBatches = 0;
  const startMs = Date.now();

  while (true) {
    const { data, error } = await supabase.rpc("backfill_flood_zones_chunk", {
      p_metro: metro,
      p_limit: CHUNK_SIZE,
    });

    if (error) {
      console.error(`  Chunk error after ${totalProcessed} processed:`, error.message);
      // Retry once after a brief pause for transient timeouts
      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }

    const row = data?.[0];
    const processed = row?.processed ?? 0;
    const updated = row?.updated ?? 0;

    totalProcessed += processed;
    totalUpdated += updated;

    if (processed === 0) {
      emptyBatches++;
      if (emptyBatches >= 2) break;
    } else {
      emptyBatches = 0;
    }

    if (totalProcessed % 1000 === 0 || processed === 0) {
      const elapsedSec = Math.round((Date.now() - startMs) / 1000);
      console.log(
        JSON.stringify({
          evt: "progress",
          metro,
          processed: totalProcessed,
          updated: totalUpdated,
          elapsed_sec: elapsedSec,
          rate_per_sec: elapsedSec > 0 ? Math.round(totalProcessed / elapsedSec) : 0,
        })
      );
    }
  }

  console.log(`\n  Total processed: ${totalProcessed}`);
  console.log(`  Total updated:   ${totalUpdated}`);
}

async function main() {
  console.log("=== Backfill Building Flood Zones ===");
  const metros = METRO_FILTER ? [METRO_FILTER] : ["miami", "houston"];
  for (const metro of metros) {
    await backfillMetro(metro);
  }
  console.log("\n=== Done. ===");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

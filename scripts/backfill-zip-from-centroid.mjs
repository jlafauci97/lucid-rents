#!/usr/bin/env node
/**
 * Backfill buildings.zip_code from the nearest zip_centroid for every row that
 * has lat/lng but no zip_code. The BEFORE-UPDATE trigger added in migration
 * 20260526160000_building_zip_from_centroid_trigger.sql handles future rows.
 * This script catches up the ~338K existing rows that pre-dated the trigger.
 *
 * Runs ~2K rows per batch (above ~5K the buildings table's expression indexes
 * hit Supabase's statement timeout).
 *
 * Usage: source .env.local && node scripts/backfill-zip-from-centroid.mjs [--metro=chicago]
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

const BATCH = 500;
const metroFilter = process.argv.find((a) => a.startsWith("--metro="))?.split("=")[1] ?? null;
const METROS = metroFilter ? [metroFilter] : ["chicago", "houston", "los-angeles", "miami", "nyc"];

async function rpcExec(sql) {
  // execute_sql RPC not available — use a function via raw SQL through PostgREST is also not direct.
  // Instead: use the supabase-js .from().update() flow with per-row payload (slow), OR pass a
  // server-side function. Simplest: define a one-shot SQL function we can call via .rpc().
  throw new Error("unused");
}

async function backfillBatch(metro) {
  // Atomic CTE: pick 2K oldest null-zip rows in this metro, update them inline
  // using the nearest centroid. Returns the count updated.
  const { data, error } = await supabase
    .rpc("backfill_zip_centroid_batch", { p_metro: metro, p_limit: BATCH });
  if (error) throw error;
  return data ?? 0;
}

async function ensureRpc() {
  // The RPC must already exist in the DB. If not, we instruct the operator.
  const { error } = await supabase.rpc("backfill_zip_centroid_batch", { p_metro: "chicago", p_limit: 0 });
  if (error && /function/.test(error.message)) {
    console.error(
      "Missing RPC. Apply migration: supabase/migrations/20260526160500_backfill_zip_centroid_batch.sql"
    );
    process.exit(1);
  }
}

async function run() {
  await ensureRpc();
  for (const metro of METROS) {
    console.log(`\n=== ${metro} ===`);
    let total = 0;
    let batchNum = 0;
    while (true) {
      const t0 = Date.now();
      let updated = 0;
      try {
        updated = await backfillBatch(metro);
      } catch (err) {
        const msg = err.message ?? String(err);
        console.warn(`  batch ${batchNum} failed: ${msg}; backing off 30s and retrying...`);
        for (let retry = 0; retry < 5; retry++) {
          await new Promise((r) => setTimeout(r, 30000));
          try {
            updated = await backfillBatch(metro);
            break;
          } catch (e2) {
            console.warn(`    retry ${retry + 1}/5 failed: ${e2.message ?? e2}`);
            if (retry === 4) {
              console.error(`  batch ${batchNum} giving up after 5 retries; moving to next metro`);
              updated = -1;
            }
          }
        }
        if (updated === -1) break;
      }
      total += updated;
      const dt = ((Date.now() - t0) / 1000).toFixed(1);
      if (updated === 0) {
        console.log(`  done. total: ${total.toLocaleString()}`);
        break;
      }
      if (batchNum % 5 === 0) console.log(`  batch ${batchNum}: ${updated} rows (${dt}s) — total ${total.toLocaleString()}`);
      batchNum++;
    }
  }
  console.log("\nAll metros done.");
}

run().catch((e) => { console.error(e); process.exit(1); });

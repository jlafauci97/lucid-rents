#!/usr/bin/env node
/**
 * Single-row variant of backfill-zip-from-centroid. Calls
 * `backfill_zip_centroid_single(uuid)` for each null-zip building.
 *
 * Why row-by-row: batched UPDATEs times out on the buildings(metro,
 * normalize_street(street_name)) partial indexes under production read
 * load. Per-row updates are tiny transactions that don't contend.
 *
 * Usage:
 *   source .env.local && node scripts/backfill-zip-rowwise.mjs --metro=nyc
 *   source .env.local && node scripts/backfill-zip-rowwise.mjs   # all metros
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing env");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

const FETCH = 100; // IDs per fetch (smaller = faster first response)
const metroFilter = process.argv.find((a) => a.startsWith("--metro="))?.split("=")[1] ?? null;
const METROS = metroFilter ? [metroFilter] : ["nyc", "miami", "los-angeles", "houston", "chicago"];

async function fetchPendingIds(metro, limit) {
  const { data, error } = await supabase
    .from("buildings")
    .select("id")
    .eq("metro", metro)
    .is("zip_code", null)
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .order("id")
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((b) => b.id);
}

async function updateOne(id) {
  const { data, error } = await supabase.rpc("backfill_zip_centroid_single", { p_id: id });
  if (error) throw error;
  return data;
}

async function runMetro(metro) {
  console.log(`\n=== ${metro} ===`);
  let total = 0;
  let failures = 0;
  while (true) {
    let ids;
    try {
      ids = await fetchPendingIds(metro, FETCH);
    } catch (err) {
      console.warn(`  fetch failed: ${err.message ?? err}; backing off 10s`);
      await new Promise((r) => setTimeout(r, 10000));
      continue;
    }
    if (ids.length === 0) {
      console.log(`  done. total: ${total.toLocaleString()} (${failures} failed)`);
      return;
    }
    const t0 = Date.now();
    let chunkOk = 0;
    for (const id of ids) {
      try {
        await updateOne(id);
        chunkOk++;
      } catch (err) {
        failures++;
        if (failures < 5 || failures % 50 === 0) {
          console.warn(`  row ${id.slice(0, 8)} failed: ${err.message ?? err}`);
        }
      }
    }
    total += chunkOk;
    const dt = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`  +${chunkOk}/${ids.length} (${dt}s) — total ${total.toLocaleString()}`);
  }
}

async function run() {
  for (const metro of METROS) {
    await runMetro(metro);
  }
  console.log("\nAll metros done.");
}

run().catch((e) => { console.error(e); process.exit(1); });

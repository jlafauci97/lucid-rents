#!/usr/bin/env node
/**
 * Historical 311 backfill for NYC (~7 years).
 *
 * Pulls records from the NYC Open Data 311 dataset (erm2-nwe9) going back to
 * a fixed start date, filtered to housing/QoL complaint types, and upserts
 * into complaints_311. Linking to buildings is done server-side via the
 * link_311_nyc_by_keys RPC, which parses incident_address and joins on the
 * (street_name, house_number) btree index — far faster than per-address
 * REST lookups for bulk runs.
 *
 * Resumable: writes progress to scripts/.backfill-nyc-311-historical.progress.json
 * so you can Ctrl-C and re-run.
 *
 * Usage:
 *   node scripts/backfill-nyc-311-historical.mjs
 *   node scripts/backfill-nyc-311-historical.mjs --start=2019-04-22
 *   node scripts/backfill-nyc-311-historical.mjs --reset   # clear progress
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config({ path: ".env.local" });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROGRESS_FILE = path.join(__dirname, ".backfill-nyc-311-historical.progress.json");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP_TOKEN = process.env.NYC_OPEN_DATA_APP_TOKEN;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Same list as the sync route. Uppercase canonical labels; SoQL upper() makes
// it case-insensitive against the live data.
const COMPLAINT_TYPES = [
  "HEAT/HOT WATER", "PLUMBING", "PAINT/PLASTER", "WATER LEAK",
  "GENERAL CONSTRUCTION/PLUMBING", "ELEVATOR", "ELECTRIC", "RODENT",
  "UNSANITARY CONDITION", "DOOR/WINDOW", "FLOORING/STAIRS", "APPLIANCE",
  "OUTSIDE BUILDING", "SAFETY", "MOLD", "LEAD", "HPD LITIGATION",
  "WATER SYSTEM", "SEWER",
  "NOISE", "NOISE - RESIDENTIAL", "NOISE - STREET/SIDEWALK",
  "NOISE - COMMERCIAL", "NOISE - VEHICLE", "NOISE - HOUSE OF WORSHIP",
  "NOISE - PARK",
  "DIRTY CONDITION", "MISSED COLLECTION", "ILLEGAL DUMPING",
  "ILLEGAL PARKING", "BLOCKED DRIVEWAY", "DERELICT VEHICLES",
  "ABANDONED VEHICLE", "REQUEST LARGE BULKY ITEM COLLECTION",
  "ILLEGAL FIREWORKS", "GRAFFITI",
];

const PAGE_SIZE = 2000;
const UPSERT_BATCH = 200;
const INTER_BATCH_MS = 150; // tiny breather between batches to keep connection pool healthy

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  })
);

if (args.reset) {
  if (fs.existsSync(PROGRESS_FILE)) fs.unlinkSync(PROGRESS_FILE);
  console.log("Progress reset.");
  process.exit(0);
}

const START_DATE = args.start || "2019-04-22T00:00:00";

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------
function loadProgress() {
  if (!fs.existsSync(PROGRESS_FILE)) return { cursor: START_DATE, totalInserted: 0, totalLinked: 0 };
  try { return JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf-8")); }
  catch { return { cursor: START_DATE, totalInserted: 0, totalLinked: 0 }; }
}
function saveProgress(p) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2));
}

// ---------------------------------------------------------------------------
// SODA fetch
// ---------------------------------------------------------------------------
const SELECT_FIELDS = "unique_key,complaint_type,descriptor,agency,status,created_date,closed_date,resolution_description,borough,incident_address,latitude,longitude";

async function fetchPage(afterDate) {
  const typesIn = COMPLAINT_TYPES.map((t) => `'${t}'`).join(",");
  const where = `created_date > '${afterDate}' AND upper(complaint_type) IN (${typesIn})`;
  const params = new URLSearchParams({
    $where: where,
    $order: "created_date ASC",
    $limit: String(PAGE_SIZE),
    $select: SELECT_FIELDS,
  });
  const url = `https://data.cityofnewyork.us/resource/erm2-nwe9.json?${params}${APP_TOKEN ? `&$$app_token=${APP_TOKEN}` : ""}`;

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
      if (res.status === 429 || res.status >= 500) {
        const backoff = Math.min(30_000, 2_000 * 2 ** attempt);
        console.warn(`  ! ${res.status}, retrying in ${backoff}ms`);
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }
      if (!res.ok) throw new Error(`SODA ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return await res.json();
    } catch (err) {
      const backoff = Math.min(30_000, 2_000 * 2 ** attempt);
      console.warn(`  ! fetch error (${err.message}), retrying in ${backoff}ms`);
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  throw new Error("SODA fetch failed after 5 retries");
}

// ---------------------------------------------------------------------------
// Upsert (fast path: ON CONFLICT DO NOTHING via onConflict + ignoreDuplicates)
// ---------------------------------------------------------------------------
function isTransient(error) {
  if (!error) return false;
  if (error.code === "PGRST003" || error.code === "57014") return true;
  const msg = `${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`.toLowerCase();
  return (
    msg.includes("timeout") ||
    msg.includes("fetch failed") ||
    msg.includes("connection") ||
    msg.includes("und_err") ||
    msg.includes("econnreset") ||
    msg.includes("enotfound") ||
    msg.includes("headers timeout") ||
    msg.includes("socket")
  );
}

async function upsertBatch(rows) {
  const numBatches = Math.ceil(rows.length / UPSERT_BATCH);
  for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
    const chunk = rows.slice(i, i + UPSERT_BATCH);
    const batchIdx = Math.floor(i / UPSERT_BATCH);
    for (let attempt = 0; attempt < 8; attempt++) {
      const { error } = await supabase
        .from("complaints_311")
        .upsert(chunk, { onConflict: "unique_key,metro", ignoreDuplicates: true });
      if (!error) break;
      // PGRST003 = connection pool timeout. Retry with backoff.
      if (isTransient(error)) {
        const backoff = Math.min(30_000, 2_000 * 2 ** attempt);
        process.stdout.write(`    ! pool timeout batch ${batchIdx + 1}/${numBatches} — retry ${attempt + 1} in ${backoff}ms\n`);
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }
      console.error(`  ! upsert error (batch ${batchIdx + 1}/${numBatches}, ${chunk.length} rows):`, error);
      throw error;
    }
    if (INTER_BATCH_MS > 0 && batchIdx < numBatches - 1) {
      await new Promise((r) => setTimeout(r, INTER_BATCH_MS));
    }
  }
}

// ---------------------------------------------------------------------------
// Server-side link via RPC — parses incident_address and joins on the
// (street_name, house_number) btree in one statement per batch.
// ---------------------------------------------------------------------------
async function linkKeys(keys) {
  if (keys.length === 0) return 0;
  let linked = 0;
  const RPC_CHUNK = 1000;
  for (let i = 0; i < keys.length; i += RPC_CHUNK) {
    const slice = keys.slice(i, i + RPC_CHUNK);
    for (let attempt = 0; attempt < 6; attempt++) {
      const { data, error } = await supabase.rpc("link_311_nyc_by_keys", { keys: slice });
      if (!error) {
        linked += Number(data ?? 0);
        break;
      }
      if (isTransient(error)) {
        const backoff = Math.min(20_000, 1_000 * 2 ** attempt);
        console.warn(`  ! link pool/timeout (attempt ${attempt + 1}), sleeping ${backoff}ms`);
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }
      console.error(`  ! link_311_nyc_by_keys error:`, error.message);
      break;
    }
  }
  return linked;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const progress = loadProgress();
  console.log(`[start] cursor=${progress.cursor}, inserted=${progress.totalInserted.toLocaleString()}, linked=${progress.totalLinked.toLocaleString()}, types=${COMPLAINT_TYPES.length}, app_token=${APP_TOKEN ? "yes" : "no"}`);

  let pagesFetched = 0;
  const startedAt = Date.now();

  while (true) {
    const tFetch = Date.now();
    let records;
    try {
      records = await fetchPage(progress.cursor);
    } catch (err) {
      console.warn(`  ! page fetch failed: ${err.message} — sleeping 30s and retrying`);
      await new Promise((r) => setTimeout(r, 30_000));
      continue;
    }
    if (!records.length) {
      console.log("[done] SODA returned 0 records — caught up.");
      break;
    }

    const rows = records
      .filter((r) => r.unique_key)
      .map((r) => ({
        unique_key: String(r.unique_key),
        complaint_type: r.complaint_type || null,
        descriptor: r.descriptor || null,
        agency: r.agency || null,
        status: r.status || null,
        created_date: r.created_date || null,
        closed_date: r.closed_date || null,
        resolution_description: r.resolution_description || null,
        borough: r.borough || null,
        incident_address: r.incident_address || null,
        latitude: r.latitude ? parseFloat(r.latitude) : null,
        longitude: r.longitude ? parseFloat(r.longitude) : null,
        imported_at: new Date().toISOString(),
        metro: "nyc",
      }));

    const tUp = Date.now();
    try {
      await upsertBatch(rows);
    } catch (err) {
      console.warn(`  ! upsert ultimately failed (${err.message}) — sleeping 60s then retrying this page`);
      await new Promise((r) => setTimeout(r, 60_000));
      continue;
    }

    const tL = Date.now();
    const keys = rows.map((r) => r.unique_key);
    let linkedNow = 0;
    try {
      linkedNow = await linkKeys(keys);
    } catch (err) {
      console.warn(`  ! link phase failed (${err.message}) — page data is upserted; linking will catch up later`);
    }

    progress.totalInserted += rows.length;
    progress.totalLinked += linkedNow;
    const maxDate = records.reduce((max, r) => r.created_date > max ? r.created_date : max, progress.cursor);
    progress.cursor = maxDate;
    saveProgress(progress);

    pagesFetched++;
    const elapsed = (Date.now() - startedAt) / 1000;
    const rate = Math.round(progress.totalInserted / Math.max(1, elapsed));
    console.log(
      `[page ${pagesFetched}] +${rows.length} (${((tUp - tFetch) / 1000).toFixed(1)}s fetch, ${((tL - tUp) / 1000).toFixed(1)}s upsert, ${((Date.now() - tL) / 1000).toFixed(1)}s link) | +${linkedNow} linked | cursor=${maxDate.slice(0, 10)} | total=${progress.totalInserted.toLocaleString()} linked=${progress.totalLinked.toLocaleString()} (${rate}/s overall)`
    );

    if (records.length < PAGE_SIZE) {
      console.log("[done] last page was partial — caught up.");
      break;
    }
  }

  console.log(`\n[summary] inserted=${progress.totalInserted.toLocaleString()}, linked=${progress.totalLinked.toLocaleString()}`);
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});

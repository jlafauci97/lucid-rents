#!/usr/bin/env node
/**
 * Whitespace-tolerant relink driver for NYC 311.
 *
 * After the 7-year historical backfill, ~9.7M of 15.6M NYC 311 rows are
 * unlinked. A sample analysis (scripts/analyze-311-link-gap.mjs) found that
 * the dominant cause is whitespace padding in numbered cross-streets:
 *   "635 EAST  229 STREET"  (311, double space)
 *   "EAST 229 STREET"        (buildings, single space)
 * The exact-match join in link_311_nyc_bulk silently misses every one.
 *
 * This script drives the new relink_311_nyc_normalized_range RPC over the
 * full 7-year window in 1-day slices. The RPC normalizes whitespace and
 * alpha-strips house numbers before matching.
 *
 * Resumable: writes progress to scripts/.relink-311-nyc-normalized.progress.json
 * Run again to resume from where it stopped.
 *
 * Usage:
 *   node scripts/relink-311-nyc-normalized.mjs
 *   node scripts/relink-311-nyc-normalized.mjs --start=2019-04-22
 *   node scripts/relink-311-nyc-normalized.mjs --end=2026-04-26
 *   node scripts/relink-311-nyc-normalized.mjs --reset
 *   node scripts/relink-311-nyc-normalized.mjs --dryday=2025-06-01  # one window, no progress write
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config({ path: ".env.local" });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROGRESS_FILE = path.join(__dirname, ".relink-311-nyc-normalized.progress.json");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

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

const DEFAULT_START = "2019-04-22";
const DEFAULT_END = new Date().toISOString().slice(0, 10);
const START_DATE = (args.start || DEFAULT_START).slice(0, 10);
const END_DATE   = (args.end   || DEFAULT_END  ).slice(0, 10);

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------
function loadProgress() {
  if (!fs.existsSync(PROGRESS_FILE)) {
    return { cursor: START_DATE, totalProcessed: 0, totalLinked: 0 };
  }
  try { return JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf-8")); }
  catch { return { cursor: START_DATE, totalProcessed: 0, totalLinked: 0 }; }
}
function saveProgress(p) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2));
}

function nextDay(yyyymmdd) {
  const d = new Date(yyyymmdd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Transient-error helper (same shape as backfill script)
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

async function relinkWindow(startDate, endDate) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const { data, error } = await supabase.rpc("relink_311_nyc_normalized_range", {
      start_date: `${startDate}T00:00:00Z`,
      end_date:   `${endDate}T00:00:00Z`,
    });
    if (!error) {
      // RPC returns a TABLE → array with one row { processed, linked }.
      const row = Array.isArray(data) ? data[0] : data;
      return { processed: Number(row?.processed ?? 0), linked: Number(row?.linked ?? 0) };
    }
    if (isTransient(error)) {
      const backoff = Math.min(30_000, 2_000 * 2 ** attempt);
      console.warn(`  ! transient (${error.message}) — retry ${attempt + 1} in ${backoff}ms`);
      await new Promise((r) => setTimeout(r, backoff));
      continue;
    }
    console.error("  ! fatal RPC error:", error);
    throw new Error(error.message);
  }
  throw new Error("relinkWindow gave up after 8 retries");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  // Single-day dry run: useful sanity check before kicking off the full sweep.
  if (args.dryday) {
    const day = String(args.dryday).slice(0, 10);
    const next = nextDay(day);
    console.log(`[dryday] ${day} -> ${next}`);
    const { processed, linked } = await relinkWindow(day, next);
    console.log(`[dryday] processed=${processed}  linked=${linked}  (rate=${processed ? ((100 * linked) / processed).toFixed(1) : "0.0"}%)`);
    return;
  }

  const progress = loadProgress();
  console.log(`[start] cursor=${progress.cursor}  end=${END_DATE}  totalProcessed=${progress.totalProcessed.toLocaleString()}  totalLinked=${progress.totalLinked.toLocaleString()}`);

  let day = progress.cursor;
  const startedAt = Date.now();
  let windowsRun = 0;

  while (day < END_DATE) {
    const next = nextDay(day);
    const t0 = Date.now();
    let processed = 0;
    let linked = 0;
    try {
      ({ processed, linked } = await relinkWindow(day, next));
    } catch (err) {
      console.warn(`  ! window ${day} failed (${err.message}) — sleeping 60s and retrying`);
      await new Promise((r) => setTimeout(r, 60_000));
      continue; // do NOT advance cursor
    }

    progress.totalProcessed += processed;
    progress.totalLinked    += linked;
    progress.cursor = next;
    saveProgress(progress);

    windowsRun++;
    const elapsed = (Date.now() - startedAt) / 1000;
    const rate = (progress.totalLinked / Math.max(1, elapsed)).toFixed(0);
    const linkPct = processed ? ((100 * linked) / processed).toFixed(1) : "0.0";
    console.log(
      `[${day}] processed=${processed.toString().padStart(5)}  linked=${linked.toString().padStart(5)}  (${linkPct}%)  | ` +
      `${((Date.now() - t0) / 1000).toFixed(1)}s | ` +
      `total processed=${progress.totalProcessed.toLocaleString()}  linked=${progress.totalLinked.toLocaleString()}  ` +
      `(${rate} linked/s)`
    );

    day = next;
  }

  console.log(`\n[done] totalProcessed=${progress.totalProcessed.toLocaleString()}, totalLinked=${progress.totalLinked.toLocaleString()}, windowsRun=${windowsRun}`);
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});

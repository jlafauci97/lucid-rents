#!/usr/bin/env node
/**
 * Backfill building_rents with HUD FMR estimates for buildings that have no scraped rent data.
 *
 * Usage:
 *   node scripts/backfill-hud-fmr-rents.mjs
 *   node scripts/backfill-hud-fmr-rents.mjs --metro=nyc --limit=1000
 *   node scripts/backfill-hud-fmr-rents.mjs --dry-run
 *   node scripts/backfill-hud-fmr-rents.mjs --year=2025
 *   node scripts/backfill-hud-fmr-rents.mjs --reset
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

const PROGRESS_FILE = resolve(process.cwd(), "scripts/.hud-fmr-backfill-progress.json");

const env = {};
for (const envFile of [".env.local", ".env.production.local"]) {
  try {
    const envPath = resolve(process.cwd(), envFile);
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) {
        const key = m[1].trim();
        if (!env[key]) env[key] = m[2].trim().replace(/^"|"$/g, "").replace(/\\n/g, "");
      }
    }
  } catch { /* skip */ }
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const args = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => {
    const [k, v] = a.slice(2).split("=");
    return [k, v || "true"];
  })
);

const METRO = args.metro || null;
const LIMIT = parseInt(args.limit || "0", 10);
const DRY_RUN = args["dry-run"] === "true";
const FMR_YEAR = parseInt(args.year || "0", 10);
const BATCH_SIZE = parseInt(args.batch || "500", 10);
const RESET = args.reset === "true";
const RANGE_LOW_FACTOR = 0.85;
const RANGE_HIGH_FACTOR = 1.15;

function loadProgress() {
  if (RESET) return null;
  try {
    if (existsSync(PROGRESS_FILE)) {
      const raw = readFileSync(PROGRESS_FILE, "utf8").trim();
      if (!raw) return null;
      const data = JSON.parse(raw);
      if ((data.metro || null) === METRO) return data;
    }
  } catch { /* corrupted, start fresh */ }
  return null;
}

function saveProgress(state) {
  if (DRY_RUN) return;
  writeFileSync(PROGRESS_FILE, JSON.stringify({ ...state, metro: METRO }, null, 2));
}

function clearProgress() {
  try { if (existsSync(PROGRESS_FILE)) writeFileSync(PROGRESS_FILE, ""); } catch {}
}

async function getLatestFmrYear() {
  const { data, error } = await supabase.from("hud_fmr").select("fiscal_year").order("fiscal_year", { ascending: false }).limit(1).single();
  if (error || !data) { console.error("No HUD FMR data found. Run import-hud-fmr.mjs first."); process.exit(1); }
  return data.fiscal_year;
}

async function loadFmrByZip(year) {
  const fmrMap = new Map();
  let from = 0;
  while (true) {
    const { data, error } = await supabase.from("hud_fmr").select("zip_code, fmr_0br, fmr_1br, fmr_2br, fmr_3br, fmr_4br").eq("fiscal_year", year).range(from, from + 999);
    if (error) { console.error("Error loading FMR:", error.message); process.exit(1); }
    for (const row of data) fmrMap.set(row.zip_code, row);
    if (data.length < 1000) break;
    from += 1000;
  }
  return fmrMap;
}

async function fetchBuildingsWithoutRealRents(cursor, batchSize) {
  let query = supabase.from("buildings").select("id, zip_code").not("zip_code", "is", null).order("id", { ascending: true }).limit(batchSize);
  if (cursor) query = query.gt("id", cursor);
  if (METRO) query = query.eq("metro", METRO);

  const { data: buildings, error } = await query;
  if (error) { console.error("Error fetching buildings:", error.message); return { buildings: [], rawCount: 0, allBuildings: [], error: true }; }
  if (!buildings || buildings.length === 0) return { buildings: [], rawCount: 0, allBuildings: [], error: false };

  const hasRealRents = new Set();
  const ids = buildings.map((b) => b.id);
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const { data: existing, error: rentError } = await supabase.from("building_rents").select("building_id, source").in("building_id", chunk).neq("source", "hud_fmr");
    if (rentError) { for (const id of chunk) hasRealRents.add(id); continue; }
    for (const r of existing || []) hasRealRents.add(r.building_id);
  }

  return { buildings: buildings.filter((b) => !hasRealRents.has(b.id)), rawCount: buildings.length, allBuildings: buildings, error: false };
}

function buildRentRows(buildingId, fmr) {
  const rows = [];
  for (const [bed, val] of [[0, fmr.fmr_0br], [1, fmr.fmr_1br], [2, fmr.fmr_2br], [3, fmr.fmr_3br], [4, fmr.fmr_4br]]) {
    if (!val || val <= 0) continue;
    rows.push({ building_id: buildingId, source: "hud_fmr", bedrooms: bed, min_rent: Math.round(val * RANGE_LOW_FACTOR), max_rent: Math.round(val * RANGE_HIGH_FACTOR), median_rent: val, listing_count: 0 });
  }
  return rows;
}

async function main() {
  const year = FMR_YEAR || (await getLatestFmrYear());
  console.log(`Using HUD FMR data for FY${year}`);
  console.log(`Range: FMR x ${RANGE_LOW_FACTOR} - FMR x ${RANGE_HIGH_FACTOR}`);
  if (METRO) console.log(`Filtering to metro: ${METRO}`);
  if (LIMIT > 0) console.log(`Limit: ${LIMIT} buildings`);
  if (DRY_RUN) console.log("[DRY RUN MODE]");

  const fmrMap = await loadFmrByZip(year);
  console.log(`Loaded FMR data for ${fmrMap.size} ZIP codes`);

  const saved = loadProgress();
  let cursor = saved?.cursor || null;
  let totalScanned = saved?.totalScanned || 0;
  let totalProcessed = saved?.totalProcessed || 0;
  let totalInserted = saved?.totalInserted || 0;
  let totalSkippedNoFmr = saved?.totalSkippedNoFmr || 0;
  let totalSkippedHasRents = saved?.totalSkippedHasRents || 0;
  if (saved) console.log(`Resuming from saved progress: cursor=${cursor}, ${totalProcessed} buildings already processed`);

  let stoppedByError = false;
  while (true) {
    if (LIMIT > 0 && totalProcessed >= LIMIT) break;
    const { buildings, rawCount, allBuildings, error: fetchError } = await fetchBuildingsWithoutRealRents(cursor, BATCH_SIZE);
    if (fetchError) { saveProgress({ cursor, totalScanned, totalProcessed, totalInserted, totalSkippedNoFmr, totalSkippedHasRents }); console.error("Stopping due to error. Progress saved - re-run to resume."); stoppedByError = true; break; }
    if (rawCount === 0) break;

    cursor = allBuildings[allBuildings.length - 1].id;
    totalScanned += rawCount;
    totalSkippedHasRents += rawCount - buildings.length;

    const eligible = LIMIT > 0 ? buildings.slice(0, LIMIT - totalProcessed) : buildings;
    const allRows = [];
    for (const b of eligible) {
      const fmr = fmrMap.get(b.zip_code);
      if (!fmr) { totalSkippedNoFmr++; continue; }
      allRows.push(...buildRentRows(b.id, fmr));
    }

    if (allRows.length > 0 && !DRY_RUN) {
      for (let i = 0; i < allRows.length; i += 1000) {
        const chunk = allRows.slice(i, i + 1000);
        const { error } = await supabase.from("building_rents").upsert(chunk, { onConflict: "building_id,source,bedrooms" });
        if (error) console.error(`Upsert error:`, error.message);
      }
    }

    totalProcessed += eligible.length;
    totalInserted += allRows.length;
    saveProgress({ cursor, totalScanned, totalProcessed, totalInserted, totalSkippedNoFmr, totalSkippedHasRents });
    console.log(`Scanned ${totalScanned} buildings -> ${totalProcessed} eligible, ${totalInserted} rent rows inserted, ${totalSkippedHasRents} skipped (have real rents), ${totalSkippedNoFmr} skipped (no FMR for ZIP)`);
  }

  if (!stoppedByError) clearProgress();
  console.log("\nDone!");
  console.log(`  Buildings scanned: ${totalScanned}`);
  console.log(`  Buildings eligible (no real rent data): ${totalProcessed}`);
  console.log(`  Rent rows ${DRY_RUN ? "would be " : ""}inserted: ${totalInserted}`);
  console.log(`  Skipped (already have real rent data): ${totalSkippedHasRents}`);
  console.log(`  Skipped (no FMR data for ZIP): ${totalSkippedNoFmr}`);
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });

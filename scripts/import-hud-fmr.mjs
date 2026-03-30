#!/usr/bin/env node
/**
 * Import HUD Small Area Fair Market Rents (SAFMRs) from Excel into the hud_fmr table.
 *
 * Usage:
 *   node scripts/import-hud-fmr.mjs --file=fy2025_safmrs.xlsx --year=2025
 *   node scripts/import-hud-fmr.mjs --file=fy2025_safmrs.xlsx --year=2025 --dry-run
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import XLSX from "xlsx";

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

const FILE_PATH = args.file;
const FISCAL_YEAR = parseInt(args.year, 10);
const DRY_RUN = args["dry-run"] === "true";
const BATCH_SIZE = parseInt(args.batch || "500", 10);

if (!FILE_PATH || !FISCAL_YEAR) {
  console.error("Usage: node scripts/import-hud-fmr.mjs --file=<path.xlsx> --year=<YYYY> [--dry-run]");
  process.exit(1);
}

function normalizeHeader(h) {
  return (h || "").toString().toLowerCase().replace(/\s+/g, " ").trim();
}

function findColumn(headers, patterns) {
  const normalized = headers.map(normalizeHeader);
  for (const pat of patterns) {
    const idx = normalized.findIndex((h) => h.includes(pat));
    if (idx >= 0) return headers[idx];
  }
  return null;
}

function findExactSafmr(headers, brLabel) {
  const normalized = headers.map(normalizeHeader);
  const idx = normalized.findIndex((h) => {
    if (!h.includes("safmr") || !h.includes(brLabel)) return false;
    if (h.includes("90%") || h.includes("110%") || h.includes("payment")) return false;
    return true;
  });
  return idx >= 0 ? headers[idx] : null;
}

async function main() {
  console.log(`Reading ${FILE_PATH}...`);
  const workbook = XLSX.readFile(resolve(process.cwd(), FILE_PATH));
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
  if (rows.length === 0) { console.error("No rows found"); process.exit(1); }

  const headers = Object.keys(rows[0]);
  const zipCol = findColumn(headers, ["zip code", "zip_code", "zipcode", "zip"]);
  const fmr0Col = findExactSafmr(headers, "0br");
  const fmr1Col = findExactSafmr(headers, "1br");
  const fmr2Col = findExactSafmr(headers, "2br");
  const fmr3Col = findExactSafmr(headers, "3br");
  const fmr4Col = findExactSafmr(headers, "4br");

  if (!zipCol || !fmr2Col) {
    console.error("Could not find required columns. Headers:", headers.map(normalizeHeader).join(", "));
    process.exit(1);
  }
  console.log(`Detected columns: zip=${zipCol}, 0br=${fmr0Col}, 1br=${fmr1Col}, 2br=${fmr2Col}, 3br=${fmr3Col}, 4br=${fmr4Col}`);

  const recordMap = new Map();
  let skipped = 0, dupes = 0;
  for (const row of rows) {
    const zip = (row[zipCol] || "").toString().trim().padStart(5, "0").slice(0, 5);
    if (!/^\d{5}$/.test(zip)) { skipped++; continue; }
    if (recordMap.has(zip)) { dupes++; continue; }
    recordMap.set(zip, {
      zip_code: zip, fiscal_year: FISCAL_YEAR,
      fmr_0br: fmr0Col ? parseInt(row[fmr0Col], 10) || null : null,
      fmr_1br: fmr1Col ? parseInt(row[fmr1Col], 10) || null : null,
      fmr_2br: fmr2Col ? parseInt(row[fmr2Col], 10) || null : null,
      fmr_3br: fmr3Col ? parseInt(row[fmr3Col], 10) || null : null,
      fmr_4br: fmr4Col ? parseInt(row[fmr4Col], 10) || null : null,
    });
  }
  const records = [...recordMap.values()];
  console.log(`Parsed ${records.length} unique ZIP records (skipped ${skipped} invalid, ${dupes} duplicate)`);

  if (DRY_RUN) { console.log("[DRY RUN]", records.slice(0, 3)); return; }

  let upserted = 0;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("hud_fmr").upsert(batch, { onConflict: "zip_code,fiscal_year" });
    if (error) { console.error(`Error at batch ${i}:`, error.message); continue; }
    upserted += batch.length;
    if (upserted % 2000 === 0 || i + BATCH_SIZE >= records.length) console.log(`Upserted ${upserted}/${records.length}`);
  }
  console.log(`Done. Imported ${upserted} HUD FMR records for FY${FISCAL_YEAR}.`);
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });

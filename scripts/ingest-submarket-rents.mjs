#!/usr/bin/env node
/**
 * Ingest quarterly submarket rent trends from an XLSX export into:
 *   - submarkets               (submarket definitions)
 *   - zip_submarkets           (zip -> submarket crosswalk)
 *   - submarket_rent_history   (long-format rent observations)
 *
 * Usage:
 *   node scripts/ingest-submarket-rents.mjs <path-to-xlsx>
 *   node scripts/ingest-submarket-rents.mjs <path-to-xlsx> --dry-run
 *
 * The crosswalk TS files under src/lib/submarkets/ must already list the
 * submarket slugs used here (the script auto-exits if any referenced slug
 * isn't found in the XLSX).
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import XLSX from "xlsx";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── ENV ────────────────────────────────────────────────────────────────────
const env = {};
for (const envFile of [".env.local", ".env.production.local"]) {
  try {
    const p = resolve(__dirname, "..", envFile);
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m && !env[m[1].trim()]) env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, "");
    }
  } catch { /* skip */ }
}
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

// ── CLI ────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const xlsxPath = args.find((a) => !a.startsWith("--"));
if (!xlsxPath) {
  console.error("Usage: node scripts/ingest-submarket-rents.mjs <path-to-xlsx> [--dry-run]");
  process.exit(1);
}

// ── Geography → city mapping ───────────────────────────────────────────────
// Upstream XLSX uses "<City> - <State> USA - <Submarket>"; we normalize city.
const CITY_BY_PREFIX = {
  "New York": "nyc",
  "Chicago": "chicago",
  "Los Angeles": "los-angeles",
  "Houston": "houston",
  "Miami": "miami",
};

// ── Concept row → (beds, rent_type) ────────────────────────────────────────
const CONCEPT_MAP = {
  "Market Asking Rent/Unit": { beds: "all", rent_type: "asking" },
  "Market Asking Rent/Unit Studio": { beds: "studio", rent_type: "asking" },
  "Market Asking Rent/Unit 1 Bedroom": { beds: "1br", rent_type: "asking" },
  "Market Asking Rent/Unit 2 Bedroom": { beds: "2br", rent_type: "asking" },
  "Market Asking Rent/Unit 3 Bedroom": { beds: "3br", rent_type: "asking" },
  "Market Effective Rent/Unit Studio": { beds: "studio", rent_type: "effective" },
  "Market Effective Rent/Unit 1 Bedroom": { beds: "1br", rent_type: "effective" },
  "Market Effective Rent/Unit 2 Bedroom": { beds: "2br", rent_type: "effective" },
  "Market Effective Rent/Unit 3 Bedroom": { beds: "3br", rent_type: "effective" },
};

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[\/]/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseQuarterHeader(h) {
  // "2024 Q3" → Date 2024-07-01 UTC
  const m = /^(\d{4})\s*Q([1-4])$/.exec(h);
  if (!m) return null;
  const year = Number(m[1]);
  const q = Number(m[2]);
  const month = (q - 1) * 3 + 1; // Q1→1, Q2→4, Q3→7, Q4→10
  return new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10);
}

// ── Load XLSX ──────────────────────────────────────────────────────────────
console.log(`Reading ${xlsxPath}`);
const wb = XLSX.readFile(xlsxPath);
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
if (!rows.length) {
  console.error("Empty sheet");
  process.exit(1);
}

const header = rows[0];
const quarterCols = []; // [{ colIdx, quarter }]
for (let i = 5; i < header.length; i++) {
  const q = parseQuarterHeader(String(header[i] ?? ""));
  if (q) quarterCols.push({ colIdx: i, quarter: q });
}
console.log(`  ${rows.length - 1} data rows, ${quarterCols.length} quarterly columns`);

// ── Parse rows → (city, submarket_slug, submarket_name, beds, rent_type, quarter→value) ──
const submarketByKey = new Map(); // key = "<city>|<slug>" → { city, slug, name }
const observations = []; // { citySlug, subSlug, quarter, beds, rent_type, rent }

for (let r = 1; r < rows.length; r++) {
  const row = rows[r];
  const geo = String(row[3] ?? "").trim();
  const concept = String(row[4] ?? "").trim();
  if (!geo || !concept) continue;

  const parts = geo.split(" - ");
  const cityPrefix = parts[0]?.trim();
  const subName = parts[parts.length - 1]?.trim();
  const citySlug = CITY_BY_PREFIX[cityPrefix];
  if (!citySlug) {
    // Unknown city — skip silently (data set only has our 5)
    continue;
  }
  const conceptInfo = CONCEPT_MAP[concept];
  if (!conceptInfo) continue;

  const subSlug = slugify(subName);
  const key = `${citySlug}|${subSlug}`;
  if (!submarketByKey.has(key)) {
    submarketByKey.set(key, { city: citySlug, slug: subSlug, name: subName });
  }

  for (const { colIdx, quarter } of quarterCols) {
    const val = row[colIdx];
    if (val == null || val === "") continue;
    const num = typeof val === "number" ? val : Number(val);
    if (!Number.isFinite(num)) continue;
    observations.push({
      citySlug,
      subSlug,
      quarter,
      beds: conceptInfo.beds,
      rent_type: conceptInfo.rent_type,
      rent: Math.round(num * 100) / 100,
    });
  }
}

console.log(
  `Parsed ${submarketByKey.size} submarkets, ${observations.length} rent observations.`,
);

// ── Validate crosswalk slugs against ingested submarkets ───────────────────
async function loadCrosswalks() {
  // Dynamic import of ESM-compatible TS? The crosswalks are TS; read raw and parse.
  // Simpler: dynamically import via tsx OR just read the TS file and regex the slugs.
  const files = {
    nyc: "src/lib/submarkets/nyc-zip-submarkets.ts",
    chicago: "src/lib/submarkets/chicago-zip-submarkets.ts",
    "los-angeles": "src/lib/submarkets/la-zip-submarkets.ts",
    houston: "src/lib/submarkets/houston-zip-submarkets.ts",
    miami: "src/lib/submarkets/miami-zip-submarkets.ts",
  };
  const out = {};
  for (const [citySlug, rel] of Object.entries(files)) {
    const txt = readFileSync(resolve(__dirname, "..", rel), "utf8");
    const re = /"(\d{5})":\s*"([a-z0-9-]+)"/g;
    const map = {};
    let m;
    while ((m = re.exec(txt))) map[m[1]] = m[2];
    out[citySlug] = map;
  }
  return out;
}

const crosswalks = await loadCrosswalks();
const ingestedSlugsByCity = {};
for (const { city, slug } of submarketByKey.values()) {
  (ingestedSlugsByCity[city] ??= new Set()).add(slug);
}
let bad = 0;
for (const [citySlug, map] of Object.entries(crosswalks)) {
  const have = ingestedSlugsByCity[citySlug] ?? new Set();
  const missing = new Set();
  for (const subSlug of Object.values(map)) {
    if (!have.has(subSlug)) missing.add(subSlug);
  }
  if (missing.size) {
    console.warn(`  ${citySlug}: ${missing.size} crosswalk slugs not in data: ${[...missing].join(", ")}`);
    bad += missing.size;
  }
}
if (bad) {
  console.warn(
    `WARNING: ${bad} crosswalk slugs don't exist in the rent data. Affected zips will have no rent history.`,
  );
}

if (DRY_RUN) {
  console.log("DRY RUN — no writes.");
  // Print a sample
  console.log("Sample submarkets:");
  [...submarketByKey.values()].slice(0, 5).forEach((s) => console.log(`  ${s.city} | ${s.slug} | ${s.name}`));
  console.log("Sample observations:");
  observations.slice(0, 5).forEach((o) => console.log(`  ${o.citySlug} ${o.subSlug} ${o.quarter} ${o.beds} ${o.rent_type} $${o.rent}`));
  process.exit(0);
}

// ── Write to Supabase ──────────────────────────────────────────────────────
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// 1. Upsert submarkets
const subList = [...submarketByKey.values()];
console.log(`Upserting ${subList.length} submarkets…`);
{
  const { error } = await sb.from("submarkets").upsert(subList, {
    onConflict: "city,slug",
    ignoreDuplicates: false,
  });
  if (error) { console.error(error); process.exit(1); }
}

// Re-fetch to get ids
const { data: idRows, error: selErr } = await sb
  .from("submarkets")
  .select("id, city, slug");
if (selErr) { console.error(selErr); process.exit(1); }
const idByKey = new Map(idRows.map((r) => [`${r.city}|${r.slug}`, r.id]));

// 2. Upsert zip_submarkets
const zipRows = [];
for (const [citySlug, map] of Object.entries(crosswalks)) {
  for (const [zip, subSlug] of Object.entries(map)) {
    const id = idByKey.get(`${citySlug}|${subSlug}`);
    if (!id) continue;
    zipRows.push({ zip, city: citySlug, submarket_id: id });
  }
}
console.log(`Upserting ${zipRows.length} zip→submarket rows…`);
for (let i = 0; i < zipRows.length; i += 500) {
  const batch = zipRows.slice(i, i + 500);
  const { error } = await sb.from("zip_submarkets").upsert(batch, {
    onConflict: "zip",
    ignoreDuplicates: false,
  });
  if (error) { console.error(error); process.exit(1); }
}

// 3. Bulk upsert observations
console.log(`Upserting ${observations.length} rent observations…`);
const histRows = observations.map((o) => ({
  submarket_id: idByKey.get(`${o.citySlug}|${o.subSlug}`),
  quarter: o.quarter,
  beds: o.beds,
  rent_type: o.rent_type,
  rent_per_unit: o.rent,
})).filter((r) => r.submarket_id);

let done = 0;
for (let i = 0; i < histRows.length; i += 1000) {
  const batch = histRows.slice(i, i + 1000);
  const { error } = await sb.from("submarket_rent_history").upsert(batch, {
    onConflict: "submarket_id,quarter,beds,rent_type",
    ignoreDuplicates: false,
  });
  if (error) { console.error(error); process.exit(1); }
  done += batch.length;
  process.stdout.write(`\r  ${done} / ${histRows.length}`);
}
console.log("\nDone.");

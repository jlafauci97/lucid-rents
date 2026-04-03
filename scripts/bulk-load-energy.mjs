#!/usr/bin/env node
/**
 * One-time bulk load of NYC LL84 Energy Benchmarking data.
 * Filters to Multifamily Housing and Mixed Use Property only.
 * Runs locally (no 60s Vercel timeout).
 *
 * Usage: node --env-file=.env.local scripts/bulk-load-energy.mjs
 *
 * Requires env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const SODA_BASE = "https://data.cityofnewyork.us/resource";
const DATASET = "5zyy-y8am";
const PAGE_SIZE = 5000;
const BATCH_SIZE = 500;

const BOROUGH_MAP = {
  MANHATTAN: "Manhattan",
  BRONX: "Bronx",
  BROOKLYN: "Brooklyn",
  QUEENS: "Queens",
  "STATEN ISLAND": "Staten Island",
};

function parseNum(val) {
  if (val == null || val === "" || val === "Not Available" || val === "N/A") return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

function parseInt2(val) {
  if (val == null || val === "" || val === "Not Available" || val === "N/A") return null;
  const n = parseInt(val, 10);
  return isNaN(n) ? null : n;
}

function extractYear(yearEnding) {
  if (!yearEnding) return null;
  // Format is "2024-12-31T00:00:00.000" or "2024"
  const match = yearEnding.match(/^(\d{4})/);
  return match ? parseInt(match[1], 10) : null;
}

function normalizeBbl(bbl) {
  if (!bbl) return null;
  // Remove any hyphens or spaces, ensure 10 digits
  const cleaned = bbl.replace(/[-\s]/g, "");
  return /^\d{10}$/.test(cleaned) ? cleaned : null;
}

function buildUrl(where, limit, offset) {
  const params = new URLSearchParams({
    $where: where,
    $limit: String(limit),
    $offset: String(offset),
    $order: "report_year ASC, property_id ASC",
  });
  return `${SODA_BASE}/${DATASET}.json?${params}`;
}

function transformRecord(r) {
  if (!r.property_id) return null;

  const reportYear = parseInt2(r.report_year) || extractYear(r.year_ending);
  if (!reportYear) return null;

  const borough = r.borough ? (BOROUGH_MAP[r.borough.toUpperCase()] || r.borough) : null;

  return {
    property_id: String(r.property_id).slice(0, 20),
    property_name: r.property_name ? String(r.property_name).slice(0, 300) : null,
    property_type: r.primary_property_type_self ? String(r.primary_property_type_self).slice(0, 100) : null,
    report_year: reportYear,
    bbl: normalizeBbl(r.nyc_borough_block_and_lot),
    address: r.address_1 ? String(r.address_1).slice(0, 300) : null,
    borough: borough ? borough.slice(0, 20) : null,
    zip_code: r.postal_code ? r.postal_code.slice(0, 10) : null,
    energy_star_score: parseInt2(r.energy_star_score),
    site_eui: parseNum(r.site_eui_kbtu_ft),
    weather_normalized_eui: parseNum(r.weather_normalized_site_eui),
    total_ghg_emissions: parseNum(r.total_location_based_ghg),
    electricity_use: parseNum(r.electricity_use_grid_purchase),
    natural_gas_use: parseNum(r.natural_gas_use_kbtu),
    water_use: parseNum(r.water_use_all_water_sources),
    year_built: parseInt2(r.year_built),
    number_of_buildings: parseInt2(r.number_of_buildings),
    property_gfa: parseNum(r.property_gfa_self_reported),
  };
}

async function upsertBatch(rows) {
  const { error, count } = await supabase
    .from("energy_benchmarks")
    .upsert(rows, { onConflict: "property_id,report_year", ignoreDuplicates: false, count: "exact" });
  if (error) throw new Error(`Upsert error: ${error.message}`);
  return count || rows.length;
}

async function main() {
  const filter = "primary_property_type_self in ('Multifamily Housing','Mixed Use Property') AND property_id IS NOT NULL";
  let offset = 0;
  let totalInserted = 0;
  let pageNum = 0;

  console.log("Starting bulk load of LL84 Energy Benchmarking data (multifamily + mixed use only)...");
  const startTime = Date.now();

  while (true) {
    const url = buildUrl(filter, PAGE_SIZE, offset);
    console.log(`Fetching page ${pageNum} (offset ${offset})...`);

    const res = await fetch(url);
    if (!res.ok) {
      console.error(`API error: ${res.status} ${await res.text()}`);
      break;
    }

    const records = await res.json();
    console.log(`  Got ${records.length} records`);

    if (records.length === 0) break;

    const allRows = records.map(transformRecord).filter(Boolean);
    // Deduplicate by property_id+report_year within page
    const seen = new Map();
    for (const row of allRows) seen.set(`${row.property_id}_${row.report_year}`, row);
    const rows = [...seen.values()];

    // Upsert in batches
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const count = await upsertBatch(batch);
      totalInserted += count;
      process.stdout.write(`  Upserted batch ${Math.floor(i / BATCH_SIZE) + 1} (${count} rows, total: ${totalInserted})\r`);
    }
    console.log();

    if (records.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
    pageNum++;
  }

  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\nDone! Total rows upserted: ${totalInserted} in ${elapsed} minutes`);

  // Link to buildings by BBL
  console.log("Linking energy benchmarks to buildings by BBL...");
  const { error: linkError } = await supabase.rpc("exec_sql", {
    query: `
      UPDATE energy_benchmarks e
      SET building_id = b.id
      FROM buildings b
      WHERE e.bbl = b.bbl
        AND e.bbl IS NOT NULL
        AND e.building_id IS NULL
    `,
  });
  if (linkError) {
    console.log("Could not link via RPC. Run this SQL in Supabase:");
    console.log("  UPDATE energy_benchmarks e SET building_id = b.id FROM buildings b WHERE e.bbl = b.bbl AND e.bbl IS NOT NULL AND e.building_id IS NULL;");
  } else {
    console.log("Linked energy benchmarks to buildings");
  }

  // Update building energy_star_score from latest year
  console.log("Updating buildings.energy_star_score...");
  const { error: scoreError } = await supabase.rpc("exec_sql", {
    query: `
      UPDATE buildings b
      SET energy_star_score = sub.energy_star_score
      FROM (
        SELECT DISTINCT ON (building_id)
          building_id, energy_star_score
        FROM energy_benchmarks
        WHERE building_id IS NOT NULL AND energy_star_score IS NOT NULL
        ORDER BY building_id, report_year DESC
      ) sub
      WHERE b.id = sub.building_id
    `,
  });
  if (scoreError) {
    console.log("Could not update scores via RPC. Run this SQL in Supabase:");
    console.log("  UPDATE buildings b SET energy_star_score = sub.energy_star_score FROM (SELECT DISTINCT ON (building_id) building_id, energy_star_score FROM energy_benchmarks WHERE building_id IS NOT NULL AND energy_star_score IS NOT NULL ORDER BY building_id, report_year DESC) sub WHERE b.id = sub.building_id;");
  } else {
    console.log("Building energy scores updated");
  }

  console.log("Bulk load complete!");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

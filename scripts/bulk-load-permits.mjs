#!/usr/bin/env node
/**
 * One-time bulk load of ALL DOB permits from NYC Open Data.
 * Runs locally (no 60s Vercel timeout).
 *
 * Usage: node --env-file=.env.local scripts/bulk-load-permits.mjs
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
const DATASET = "rbx6-tga4";
const PAGE_SIZE = 5000;
const BATCH_SIZE = 500;

const BOROUGH_TO_CODE = {
  MANHATTAN: "1",
  BRONX: "2",
  BROOKLYN: "3",
  QUEENS: "4",
  "STATEN ISLAND": "5",
};

function parseDate(d) {
  if (!d) return null;
  const iso = d.includes("T") ? d.split("T")[0] : d;
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
}

function buildUrl(where, limit, offset) {
  const params = new URLSearchParams({
    $where: where,
    $limit: String(limit),
    $offset: String(offset),
    $order: "issued_date ASC",
  });
  return `${SODA_BASE}/${DATASET}.json?${params}`;
}

function transformRecord(r) {
  if (!r.work_permit) return null;
  const boroCode = r.borough ? BOROUGH_TO_CODE[r.borough.toUpperCase()] : null;
  const block = r.block ? r.block.padStart(5, "0") : null;
  const lot = r.lot ? r.lot.padStart(4, "0").slice(-4) : null;
  const bbl = boroCode && block && lot ? `${boroCode}${block}${lot}` : null;

  return {
    work_permit: String(r.work_permit),
    house_no: r.house_no || null,
    street_name: r.street_name || null,
    borough: r.borough || null,
    zip_code: r.zip_code || null,
    bin: r.bin__ || null,
    block: r.block || null,
    lot: r.lot || null,
    bbl,
    work_type: r.work_type || null,
    permit_status: r.permit_status || null,
    filing_reason: r.filing_reason || null,
    issued_date: parseDate(r.issued_date),
    expired_date: parseDate(r.expired_date),
    job_description: r.job_description || null,
    estimated_job_costs: r.estimated_job_costs ? parseFloat(r.estimated_job_costs) : null,
    owner_business_name: r.owner_s_business_name || null,
    permittee_business_name: r.permittee_s_business_name || null,
    latitude: r.latitude ? parseFloat(r.latitude) : null,
    longitude: r.longitude ? parseFloat(r.longitude) : null,
  };
}

async function upsertBatch(rows) {
  const { error, count } = await supabase
    .from("dob_permits")
    .upsert(rows, { onConflict: "work_permit", ignoreDuplicates: false, count: "exact" });
  if (error) throw new Error(`Upsert error: ${error.message}`);
  return count || rows.length;
}

async function main() {
  // Load ALL permits (no work_type filter), skip unissued
  const filter = "work_permit IS NOT NULL AND permit_status != 'Permit is not yet issued'";
  let offset = 0;
  let totalInserted = 0;
  let pageNum = 0;

  console.log("Starting bulk load of DOB permits (~904K records)...");
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
    // Deduplicate by work_permit within page
    const seen = new Map();
    for (const row of allRows) seen.set(row.work_permit, row);
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
  console.log("Linking permits to buildings by BBL...");
  const { error: linkError, count: linkCount } = await supabase.rpc("exec_sql", {
    query: `
      UPDATE dob_permits p
      SET building_id = b.id
      FROM buildings b
      WHERE p.bbl = b.bbl
        AND p.bbl IS NOT NULL
        AND p.building_id IS NULL
    `,
  });
  if (linkError) {
    console.log("Could not link via RPC. Run this SQL in Supabase:");
    console.log("  UPDATE dob_permits p SET building_id = b.id FROM buildings b WHERE p.bbl = b.bbl AND p.bbl IS NOT NULL AND p.building_id IS NULL;");
  } else {
    console.log(`Linked ${linkCount || "?"} permits to buildings`);
  }

  // Update building permit counts
  console.log("Updating building permit counts...");
  const { error: countError } = await supabase.rpc("exec_sql", {
    query: `
      UPDATE buildings b
      SET permit_count = sub.cnt
      FROM (
        SELECT building_id, COUNT(*) AS cnt
        FROM dob_permits
        WHERE building_id IS NOT NULL
        GROUP BY building_id
      ) sub
      WHERE b.id = sub.building_id
    `,
  });
  if (countError) {
    console.log("Could not update counts via RPC. Run this SQL in Supabase:");
    console.log("  UPDATE buildings b SET permit_count = sub.cnt FROM (SELECT building_id, COUNT(*) cnt FROM dob_permits WHERE building_id IS NOT NULL GROUP BY building_id) sub WHERE b.id = sub.building_id;");
  } else {
    console.log("Building permit counts updated");
  }

  console.log("Bulk load complete!");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

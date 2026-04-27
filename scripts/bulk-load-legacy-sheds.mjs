#!/usr/bin/env node
/**
 * Bulk load legacy DOB BIS sidewalk shed permits (1989-present).
 * Source: NYC Open Data DOB Permit Issuance dataset (ipu4-2q9a) where permit_subtype='SH'.
 *
 * The newer DOB NOW dataset (rbx6-tga4) is loaded by bulk-load-sheds.mjs.
 * This script loads the legacy/historical permits going back to June 1989.
 *
 * Each legacy permit_si_no is namespaced with an "L-" prefix when stored in
 * sidewalk_sheds.work_permit so it can never collide with a DOB NOW work_permit.
 *
 * Usage: node --env-file=.env.local scripts/bulk-load-legacy-sheds.mjs
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
const DATASET = "ipu4-2q9a";
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
  if (d.includes("T")) return d.split("T")[0];
  const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[1]}-${m[2]}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

function buildUrl(where, limit, offset) {
  const params = new URLSearchParams({
    $where: where,
    $limit: String(limit),
    $offset: String(offset),
    $order: "issuance_date ASC",
  });
  return `${SODA_BASE}/${DATASET}.json?${params}`;
}

function transformRecord(r) {
  if (!r.permit_si_no) return null;
  const boroCode = r.borough ? BOROUGH_TO_CODE[r.borough.toUpperCase()] : null;
  const block = r.block ? r.block.padStart(5, "0") : null;
  const lot = r.lot ? r.lot.padStart(4, "0").slice(-4) : null;
  const bbl = boroCode && block && lot ? `${boroCode}${block}${lot}` : null;

  const streetName = r.street_name ? r.street_name.replace(/\s+/g, " ").trim() : null;

  return {
    work_permit: `L-${r.permit_si_no}`,
    house_no: r.house__ || null,
    street_name: streetName,
    borough: r.borough || null,
    zip_code: r.zip_code || null,
    bin: r.bin__ || null,
    block: r.block || null,
    lot: r.lot || null,
    bbl,
    permit_status: r.permit_status || null,
    filing_reason: r.filing_status || null,
    issued_date: parseDate(r.issuance_date),
    expired_date: parseDate(r.expiration_date),
    job_description: null,
    estimated_job_costs: null,
    owner_business_name: r.owner_s_business_name || null,
    permittee_business_name: r.permittee_s_business_name || null,
    source: "legacy",
  };
}

async function upsertBatch(rows) {
  const { error, count } = await supabase
    .from("sidewalk_sheds")
    .upsert(rows, { onConflict: "work_permit", ignoreDuplicates: false, count: "exact" });
  if (error) throw new Error(`Upsert error: ${error.message}`);
  return count || rows.length;
}

async function main() {
  const filter = "permit_subtype='SH'";
  let offset = 0;
  let totalInserted = 0;
  let pageNum = 0;
  const startedAt = Date.now();

  console.log(`Starting legacy DOB sidewalk shed load (dataset ${DATASET}, permit_subtype=SH)...`);

  while (true) {
    const url = buildUrl(filter, PAGE_SIZE, offset);
    console.log(`Page ${pageNum} (offset ${offset})...`);

    const res = await fetch(url);
    if (!res.ok) {
      console.error(`API error: ${res.status} ${await res.text()}`);
      break;
    }

    const records = await res.json();
    if (records.length === 0) break;

    const allRows = records.map(transformRecord).filter(Boolean);
    const seen = new Map();
    for (const row of allRows) seen.set(row.work_permit, row);
    const rows = [...seen.values()];

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const count = await upsertBatch(batch);
      totalInserted += count;
    }
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(`  +${rows.length} (total: ${totalInserted}, elapsed: ${elapsed}s)`);

    if (records.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
    pageNum++;
  }

  const totalElapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\nDone. Inserted/upserted ${totalInserted} legacy permits in ${totalElapsed}s.`);
  console.log("Note: BBL→building_id linking is best run as a server-side batch job.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

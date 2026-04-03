#!/usr/bin/env node
/**
 * LAPD Crime Data Backfill Script
 * Loads 2 years of crime data from LA Open Data (endpoint: 2nrs-mtv8)
 * into the nypd_complaints table with metro='los-angeles'.
 *
 * Usage: node scripts/lapd-crime-backfill.mjs
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load env from .env.local
const envPath = resolve(process.cwd(), ".env.local");
try {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    // Strip surrounding quotes and trailing \n
    val = val.replace(/^["']|["']$/g, "").replace(/\\n$/, "");
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  console.error("Could not read .env.local — set env vars manually");
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const LA_APP_TOKEN = process.env.LA_OPEN_DATA_APP_TOKEN;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const PAGE_SIZE = 5000;
const MAX_PAGES = 200; // Up to 1M records

// Crime categorization (matches src/lib/crime-categories.ts)
const VIOLENT_KEYWORDS = [
  "MURDER", "HOMICIDE", "RAPE", "ROBBERY", "FELONY ASSAULT", "ASSAULT",
  "KIDNAPPING", "ARSON", "SEX CRIMES", "STRANGULATION", "WEAPONS",
];
const PROPERTY_KEYWORDS = [
  "BURGLARY", "GRAND LARCENY", "PETIT LARCENY", "LARCENY", "CRIMINAL MISCHIEF",
  "THEFT", "STOLEN PROPERTY", "FORGERY", "POSSESSION OF STOLEN", "AUTO",
  "VEHICLE AND TRAFFIC",
];

function categorizeCrime(desc) {
  if (!desc) return "quality_of_life";
  const upper = desc.toUpperCase();
  if (VIOLENT_KEYWORDS.some((v) => upper.includes(v))) return "violent";
  if (PROPERTY_KEYWORDS.some((p) => upper.includes(p))) return "property";
  return "quality_of_life";
}

function buildUrl(whereClause, limit, offset) {
  let url =
    `https://data.lacity.org/resource/2nrs-mtv8.json` +
    `?$where=${encodeURIComponent(whereClause)}` +
    `&$limit=${limit}` +
    `&$offset=${offset}` +
    `&$order=${encodeURIComponent("date_occ ASC")}`;
  if (LA_APP_TOKEN) url += `&$$app_token=${LA_APP_TOKEN}`;
  return url;
}

async function batchUpsert(rows) {
  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase
      .from("nypd_complaints")
      .upsert(batch, { onConflict: "cmplnt_num", ignoreDuplicates: true });
    if (error) {
      console.error(`  Upsert error at batch ${i}: ${error.message}`);
    } else {
      inserted += batch.length;
    }
  }
  return inserted;
}

async function main() {
  // 2 years back from today
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  const sinceDate = twoYearsAgo.toISOString().replace("Z", "");

  console.log(`LAPD Crime Backfill — loading data since ${sinceDate.slice(0, 10)}`);
  console.log(`Supabase: ${SUPABASE_URL}`);

  let offset = 0;
  let hasMore = true;
  let pagesFetched = 0;
  let totalInserted = 0;
  let totalRecords = 0;

  while (hasMore) {
    const url = buildUrl(`date_occ > '${sinceDate}'`, PAGE_SIZE, offset);

    console.log(`  Fetching page ${pagesFetched + 1} (offset ${offset})...`);
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`  API error: ${res.status} ${await res.text().then(t => t.slice(0, 200))}`);
      break;
    }

    const records = await res.json();
    if (!records || records.length === 0) {
      console.log("  No more records.");
      hasMore = false;
      break;
    }

    totalRecords += records.length;

    const rows = records
      .filter((r) => r.dr_no)
      .map((r) => {
        const part = r.part_1_2 ? parseInt(String(r.part_1_2), 10) : null;
        let lawCategory = null;
        if (part === 1) lawCategory = "FELONY";
        else if (part === 2) lawCategory = "MISDEMEANOR";

        return {
          cmplnt_num: `LAPD-${r.dr_no}`,
          cmplnt_date: r.date_occ ? String(r.date_occ).slice(0, 10) : null,
          borough: r.area_name ? String(r.area_name) : null,
          precinct: null,
          offense_description: r.crm_cd_desc ? String(r.crm_cd_desc) : null,
          law_category: lawCategory,
          crime_category: categorizeCrime(r.crm_cd_desc ? String(r.crm_cd_desc) : null),
          pd_description: r.premis_desc ? String(r.premis_desc) : null,
          latitude: r.lat ? parseFloat(String(r.lat)) : null,
          longitude: r.lon ? parseFloat(String(r.lon)) : null,
          zip_code: null,
          metro: "los-angeles",
          imported_at: new Date().toISOString(),
        };
      })
      .filter((r) => !(r.latitude === 0 && r.longitude === 0));

    if (rows.length > 0) {
      const inserted = await batchUpsert(rows);
      totalInserted += inserted;
      console.log(`  Inserted ${inserted} records (${totalInserted} total)`);
    }

    pagesFetched++;
    if (records.length < PAGE_SIZE || pagesFetched >= MAX_PAGES) {
      hasMore = false;
    } else {
      offset += PAGE_SIZE;
    }
  }

  console.log(`\nFetch complete: ${totalRecords} records fetched, ${totalInserted} upserted.`);

  // Backfill zip codes from lat/lon
  console.log("\nBackfilling zip codes from coordinates...");
  const { data: zipResult, error: zipErr } = await supabase.rpc(
    "backfill_crime_zip_codes",
    { target_metro: "los-angeles" }
  );
  if (zipErr) {
    console.error(`Zip backfill error: ${zipErr.message}`);
  } else {
    console.log(`Zip codes updated for ${zipResult} records.`);
  }

  // Count results
  const { count } = await supabase
    .from("nypd_complaints")
    .select("id", { count: "exact", head: true })
    .eq("metro", "los-angeles");
  console.log(`\nTotal LA crime records in database: ${count}`);

  // Show category breakdown
  const { data: breakdown } = await supabase.rpc("crime_by_zip", {
    since_date: twoYearsAgo.toISOString().slice(0, 10),
    metro: "los-angeles",
  });
  if (breakdown) {
    const totals = breakdown.reduce(
      (acc, r) => ({
        total: acc.total + Number(r.total),
        violent: acc.violent + Number(r.violent),
        property: acc.property + Number(r.property),
        qol: acc.qol + Number(r.quality_of_life),
      }),
      { total: 0, violent: 0, property: 0, qol: 0 }
    );
    console.log(`\nCategory breakdown (last 2 years):`);
    console.log(`  Total: ${totals.total.toLocaleString()}`);
    console.log(`  Violent: ${totals.violent.toLocaleString()}`);
    console.log(`  Property: ${totals.property.toLocaleString()}`);
    console.log(`  Quality of Life: ${totals.qol.toLocaleString()}`);
    console.log(`  Zip codes covered: ${breakdown.length}`);
  }

  console.log("\nDone!");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Backfill Chicago CPD crime data (last 2 years) into nypd_complaints table.
 *
 * Data source: Crimes - 2001 to Present (ijzp-q8t2)
 * https://data.cityofchicago.org/resource/ijzp-q8t2.json
 *
 * Categorizes crimes as violent, property, or quality_of_life.
 *
 * Usage:
 *   node scripts/backfill-chicago-crime.mjs
 *   node scripts/backfill-chicago-crime.mjs --offset=100000
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

// Load .env.local manually
const envPath = resolve(process.cwd(), ".env.local");
const env = {};
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, "").replace(/\\n/g, "");
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const CHICAGO_TOKEN = (env.CHICAGO_OPEN_DATA_APP_TOKEN || "").trim();
const ENDPOINT = "https://data.cityofchicago.org/resource/ijzp-q8t2.json";
const PAGE_SIZE = 5000;

const args = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => {
    const [k, v] = a.slice(2).split("=");
    return [k, v || "true"];
  })
);
const OFFSET = parseInt(args.offset || "0", 10);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const VIOLENT_TYPES = new Set([
  "HOMICIDE", "ASSAULT", "BATTERY", "ROBBERY",
  "CRIM SEXUAL ASSAULT", "KIDNAPPING",
]);
const PROPERTY_TYPES = new Set([
  "THEFT", "BURGLARY", "MOTOR VEHICLE THEFT", "ARSON",
]);

function crimeCategory(primaryType) {
  if (!primaryType) return "quality_of_life";
  const upper = primaryType.toUpperCase().trim();
  if (VIOLENT_TYPES.has(upper)) return "violent";
  if (PROPERTY_TYPES.has(upper)) return "property";
  return "quality_of_life";
}

async function batchUpsert(rows) {
  let added = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const { error, count } = await supabase.from("nypd_complaints").upsert(batch, {
      onConflict: "cmplnt_num",
      count: "exact",
    });
    if (error) {
      if (error.code === "23505") {
        for (const row of batch) {
          const { error: sErr } = await supabase.from("nypd_complaints").upsert(row, {
            onConflict: "cmplnt_num",
          });
          if (!sErr) added++;
        }
      } else {
        console.error(`  Upsert error: ${error.message}`);
      }
    } else {
      added += count || batch.length;
    }
  }
  return added;
}

async function main() {
  // 2 years ago from today
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  const dateFilter = twoYearsAgo.toISOString().slice(0, 10);

  console.log(`\n=== Chicago Crime Data Backfill (last 2 years) ===`);
  console.log(`Date filter: >= ${dateFilter}`);
  console.log(`Offset: ${OFFSET}\n`);

  let offset = OFFSET;
  let total = 0;
  let pages = 0;

  while (true) {
    const params = new URLSearchParams({
      $limit: String(PAGE_SIZE),
      $offset: String(offset),
      $order: ":id",
      $where: `date > '${dateFilter}'`,
    });
    if (CHICAGO_TOKEN) params.set("$$app_token", CHICAGO_TOKEN);

    const url = `${ENDPOINT}?${params}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`API error: ${res.status} ${await res.text()}`);
      break;
    }

    const records = await res.json();
    if (!records || records.length === 0) {
      console.log("No more records.");
      break;
    }

    const rows = records
      .filter((r) => r.case_number)
      .map((r) => {
        const desc = [r.primary_type, r.description].filter(Boolean).join(" - ");
        return {
          cmplnt_num: `CHI-${r.case_number}`,
          cmplnt_date: r.date ? String(r.date).slice(0, 10) : null,
          borough: "Chicago",
          precinct: r.district || null,
          offense_description: desc || null,
          crime_category: crimeCategory(r.primary_type),
          latitude: r.latitude ? parseFloat(r.latitude) : null,
          longitude: r.longitude ? parseFloat(r.longitude) : null,
          metro: "chicago",
        };
      });

    const added = await batchUpsert(rows);
    total += added;
    pages++;
    console.log(
      `  Page ${pages}: ${records.length} fetched, ${added} upserted (total: ${total}, offset: ${offset})`
    );

    if (records.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
    await sleep(300);
  }

  console.log(`\nDone! Total crime records upserted: ${total}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Backfill Chicago 311 Service Requests into complaints_311 table.
 *
 * Data source: 311 Service Requests (v6vf-nfxy)
 * https://data.cityofchicago.org/resource/v6vf-nfxy.json
 *
 * Filters for housing-related complaint types only.
 *
 * Usage:
 *   node scripts/backfill-chicago-311.mjs
 *   node scripts/backfill-chicago-311.mjs --offset=50000
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
const ENDPOINT = "https://data.cityofchicago.org/resource/v6vf-nfxy.json";
const PAGE_SIZE = 5000;

// Housing-related 311 types to include
const HOUSING_TYPES = [
  "BUILDING/HOUSING",
  "RODENT",
  "PEST",
  "PLUMBING",
  "ELECTRICAL",
  "HEAT",
  "ELEVATOR",
  "FIRE",
  "WATER",
  "SEWER",
  "MOLD",
  "LEAD",
  "ASBESTOS",
  "VACANT BUILDING",
  "BUILDING VIOLATION",
];

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

async function batchUpsert(rows) {
  let added = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const { error, count } = await supabase.from("complaints_311").upsert(batch, {
      onConflict: "unique_key",
      count: "exact",
    });
    if (error) {
      if (error.code === "23505") {
        for (const row of batch) {
          const { error: sErr } = await supabase.from("complaints_311").upsert(row, {
            onConflict: "unique_key",
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

function buildWhereClause() {
  const typeFilters = HOUSING_TYPES.map((t) => `sr_type='${t}'`).join(" OR ");
  return `(${typeFilters})`;
}

async function main() {
  console.log(`\n=== Chicago 311 Service Requests Backfill ===`);
  console.log(`Offset: ${OFFSET}`);
  console.log(`Filtering for housing-related types\n`);

  let offset = OFFSET;
  let total = 0;
  let pages = 0;

  const whereClause = buildWhereClause();

  while (true) {
    const params = new URLSearchParams({
      $limit: String(PAGE_SIZE),
      $offset: String(offset),
      $order: ":id",
      $where: whereClause,
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
      .filter((r) => r.sr_number)
      .map((r) => ({
        unique_key: r.sr_number,
        complaint_type: r.sr_type || null,
        descriptor: r.sr_short_code || null,
        status: r.status || null,
        created_date: r.created_date ? String(r.created_date).slice(0, 10) : null,
        closed_date: r.closed_date ? String(r.closed_date).slice(0, 10) : null,
        incident_address: r.street_address || null,
        latitude: r.latitude ? parseFloat(r.latitude) : null,
        longitude: r.longitude ? parseFloat(r.longitude) : null,
        metro: "chicago",
      }));

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

  console.log(`\nDone! Total 311 complaints upserted: ${total}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

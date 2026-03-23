#!/usr/bin/env node
/**
 * Backfill Chicago Building Violations into dob_violations table.
 *
 * Data source: Building Violations (22u3-xenr)
 * https://data.cityofchicago.org/resource/22u3-xenr.json
 *
 * Usage:
 *   node scripts/backfill-chicago-violations.mjs
 *   node scripts/backfill-chicago-violations.mjs --offset=50000
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
const ENDPOINT = "https://data.cityofchicago.org/resource/22u3-xenr.json";
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

function parseAddress(addressStr) {
  if (!addressStr) return { house_number: "", street_name: "" };
  const addr = addressStr.trim().toUpperCase();
  const match = addr.match(/^(\d+[-\d]*)\s+(.+)$/);
  if (!match) return { house_number: "", street_name: addr };
  return { house_number: match[1], street_name: match[2] };
}

async function batchUpsert(rows) {
  let added = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const { error, count } = await supabase.from("dob_violations").upsert(batch, {
      onConflict: "isn_dob_bis_vio",
      count: "exact",
    });
    if (error) {
      if (error.code === "23505") {
        for (const row of batch) {
          const { error: sErr } = await supabase.from("dob_violations").upsert(row, {
            onConflict: "isn_dob_bis_vio",
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
  console.log(`\n=== Chicago Building Violations Backfill ===`);
  console.log(`Offset: ${OFFSET}\n`);

  let offset = OFFSET;
  let total = 0;
  let pages = 0;

  while (true) {
    const params = new URLSearchParams({
      $limit: String(PAGE_SIZE),
      $offset: String(offset),
      $order: ":id",
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
      .filter((r) => r.id)
      .map((r) => {
        const parsed = parseAddress(r.address);
        return {
          isn_dob_bis_vio: `CHI-${r.id}`,
          issue_date: r.violation_date ? String(r.violation_date).slice(0, 10) : null,
          violation_type: r.violation_code || null,
          description: r.violation_description || null,
          status: r.violation_status || null,
          disposition_date: r.violation_status_date
            ? String(r.violation_status_date).slice(0, 10)
            : null,
          house_number: parsed.house_number,
          street_name: parsed.street_name,
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

  console.log(`\nDone! Total violations upserted: ${total}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

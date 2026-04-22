#!/usr/bin/env node
/**
 * Backfill oath_hearings from NYC Open Data jz4z-kudi for DOB tickets.
 *
 * Source has 21.5M rows citywide; we filter to DEPT. OF BUILDINGS (~1.4M)
 * since those are the clearest building-owner adjudications. Pages directly
 * from SODA, upserts by ticket_number, computes BBL from borough+block+lot.
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

const env = { ...process.env };
const envPath = resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, "").replace(/\\n/g, "");
  }
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL ?? env.SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const APP_TOKEN = env.NYC_OPEN_DATA_APP_TOKEN;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter((a) => a.startsWith("--"))
    .map((a) => {
      const [k, v] = a.slice(2).split("=");
      return [k, v === undefined ? "true" : v];
    })
);
const AGENCY = args.agency || "DEPT. OF BUILDINGS";
const START_OFFSET = args["start-offset"] ? parseInt(args["start-offset"], 10) : 0;

const log = (m) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);

const BOROUGH_TO_CODE = {
  MANHATTAN: "1", "NEW YORK": "1",
  BRONX: "2",
  BROOKLYN: "3", KINGS: "3",
  QUEENS: "4",
  "STATEN ISLAND": "5", RICHMOND: "5",
};

function computeBbl(boroughName, block, lot) {
  if (!boroughName || !block || !lot) return null;
  const code = BOROUGH_TO_CODE[String(boroughName).trim().toUpperCase()];
  if (!code) return null;
  const bl = String(block).replace(/\D/g, "");
  const lt = String(lot).replace(/\D/g, "");
  if (!bl || !lt) return null;
  return code + bl.padStart(5, "0").slice(-5) + lt.padStart(4, "0").slice(-4);
}

function parseDate(raw) {
  if (!raw) return null;
  const s = raw.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const y = parseInt(s.slice(0, 4), 10);
  if (y < 1900 || y > 2100) return null;
  return s;
}

function parseNum(raw) {
  if (raw == null || raw === "") return null;
  const n = parseFloat(String(raw));
  return isNaN(n) ? null : n;
}

const PAGE_SIZE = 5000;
const BATCH_SIZE = 500;

async function fetchPage(offset) {
  const whereClause = `issuing_agency='${AGENCY}'`;
  const params = new URLSearchParams({
    $where: whereClause,
    $limit: String(PAGE_SIZE),
    $offset: String(offset),
    // Use SODA's internal row id — always indexed, avoids multi-minute
    // sort on a 21M-row table.
    $order: ":id",
  });
  if (APP_TOKEN) params.set("$$app_token", APP_TOKEN);
  const url = `https://data.cityofnewyork.us/resource/jz4z-kudi.json?${params}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`SODA ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function upsertBatch(rows) {
  if (rows.length === 0) return 0;
  // Dedupe within payload
  const seen = new Map();
  for (const r of rows) seen.set(r.ticket_number, r);
  const deduped = [...seen.values()];

  let added = 0;
  for (let i = 0; i < deduped.length; i += BATCH_SIZE) {
    const batch = deduped.slice(i, i + BATCH_SIZE);
    let ok = false;
    for (let attempt = 0; attempt < 5 && !ok; attempt++) {
      const { error } = await supabase.from("oath_hearings").upsert(batch, { onConflict: "ticket_number" });
      if (!error || error.code === "23505") { ok = true; break; }
      log(`  retry ${attempt + 1}/5: ${String(error.message).slice(0, 100)}`);
      await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
    }
    if (ok) added += batch.length;
  }
  return added;
}

async function main() {
  log(`== OATH backfill agency='${AGENCY}' from offset=${START_OFFSET} ==`);
  let offset = START_OFFSET;
  let total = 0;
  while (true) {
    let records;
    try {
      records = await fetchPage(offset);
    } catch (err) {
      log(`  fetch err at offset ${offset}: ${err.message} — retrying in 15s`);
      await new Promise((r) => setTimeout(r, 15000));
      continue;
    }
    if (records.length === 0) break;

    const rows = records
      .filter((r) => r.ticket_number)
      .map((r) => ({
        ticket_number: String(r.ticket_number),
        bbl: computeBbl(r.violation_location_borough, r.violation_location_block_no, r.violation_location_lot_no),
        borough: r.violation_location_borough || null,
        block: r.violation_location_block_no ? String(r.violation_location_block_no) : null,
        lot: r.violation_location_lot_no ? String(r.violation_location_lot_no) : null,
        issuing_agency: r.issuing_agency || null,
        violation_date: parseDate(r.violation_date),
        violation_details: r.violation_details || null,
        violation_description: r.charge_1_code_description || r.violation_description || null,
        house_number: r.violation_location_house || null,
        street_name: r.violation_location_street_name || null,
        zip: r.violation_location_zip_code || null,
        charge_code: r.charge_1_code || null,
        charge_section: r.charge_1_code_section || null,
        hearing_status: r.hearing_status || null,
        hearing_result: r.hearing_result || null,
        hearing_date: parseDate(r.hearing_date),
        decision_date: parseDate(r.decision_date),
        compliance_status: r.compliance_status || null,
        total_violation_amount: parseNum(r.total_violation_amount),
        penalty_imposed: parseNum(r.penalty_imposed),
        paid_amount: parseNum(r.paid_amount),
        balance_due: parseNum(r.balance_due),
        respondent_name: [r.respondent_first_name, r.respondent_last_name].filter(Boolean).join(" ").trim().slice(0, 200) || null,
        metro: "nyc",
        imported_at: new Date().toISOString(),
      }));

    const added = await upsertBatch(rows);
    total += added;
    if (offset % 50000 === 0 || records.length < PAGE_SIZE) {
      log(`  offset=${offset} batch=${records.length} cumulative=${total}`);
    }

    if (records.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  log(`== DONE. total upserted=${total} ==`);
}

main().catch((err) => {
  console.error(`Fatal: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});

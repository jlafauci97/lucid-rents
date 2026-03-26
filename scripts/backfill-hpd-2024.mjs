#!/usr/bin/env node
/**
 * Backfill HPD violations from 2024-01-01 to 2025-01-01.
 * Runs in monthly chunks to stay within SODA API limits.
 * Uses upsert on violation_id so re-runs are safe.
 */
import { createRequire } from "module";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local
const envPath = resolve(process.cwd(), ".env.local");
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const idx = trimmed.indexOf("=");
  if (idx === -1) continue;
  const key = trimmed.slice(0, idx).trim();
  const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
  if (!process.env[key]) process.env[key] = val;
}

const require = createRequire(import.meta.url);
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const BOROUGH_MAP = { "1": "Manhattan", "2": "Bronx", "3": "Brooklyn", "4": "Queens", "5": "Staten Island" };
const PAGE_SIZE = 5000;
const ENDPOINT = "wvxf-dwi5";

function buildUrl(where, limit, offset) {
  const appToken = process.env.NYC_OPEN_DATA_APP_TOKEN;
  let url =
    `https://data.cityofnewyork.us/resource/${ENDPOINT}.json` +
    `?$where=${encodeURIComponent(where)}` +
    `&$limit=${limit}&$offset=${offset}` +
    `&$order=${encodeURIComponent("inspectiondate ASC")}`;
  if (appToken) url += `&$$app_token=${appToken}`;
  return url;
}

function mapRow(r) {
  let bbl = null;
  const boroRaw = r.boroid;
  const blockRaw = r.block;
  const lotRaw = r.lot;
  if (boroRaw && blockRaw && lotRaw && /^\d$/.test(boroRaw)) {
    const block = String(blockRaw).padStart(5, "0").slice(-5);
    const lot = String(lotRaw).padStart(4, "0").slice(-4);
    bbl = `${boroRaw}${block}${lot}`;
  }
  return {
    violation_id: String(r.violationid),
    bbl,
    bin: r.bin || null,
    class: r.class && ["A", "B", "C", "I"].includes(r.class.toUpperCase()) ? r.class.toUpperCase() : null,
    inspection_date: r.inspectiondate ? r.inspectiondate.slice(0, 10) : null,
    approved_date: r.approveddate ? r.approveddate.slice(0, 10) : null,
    nov_description: r.novdescription || null,
    nov_issue_date: r.novissueddate ? r.novissueddate.slice(0, 10) : null,
    status: r.currentstatus || null,
    status_date: r.currentstatusdate ? r.currentstatusdate.slice(0, 10) : null,
    borough: r.boroid ? BOROUGH_MAP[r.boroid] || null : null,
    house_number: r.housenumber || null,
    street_name: r.streetname || null,
    apartment: r.apartment || null,
    imported_at: new Date().toISOString(),
  };
}

async function batchUpsert(rows) {
  let count = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const { error } = await sb.from("hpd_violations").upsert(batch, { onConflict: "violation_id", ignoreDuplicates: true });
    if (error) {
      console.error(`  Upsert error: ${error.message}`);
    } else {
      count += batch.length;
    }
  }
  return count;
}

async function fetchMonth(startDate, endDate) {
  let offset = 0;
  let total = 0;

  while (true) {
    const where = `inspectiondate >= '${startDate}' AND inspectiondate < '${endDate}'`;
    const url = buildUrl(where, PAGE_SIZE, offset);

    const res = await fetch(url);
    if (!res.ok) {
      console.error(`  API error at offset ${offset}: ${res.status} ${(await res.text()).slice(0, 200)}`);
      break;
    }

    const records = await res.json();
    if (records.length === 0) break;

    const rows = records.filter((r) => r.violationid).map(mapRow);
    if (rows.length > 0) {
      const upserted = await batchUpsert(rows);
      total += upserted;
    }

    if (records.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return total;
}

// Generate monthly ranges from 2024-01-01 to 2025-01-01
const months = [];
for (let m = 0; m < 12; m++) {
  const start = `2024-${String(m + 1).padStart(2, "0")}-01`;
  const end = m === 11 ? "2025-01-01" : `2024-${String(m + 2).padStart(2, "0")}-01`;
  months.push({ start, end });
}

console.log("Backfilling HPD violations: 2024-01-01 to 2025-01-01");
let grandTotal = 0;

for (const { start, end } of months) {
  process.stdout.write(`${start} → ${end}: `);
  const count = await fetchMonth(start, end);
  grandTotal += count;
  console.log(`${count.toLocaleString()} records`);
}

console.log(`\nDone! Total: ${grandTotal.toLocaleString()} records upserted.`);

// Now link unlinked records to buildings by BBL
console.log("\nLinking new records to buildings...");
let linked = 0;
let hasMore = true;

while (hasMore) {
  const { data: unlinked, error } = await sb
    .from("hpd_violations")
    .select("id, bbl")
    .is("building_id", null)
    .not("bbl", "is", null)
    .neq("bbl", "")
    .gte("inspection_date", "2024-01-01")
    .lt("inspection_date", "2025-01-01")
    .order("id", { ascending: true })
    .limit(1000);

  if (error || !unlinked || unlinked.length === 0) {
    hasMore = false;
    break;
  }

  const bblSet = [...new Set(unlinked.map((r) => r.bbl).filter(Boolean))];
  const bblToBuilding = new Map();

  for (let i = 0; i < bblSet.length; i += 500) {
    const batch = bblSet.slice(i, i + 500);
    const { data: buildings } = await sb.from("buildings").select("id, bbl").in("bbl", batch);
    if (buildings) for (const b of buildings) bblToBuilding.set(b.bbl, b.id);
  }

  const updates = new Map();
  for (const record of unlinked) {
    const buildingId = record.bbl ? bblToBuilding.get(record.bbl) : undefined;
    if (buildingId) {
      if (!updates.has(buildingId)) updates.set(buildingId, []);
      updates.get(buildingId).push(record.id);
    }
  }

  for (const [buildingId, ids] of updates) {
    const { error: upErr } = await sb
      .from("hpd_violations")
      .update({ building_id: buildingId })
      .in("id", ids);
    if (!upErr) linked += ids.length;
  }

  if (unlinked.length < 1000) hasMore = false;
}

console.log(`Linked ${linked.toLocaleString()} records to buildings.`);

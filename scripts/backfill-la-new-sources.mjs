#!/usr/bin/env node
/**
 * Backfill new LA data sources directly via Supabase + LA Open Data APIs.
 * Run: node scripts/backfill-la-new-sources.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

// Load .env.local manually
const envFile = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of envFile.split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    let val = match[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").replace(/\\n/g, "").trim();
const SUPABASE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").replace(/\\n/g, "").trim();

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const LA_TOKEN = (process.env.LA_OPEN_DATA_APP_TOKEN || "").replace(/\\n/g, "").trim();
const PAGE_SIZE = 1000;

function buildUrl(endpoint, where, limit, offset, order) {
  const params = new URLSearchParams({
    $limit: String(limit),
    $offset: String(offset),
    $order: order,
  });
  if (where) params.set("$where", where);
  if (LA_TOKEN) params.set("$$app_token", LA_TOKEN);
  return `https://data.lacity.org/resource/${endpoint}.json?${params}`;
}

async function batchInsert(table, rows, label) {
  let added = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    // Use raw SQL via rpc or just insert with ignoreDuplicates
    const { error, count } = await supabase.from(table).insert(batch, { count: "exact" });
    if (error) {
      // Duplicate key errors are expected — just skip
      if (error.code === "23505") {
        // Insert one by one for this batch to get non-duplicates through
        for (const row of batch) {
          const { error: singleErr } = await supabase.from(table).insert(row);
          if (!singleErr) added++;
        }
      } else {
        console.error(`  ${label} insert error (batch ${i}): ${error.message}`);
      }
    } else {
      added += count || batch.length;
    }
  }
  return added;
}

// --- LAHD Evictions ---
async function syncEvictions() {
  console.log("\n=== LAHD Evictions (2u8b-eyuu) ===");
  let offset = 0, total = 0, pages = 0;
  while (true) {
    const url = buildUrl("2u8b-eyuu", null, PAGE_SIZE, offset, ":id");
    const res = await fetch(url);
    if (!res.ok) { console.error(`API error: ${res.status}`); break; }
    const records = await res.json();
    if (!records || records.length === 0) break;

    const parseDate = (d) => {
      if (!d) return null;
      const s = String(d);
      const m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
      if (m) return `${m[3]}-${m[1]}-${m[2]}`;
      return s.slice(0, 10);
    };

    const rows = records.filter(r => r.apn).map(r => ({
      apn: String(r.apn),
      address: r.officialaddress ? String(r.officialaddress) : null,
      eviction_category: r.eviction_category ? String(r.eviction_category) : null,
      notice_date: parseDate(r.notice_date),
      notice_type: r.notice_type ? String(r.notice_type) : null,
      received_date: parseDate(r.received),
      metro: "los-angeles",
      imported_at: new Date().toISOString(),
    }));

    const added = await batchInsert("lahd_evictions", rows, "Evictions");
    total += added;
    pages++;
    console.log(`  Page ${pages}: ${records.length} fetched, ${added} upserted (total: ${total})`);
    if (records.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  console.log(`  Done: ${total} evictions`);
}

// --- LAHD Tenant Buyouts ---
async function syncBuyouts() {
  console.log("\n=== LAHD Tenant Buyouts (ci3m-f23k) ===");
  let offset = 0, total = 0, pages = 0;
  while (true) {
    const url = buildUrl("ci3m-f23k", null, PAGE_SIZE, offset, ":id");
    const res = await fetch(url);
    if (!res.ok) { console.error(`API error: ${res.status}`); break; }
    const records = await res.json();
    if (!records || records.length === 0) break;

    const rows = records.filter(r => r.apn).map(r => ({
      apn: String(r.apn),
      address: r.tenant_streetaddress ? String(r.tenant_streetaddress) : null,
      disclosure_date: r.disclosure_fileddate ? String(r.disclosure_fileddate).slice(0, 10) : null,
      compensation_amount: r.compensation_amount ? parseFloat(String(r.compensation_amount)) : null,
      metro: "los-angeles",
      imported_at: new Date().toISOString(),
    }));

    const added = await batchInsert("lahd_tenant_buyouts", rows, "Buyouts");
    total += added;
    pages++;
    console.log(`  Page ${pages}: ${records.length} fetched, ${added} upserted (total: ${total})`);
    if (records.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  console.log(`  Done: ${total} buyouts`);
}

// --- LAHD CCRIS ---
async function syncCCRIS() {
  console.log("\n=== LAHD CCRIS Cases (ds2y-sb5t) ===");
  let offset = 0, total = 0, pages = 0;
  while (true) {
    const url = buildUrl("ds2y-sb5t", null, PAGE_SIZE, offset, ":id");
    const res = await fetch(url);
    if (!res.ok) { console.error(`API error: ${res.status}`); break; }
    const records = await res.json();
    if (!records || records.length === 0) break;

    const rows = records.filter(r => r.apn).map(r => ({
      apn: String(r.apn),
      address: r.address ? String(r.address) : null,
      case_type: r.casetype ? String(r.casetype) : null,
      start_date: r.start_date ? String(r.start_date).slice(0, 10) : null,
      total_complaints: r.totalcomplaintscount ? parseInt(String(r.totalcomplaintscount), 10) : 0,
      open_complaints: r.opencomplaintscount ? parseInt(String(r.opencomplaintscount), 10) : 0,
      scheduled_inspections: r.scheduledinspectionscount ? parseInt(String(r.scheduledinspectionscount), 10) : 0,
      metro: "los-angeles",
      imported_at: new Date().toISOString(),
    }));

    const added = await batchInsert("lahd_ccris_cases", rows, "CCRIS");
    total += added;
    pages++;
    console.log(`  Page ${pages}: ${records.length} fetched, ${added} upserted (total: ${total})`);
    if (records.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  console.log(`  Done: ${total} CCRIS cases`);
}

// --- Run all ---
async function main() {
  console.log("Starting LA new sources backfill...");
  console.log(`Supabase: ${SUPABASE_URL}`);

  await syncEvictions();
  await syncBuyouts();
  await syncCCRIS();

  // Check final counts
  const { data: evCount } = await supabase.from("lahd_evictions").select("id", { count: "exact", head: true });
  const { data: buyCount } = await supabase.from("lahd_tenant_buyouts").select("id", { count: "exact", head: true });
  const { data: ccrisCount } = await supabase.from("lahd_ccris_cases").select("id", { count: "exact", head: true });

  console.log("\n=== Final counts ===");
  console.log("(Check Supabase directly for accurate counts)");
  console.log("Done!");
}

main().catch(console.error);

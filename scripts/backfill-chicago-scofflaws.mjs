#!/usr/bin/env node
/**
 * Backfill Chicago Building Code Scofflaws.
 *
 * Data source: Building Code Scofflaw List (crg5-4zyp)
 * https://data.cityofchicago.org/resource/crg5-4zyp.json
 *
 * Usage:
 *   node scripts/backfill-chicago-scofflaws.mjs
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
const ENDPOINT = "https://data.cityofchicago.org/resource/crg5-4zyp.json";
const PAGE_SIZE = 5000;
const BATCH_SIZE = 200;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeAddress(addr) {
  if (!addr) return null;
  return addr.trim().toUpperCase().replace(/\s+/g, " ");
}

async function fetchRecords(offset, limit) {
  const params = new URLSearchParams({
    $limit: String(limit),
    $offset: String(offset),
    $order: ":id",
  });
  if (CHICAGO_TOKEN) params.set("$$app_token", CHICAGO_TOKEN);

  const url = `${ENDPOINT}?${params}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Chicago API ${res.status}: ${await res.text()}`);
  return res.json();
}

async function linkToBuilding(address) {
  if (!address) return null;
  const normalized = normalizeAddress(address);
  if (!normalized) return null;

  const { data } = await supabase
    .from("buildings")
    .select("id")
    .eq("metro", "chicago")
    .ilike("full_address", `${normalized}%`)
    .limit(1)
    .single();
  return data?.id || null;
}

async function main() {
  console.log("\n=== Chicago Building Code Scofflaws Backfill ===\n");

  let offset = 0;
  let totalInserted = 0;
  let totalSkipped = 0;

  while (true) {
    console.log(`Fetching records ${offset}–${offset + PAGE_SIZE}...`);
    const records = await fetchRecords(offset, PAGE_SIZE);
    if (!records || records.length === 0) {
      console.log("No more records.");
      break;
    }

    console.log(`  Got ${records.length} records`);

    const rows = [];
    for (const r of records) {
      const respondent = (r.defendant_owner || r.respondent || "").trim();
      const address = normalizeAddress(r.address || "");
      if (!respondent) continue;

      rows.push({
        respondent_name: respondent.slice(0, 255),
        address: address || null,
        total_fines: null,
        unpaid_fines: null,
        violation_count: null,
        last_violation_date: r.building_list_date ? r.building_list_date.split("T")[0] : null,
        ward: r.ward ? parseInt(r.ward, 10) : null,
        community_area: (r.community_area || "").trim() || null,
        status: "scofflaw",
        latitude: r.latitude ? parseFloat(r.latitude) : null,
        longitude: r.longitude ? parseFloat(r.longitude) : null,
        metro: "chicago",
      });
    }

    // Batch upsert
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from("chicago_scofflaws")
        .upsert(batch, { onConflict: "respondent_name,address", ignoreDuplicates: true });

      if (error) {
        console.error(`  Batch error:`, error.message);
        // Fall back to one-by-one
        for (const row of batch) {
          const { error: singleErr } = await supabase
            .from("chicago_scofflaws")
            .upsert(row, { onConflict: "respondent_name,address", ignoreDuplicates: true });
          if (!singleErr) totalInserted++;
          else totalSkipped++;
        }
      } else {
        totalInserted += batch.length;
      }
    }

    console.log(`  Progress: ${totalInserted} inserted, ${totalSkipped} skipped`);

    if (records.length < PAGE_SIZE) break;
    offset += records.length;
    await sleep(300);
  }

  // Link to buildings
  console.log("\nLinking scofflaws to buildings...");
  const { data: unlinked } = await supabase
    .from("chicago_scofflaws")
    .select("id, address")
    .is("building_id", null)
    .not("address", "is", null)
    .limit(5000);

  let linked = 0;
  for (const row of unlinked || []) {
    const buildingId = await linkToBuilding(row.address);
    if (buildingId) {
      await supabase
        .from("chicago_scofflaws")
        .update({ building_id: buildingId })
        .eq("id", row.id);
      linked++;
      // Also mark building as scofflaw
      await supabase
        .from("buildings")
        .update({ is_scofflaw: true })
        .eq("id", buildingId);
    }
  }
  console.log(`  Linked ${linked}/${(unlinked || []).length} scofflaws to buildings`);

  console.log(`\nDone! Total: ${totalInserted} scofflaw records`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

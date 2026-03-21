#!/usr/bin/env node

/**
 * Sync LA data: violations (LAHD) and 311 complaints (MyLA311 2026)
 * into the database, link to buildings, and update building counts.
 *
 * Usage:
 *   node scripts/sync-la-data.mjs                    # sync all
 *   node scripts/sync-la-data.mjs --source=lahd      # violations only
 *   node scripts/sync-la-data.mjs --source=311       # 311 complaints only
 *   node scripts/sync-la-data.mjs --source=counts    # just update counts
 *   node scripts/sync-la-data.mjs --limit=10000      # limit records
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env.local");
const envText = fs.readFileSync(envPath, "utf8");
const env = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, "").replace(/\\n/g, "");
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const args = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => {
    const [k, v] = a.slice(2).split("=");
    return [k, v || "true"];
  })
);
const SOURCE = args.source || "all";
const LIMIT = parseInt(args.limit || "50000", 10);
const BATCH = 500;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ─── Build address lookup map ────────────────────────────────────────────────
async function loadBuildingAddressMap() {
  console.log("Loading LA building address map...");
  const map = new Map(); // key: "ADDRESS|ZIP" -> building_id
  let lastId = null;
  let total = 0;

  while (true) {
    let q = supabase
      .from("buildings")
      .select("id, full_address, zip_code")
      .eq("metro", "los-angeles")
      .order("id", { ascending: true })
      .limit(10000);
    if (lastId) q = q.gt("id", lastId);
    const { data } = await q;
    if (!data || data.length === 0) break;

    for (const b of data) {
      // Extract street from "1015 S LA BREA AVE, Los Angeles, CA 90019"
      const street = (b.full_address || "").split(",")[0]?.trim().toUpperCase();
      if (street && b.zip_code) {
        map.set(`${street}|${b.zip_code}`, b.id);
      }
    }
    total += data.length;
    lastId = data[data.length - 1].id;
    if (data.length < 10000) break;
  }

  console.log(`  Loaded ${total} buildings, ${map.size} address keys\n`);
  return map;
}

// ─── Sync LAHD violations ────────────────────────────────────────────────────
async function syncLAHDViolations(addrMap) {
  console.log("=== Syncing LAHD Violations ===\n");

  let offset = 0;
  let totalAdded = 0;
  let totalLinked = 0;
  const pageSize = 5000;

  while (totalAdded < LIMIT) {
    const fetchSize = Math.min(pageSize, LIMIT - totalAdded);
    const url = `https://data.lacity.org/resource/u82d-eh7z.json?$limit=${fetchSize}&$offset=${offset}&$order=apno&$select=apno,stno,predir,stname,suffix,zip,apc,stat,adddttm,aptype`;

    console.log(`Fetching LAHD records ${offset}–${offset + fetchSize}...`);
    const res = await fetch(url);
    if (!res.ok) { console.error(`API error: ${res.status}`); break; }

    const records = await res.json();
    if (!records || records.length === 0) break;

    const rows = [];
    for (const r of records) {
      if (!r.apno) continue;
      const streetParts = [r.stno, r.predir, r.stname, r.suffix].filter(Boolean).join(" ").trim();
      const zip = (r.zip || "").replace(/-.*/, "").slice(0, 5);
      const addrKey = `${streetParts.toUpperCase()}|${zip}`;
      const buildingId = addrMap.get(addrKey) || null;

      rows.push({
        violation_id: `LA-${r.apno}`,
        class: r.aptype ? r.aptype.slice(0, 1).toUpperCase() : null,
        inspection_date: r.adddttm ? r.adddttm.slice(0, 10) : null,
        nov_description: r.aptype || null,
        status: r.stat === "O" ? "Open" : r.stat === "C" ? "Closed" : r.stat || null,
        borough: r.apc || "Los Angeles",
        house_number: r.stno || null,
        street_name: [r.predir, r.stname, r.suffix].filter(Boolean).join(" ").trim() || null,
        building_id: buildingId,
        metro: "los-angeles",
        imported_at: new Date().toISOString(),
      });

      if (buildingId) totalLinked++;
    }

    // Batch insert
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const { error } = await supabase
        .from("hpd_violations")
        .upsert(batch, { onConflict: "violation_id", ignoreDuplicates: true });
      if (error && !error.message.includes("duplicate")) {
        console.error("  Insert error:", error.message);
      }
    }

    totalAdded += rows.length;
    offset += records.length;
    console.log(`  Added ${rows.length} (linked: ${totalLinked}, total: ${totalAdded})`);

    if (records.length < fetchSize) break;
    await sleep(300);
  }

  console.log(`\n✅ LAHD: ${totalAdded} violations, ${totalLinked} linked to buildings\n`);
  return { totalAdded, totalLinked };
}

// ─── Sync LA 311 complaints (2026 dataset) ───────────────────────────────────
async function syncLA311Complaints(addrMap) {
  console.log("=== Syncing LA 311 Complaints (2026) ===\n");

  let offset = 0;
  let totalAdded = 0;
  let totalLinked = 0;
  const pageSize = 5000;

  while (totalAdded < LIMIT) {
    const fetchSize = Math.min(pageSize, LIMIT - totalAdded);
    const url = `https://data.lacity.org/resource/2cy6-i7zn.json?$limit=${fetchSize}&$offset=${offset}&$order=casenumber&$select=casenumber,createddate,closeddate,type,status,origin,locator_gis_returned_address,locator_sr_house_number_,locator_sr_street_name__c,locator_service_request_suffix,zipcode__c,geolocation__latitude__s,geolocation__longitude__s,locator_sr_area_planning,resolution_code__c`;

    console.log(`Fetching 311 records ${offset}–${offset + fetchSize}...`);
    const res = await fetch(url);
    if (!res.ok) { console.error(`API error: ${res.status}`); break; }

    const records = await res.json();
    if (!records || records.length === 0) break;

    const rows = [];
    for (const r of records) {
      if (!r.casenumber) continue;

      // Extract street address from full address
      const fullAddr = r.locator_gis_returned_address || "";
      const street = fullAddr.split(",")[0]?.trim().toUpperCase() || "";
      const zip = (r.zipcode__c || "").slice(0, 5);
      const addrKey = `${street}|${zip}`;
      const buildingId = addrMap.get(addrKey) || null;

      rows.push({
        unique_key: `LA311-${r.casenumber}`,
        complaint_type: r.type || null,
        descriptor: r.origin || null,
        agency: "MyLA311",
        status: r.status || null,
        created_date: r.createddate || null,
        closed_date: r.closeddate || null,
        resolution_description: r.resolution_code__c || null,
        borough: r.locator_sr_area_planning || "Los Angeles",
        incident_address: fullAddr || null,
        latitude: r.geolocation__latitude__s ? parseFloat(r.geolocation__latitude__s) : null,
        longitude: r.geolocation__longitude__s ? parseFloat(r.geolocation__longitude__s) : null,
        building_id: buildingId,
        metro: "los-angeles",
        imported_at: new Date().toISOString(),
      });

      if (buildingId) totalLinked++;
    }

    // Batch insert
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const { error } = await supabase
        .from("complaints_311")
        .upsert(batch, { onConflict: "unique_key", ignoreDuplicates: true });
      if (error && !error.message.includes("duplicate")) {
        console.error("  Insert error:", error.message);
      }
    }

    totalAdded += rows.length;
    offset += records.length;
    console.log(`  Added ${rows.length} (linked: ${totalLinked}, total: ${totalAdded})`);

    if (records.length < fetchSize) break;
    await sleep(300);
  }

  console.log(`\n✅ LA 311: ${totalAdded} complaints, ${totalLinked} linked to buildings\n`);
  return { totalAdded, totalLinked };
}

// ─── Update building violation/complaint counts ──────────────────────────────
async function updateBuildingCounts() {
  console.log("=== Updating LA Building Counts ===\n");

  // Count violations per building
  console.log("Counting violations per building...");
  const { data: vCounts } = await supabase
    .from("hpd_violations")
    .select("building_id")
    .eq("metro", "los-angeles")
    .not("building_id", "is", null);

  const violationMap = new Map();
  for (const v of (vCounts || [])) {
    violationMap.set(v.building_id, (violationMap.get(v.building_id) || 0) + 1);
  }
  console.log(`  ${violationMap.size} buildings with violations`);

  // Count complaints per building
  console.log("Counting complaints per building...");
  const { data: cCounts } = await supabase
    .from("complaints_311")
    .select("building_id")
    .eq("metro", "los-angeles")
    .not("building_id", "is", null);

  const complaintMap = new Map();
  for (const c of (cCounts || [])) {
    complaintMap.set(c.building_id, (complaintMap.get(c.building_id) || 0) + 1);
  }
  console.log(`  ${complaintMap.size} buildings with complaints`);

  // Update buildings
  const allIds = new Set([...violationMap.keys(), ...complaintMap.keys()]);
  console.log(`Updating ${allIds.size} buildings...`);

  let updated = 0;
  const ids = Array.from(allIds);
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    for (const id of batch) {
      const updates = {};
      if (violationMap.has(id)) updates.violation_count = violationMap.get(id);
      if (complaintMap.has(id)) updates.complaint_count = complaintMap.get(id);
      await supabase.from("buildings").update(updates).eq("id", id);
      updated++;
    }
    if (i % 1000 === 0 && i > 0) console.log(`  Progress: ${updated}/${ids.length}`);
  }

  console.log(`\n✅ Updated ${updated} building counts\n`);
}

async function main() {
  const addrMap = await loadBuildingAddressMap();

  if (SOURCE === "all" || SOURCE === "lahd") {
    await syncLAHDViolations(addrMap);
  }

  if (SOURCE === "all" || SOURCE === "311") {
    await syncLA311Complaints(addrMap);
  }

  if (SOURCE === "all" || SOURCE === "counts") {
    await updateBuildingCounts();
  }

  console.log("Done!");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

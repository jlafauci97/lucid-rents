#!/usr/bin/env node
/**
 * Compute amenity premiums using pre-cached building info from /tmp/bldg_*.json
 * Loads amenity data + rent data from Supabase, building info from JSON files.
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = {};
for (const envFile of [".env.local", ".env.production.local"]) {
  try {
    for (const line of readFileSync(resolve(__dirname, "..", envFile), "utf8").split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) { const k = m[1].trim(); if (!env[k]) env[k] = m[2].trim().replace(/^"|"$/g, ""); }
    }
  } catch {}
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
function log(m) { console.log(`[${new Date().toISOString().slice(11,19)}] ${m}`); }

const AMENITIES = [
  { name: "Washer & Dryer In Home", key: "in_unit_laundry" },
  { name: "Washer & Dryer On-Site", key: "onsite_laundry" },
  { name: "Gym/Fitness Center", key: "gym" },
  { name: "Door Attendant", key: "doorman" },
  { name: "Swimming Pool", key: "pool" },
  { name: "Garage or Covered Parking", key: "garage" },
  { name: "Dishwasher", key: "dishwasher" },
  { name: "Central Air Conditioning", key: "central_ac" },
  { name: "Stainless Steel Appliances", key: "stainless" },
  { name: "Hardwood or Hardwood Look Floors", key: "hardwood" },
  { name: "Elevator", key: "elevator" },
  { name: "Private Balcony", key: "balcony" },
  { name: "Concierge", key: "concierge" },
  { name: "Extra Storage", key: "storage" },
  { name: "Heat included in rent", key: "heat_included" },
  { name: "Furnished", key: "furnished" },
  { name: "Yard/Lawn", key: "yard" },
  { name: "Deck/Porch/Patio", key: "patio" },
  { name: "Package Receiving", key: "package" },
  { name: "On-Site Management", key: "onsite_mgmt" },
  { name: "WiFi/High-Speed Internet Available", key: "wifi" },
  { name: "Controlled Access/Gate", key: "gated" },
  { name: "Bike Storage", key: "bike_storage" },
  { name: "Garbage Disposal", key: "disposal" },
  { name: "Microwave", key: "microwave" },
];

const MIN_SAMPLE = 5;
function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

async function main() {
  log("=== Computing amenity premiums from cached building data ===\n");

  // Step 1: Load building info from cached JSON files
  log("1. Loading building info from /tmp/bldg_*.json...");
  const buildingInfo = new Map();
  for (let i = 0; i <= 4; i++) {
    try {
      const data = JSON.parse(readFileSync(`/tmp/bldg_${i}.json`, "utf8"));
      for (const [id, info] of Object.entries(data)) buildingInfo.set(id, info);
    } catch (e) { log(`   Warning: /tmp/bldg_${i}.json: ${e.message?.slice(0,40)}`); }
  }
  log(`   ${buildingInfo.size} buildings loaded from cache\n`);

  // Step 2: Load amenity data
  log("2. Loading amenity data...");
  const amenityMap = new Map();
  let off = 0;
  while (true) {
    const { data, error } = await supabase.from("dwellsy_building_meta").select("building_id, amenities").not("amenities", "is", null).order("id").range(off, off + 9999);
    if (error) { log(`   Error @ ${off}: ${error.message?.slice(0,40)}`); await new Promise(r => setTimeout(r, 2000)); continue; }
    if (!data?.length) break;
    for (const m of data) { if (m.amenities?.length) amenityMap.set(m.building_id, new Set(m.amenities)); }
    off += 10000;
    if (off % 100000 === 0) log(`   ${off} scanned, ${amenityMap.size} with amenities...`);
    if (data.length < 10000) break;
  }
  log(`   ${amenityMap.size} buildings with amenities\n`);

  // Step 3: Load rent data (filtered to buildings with amenities)
  log("3. Loading rent data...");
  let rents = [];
  off = 0;
  while (true) {
    const { data, error } = await supabase.from("dewey_building_rents").select("building_id, beds, median_rent").gte("month", "2024-01-01").gt("median_rent", 0).order("id").range(off, off + 9999);
    if (error) { log(`   Error @ ${off}: ${error.message?.slice(0,40)}`); await new Promise(r => setTimeout(r, 2000)); continue; }
    if (!data?.length) break;
    for (const r of data) { if (amenityMap.has(r.building_id)) rents.push(r); }
    off += 10000;
    if (off % 200000 === 0) log(`   scanned ${off}, kept ${rents.length}...`);
    if (data.length < 10000) break;
  }
  log(`   ${rents.length} rent rows\n`);

  // Step 4: Join and group
  log("4. Joining...");
  const groups = new Map();
  let joined = 0;
  for (const r of rents) {
    const bi = buildingInfo.get(r.building_id);
    const am = amenityMap.get(r.building_id);
    if (!bi?.metro || !bi?.zip || !am) continue;
    const key = `${bi.metro}|${bi.zip}|${r.beds}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ rent: parseFloat(r.median_rent), amenities: am });
    joined++;
  }
  log(`   ${joined} joined, ${groups.size} groups\n`);
  rents.length = 0;

  // Step 5: Compute premiums
  log("5. Computing premiums...");
  const rows = [];
  for (const amenity of AMENITIES) {
    let n = 0;
    for (const [key, entries] of groups) {
      const [city, zip, bedsStr] = key.split("|");
      const beds = parseInt(bedsStr);
      const withA = [], withoutA = [];
      for (const e of entries) {
        if (e.amenities.has(amenity.name)) withA.push(e.rent);
        else withoutA.push(e.rent);
      }
      if (withA.length < MIN_SAMPLE || withoutA.length < MIN_SAMPLE) continue;
      const medWith = median(withA), medWithout = median(withoutA);
      if (!medWith || !medWithout || medWithout === 0) continue;
      rows.push({
        city, zip, amenity: amenity.key, beds,
        median_with: Math.round(medWith * 100) / 100,
        median_without: Math.round(medWithout * 100) / 100,
        premium_pct: Math.round(((medWith - medWithout) / medWithout * 100) * 100) / 100,
        premium_dollars: Math.round((medWith - medWithout) * 100) / 100,
        sample_size: withA.length + withoutA.length,
        period: "dwellsy_2024",
      });
      n++;
    }
    log(`   ${amenity.key}: ${n} premiums`);
  }
  log(`\n   Total: ${rows.length} premium rows\n`);

  // Step 6: Clear and insert
  log("6. Upserting...");
  await supabase.from("dewey_amenity_premiums").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from("dewey_amenity_premiums").insert(rows.slice(i, i + 500));
    if (error) log(`   Error batch ${i}: ${error.message?.slice(0, 80)}`);
  }
  log(`   Inserted ${rows.length} rows\n`);

  // Results
  for (const city of ["nyc", "los-angeles", "chicago", "miami", "houston"]) {
    const top = rows.filter(r => r.city === city && r.beds === 1).sort((a, b) => Math.abs(b.premium_dollars) - Math.abs(a.premium_dollars)).slice(0, 8);
    if (top.length) {
      log(`Top 1BR premiums — ${city}:`);
      for (const r of top) log(`  ${r.amenity}: ${r.premium_dollars > 0 ? "+" : ""}$${r.premium_dollars} (${r.premium_pct > 0 ? "+" : ""}${r.premium_pct}%) | n=${r.sample_size}`);
      log("");
    }
  }
  log("=== COMPLETE ===");
}

main().catch(e => { log(`FATAL: ${e.message}`); process.exit(1); });

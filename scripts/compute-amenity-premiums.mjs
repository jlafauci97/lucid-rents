#!/usr/bin/env node
/**
 * Compute amenity premiums from Dwellsy enrichment + Dewey rent data.
 * Strategy: load amenity data first (315K), then load only matching rents + building info.
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

async function paginateAll(table, select, pageSize = 10000) {
  let all = [], offset = 0;
  while (true) {
    const { data, error } = await supabase.from(table).select(select).order("id").range(offset, offset + pageSize - 1);
    if (error) { log(`  Error ${table} @ ${offset}: ${error.message?.slice(0,80)}`); break; }
    if (!data?.length) break;
    all.push(...data);
    offset += pageSize;
    if (offset % 50000 === 0) log(`   ${table}: ${all.length} rows...`);
    if (data.length < pageSize) break;
    // Small delay to avoid rate limits
    if (offset % 100000 === 0) await new Promise(r => setTimeout(r, 500));
  }
  log(`   ${table}: ${all.length} total`);
  return all;
}

async function main() {
  log("Starting amenity premium computation\n");

  // Step 1a: Load amenity data
  log("1a. Loading Dwellsy amenity data...");
  const meta = await paginateAll("dwellsy_building_meta", "building_id, amenities");
  const amenityMap = new Map();
  const amenityBuildingIds = new Set();
  for (const m of meta) {
    if (m.amenities?.length) {
      amenityMap.set(m.building_id, new Set(m.amenities));
      amenityBuildingIds.add(m.building_id);
    }
  }
  log(`   ${amenityMap.size} buildings with amenities\n`);
  meta.length = 0;

  // Step 1b: Will load building info AFTER we know which building IDs have rents (step 2)
  const buildingInfo = new Map();

  // Step 2: Load all rent data
  log("2. Loading rent data (2024+)...");
  let rents = [], offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("dewey_building_rents")
      .select("building_id, beds, median_rent, month")
      .gte("month", "2024-01-01")
      .gt("median_rent", 0)
      .order("id")
      .range(offset, offset + 10000 - 1);
    if (error) { log(`  Error @ ${offset}: ${error.message?.slice(0,80)}`); break; }
    if (!data?.length) break;
    // Only keep rents for buildings that have amenity data
    for (const r of data) {
      if (amenityBuildingIds.has(r.building_id)) rents.push(r);
    }
    offset += 10000;
    if (offset % 50000 === 0) log(`   scanned ${offset} rent rows, kept ${rents.length}...`);
    if (data.length < 10000) break;
    if (offset % 100000 === 0) await new Promise(r => setTimeout(r, 500));
  }
  log(`   ${rents.length} rent rows (filtered to amenity buildings)\n`);

  // Step 3: Load building metro/zip — simple paginated scan of buildings table
  // Use small pages (5000) with delays to avoid timeouts
  log("3. Loading building metro/zip...");
  const neededIds = new Set(rents.map(r => r.building_id));
  log(`   Need ${neededIds.size} unique buildings`);
  let bOffset = 0, retries = 0;
  while (true) {
    try {
      const { data, error } = await supabase.from("buildings").select("id, metro, zip_code").order("id").range(bOffset, bOffset + 4999);
      if (error) {
        retries++;
        if (retries > 5) { log(`   Too many errors, moving on @ ${bOffset}`); bOffset += 5000; retries = 0; continue; }
        log(`   Error @ ${bOffset}, retry ${retries}: ${error.message?.slice(0,40)}`);
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }
      retries = 0;
      if (!data?.length) break;
      for (const b of data) {
        if (neededIds.has(b.id)) buildingInfo.set(b.id, { metro: b.metro, zip: b.zip_code });
      }
      bOffset += 5000;
      if (bOffset % 50000 === 0) log(`   scanned ${bOffset}, matched ${buildingInfo.size}/${neededIds.size}...`);
      if (data.length < 5000) break;
      // Small delay every 20 pages to be gentle on Supabase
      if (bOffset % 100000 === 0) await new Promise(r => setTimeout(r, 1000));
    } catch (e) {
      log(`   Exception @ ${bOffset}: ${e.message?.slice(0,40)}`);
      await new Promise(r => setTimeout(r, 5000));
      retries++;
      if (retries > 3) { bOffset += 5000; retries = 0; }
    }
  }
  log(`   ${buildingInfo.size} buildings loaded\n`);

  // Step 4: Join and group
  log("4. Joining data...");
  const cityZipBed = new Map();
  let matched = 0;
  for (const r of rents) {
    const bi = buildingInfo.get(r.building_id);
    const amens = amenityMap.get(r.building_id);
    if (!bi?.metro || !bi?.zip || !amens) continue;
    const key = `${bi.metro}|${bi.zip}|${r.beds}`;
    if (!cityZipBed.has(key)) cityZipBed.set(key, []);
    cityZipBed.get(key).push({ rent: parseFloat(r.median_rent), amenities: amens });
    matched++;
  }
  log(`   ${matched} joined rows, ${cityZipBed.size} groups\n`);
  rents.length = 0;

  // Step 5: Compute premiums
  log("5. Computing premiums...");
  const rows = [];
  for (const amenity of AMENITIES) {
    let n = 0;
    for (const [key, entries] of cityZipBed) {
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

  // Step 6: Upsert
  log("6. Upserting...");
  await supabase.from("dewey_amenity_premiums").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from("dewey_amenity_premiums").insert(rows.slice(i, i + 500));
    if (error) log(`   Error batch ${i}: ${error.message?.slice(0,100)}`);
  }
  log(`   Done\n`);

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

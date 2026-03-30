#!/usr/bin/env node
/**
 * Create buildings for ALL unlinked HPD violation BBLs, then link.
 *
 * Step 1: Query ALL distinct BBLs from hpd_violations where building_id IS NULL
 * Step 2: Filter out BBLs that already have a building
 * Step 3: Geocode missing BBLs via PLUTO API and create buildings
 * Step 4: Link all unlinked violations to buildings
 */
import { createRequire } from "module";
import { readFileSync } from "fs";
import { resolve } from "path";

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

const BORO_NAMES = { "1": "Manhattan", "2": "Bronx", "3": "Brooklyn", "4": "Queens", "5": "Staten Island" };
const CONCURRENCY = 25;
const SKIP_LINK = process.argv.includes("--skip-link");
const LINK_ONLY = process.argv.includes("--link-only");

function generateSlug(fullAddress) {
  return fullAddress.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Step 1: Get ALL unique unlinked BBLs by querying per-borough to avoid timeouts
async function getAllUnlinkedBbls() {
  console.log("Querying distinct unlinked BBLs from hpd_violations (by borough)...");
  const allBbls = new Set();

  for (const boroId of ["1", "2", "3", "4", "5"]) {
    const boroName = BORO_NAMES[boroId];
    let offset = 0;
    const batchSize = 10000;

    while (true) {
      const { data, error } = await sb
        .from("hpd_violations")
        .select("bbl")
        .is("building_id", null)
        .not("bbl", "is", null)
        .like("bbl", `${boroId}%`)
        .order("bbl", { ascending: true })
        .range(offset, offset + batchSize - 1);

      if (error) { console.error(`  ${boroName} query error: ${error.message}`); break; }
      if (!data || data.length === 0) break;

      for (const r of data) if (r.bbl) allBbls.add(r.bbl);
      if (data.length < batchSize) break;
      offset += batchSize;
    }

    const boroCount = [...allBbls].filter(b => b.startsWith(boroId)).length;
    console.log(`  ${boroName}: ${boroCount} unique BBLs`);
  }

  return [...allBbls].filter(b => /^\d{10}$/.test(b));
}

// Step 2: Filter out BBLs that already have buildings
async function filterExistingBbls(bbls) {
  console.log(`Checking which of ${bbls.length} BBLs already have buildings...`);
  const existing = new Set();

  for (let i = 0; i < bbls.length; i += 500) {
    const batch = bbls.slice(i, i + 500);
    const { data } = await sb.from("buildings").select("bbl").in("bbl", batch);
    if (data) for (const b of data) existing.add(b.bbl);
  }

  const missing = bbls.filter(b => !existing.has(b));
  console.log(`  ${existing.size} already exist, ${missing.length} need creation`);
  return missing;
}

// Step 3: Geocode a BBL via PLUTO
async function geocodeBbl(bbl) {
  const boro = bbl[0];
  const block = bbl.substring(1, 6);
  const lot = bbl.substring(6, 10);

  // Try PLUTO first
  try {
    const url = `https://data.cityofnewyork.us/resource/64uk-42ks.json?$where=borocode='${boro}' AND block='${block}' AND lot='${lot}'&$limit=1`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data.length > 0) {
        const p = data[0];
        const borough = BORO_NAMES[boro] || "";
        const addr = p.address?.trim() || "";
        const zip = p.zipcode || "";
        if (addr) {
          const parts = addr.match(/^(\S+)\s+(.+)$/);
          return {
            house_number: parts?.[1] || "",
            street_name: parts?.[2] || addr,
            borough, zip_code: zip,
            full_address: `${addr}, ${borough}, NY${zip ? ", " + zip : ""}`,
          };
        }
      }
    }
  } catch {}

  // Fallback: GeoSearch
  try {
    const res = await fetch(`https://geosearch.planninglabs.nyc/v2/search?text=${boro}/${block}/${lot}`);
    if (res.ok) {
      const geo = await res.json();
      if (geo.features?.length > 0) {
        const p = geo.features[0].properties;
        return {
          house_number: p.housenumber || "",
          street_name: p.street || "",
          borough: p.borough || "",
          zip_code: p.postalcode || "",
          full_address: `${p.housenumber || ""} ${p.street || ""}, ${p.borough || ""}, NY${p.postalcode ? ", " + p.postalcode : ""}`.trim(),
        };
      }
    }
  } catch {}

  return null;
}

// Step 3b: Create buildings in concurrent batches
async function createBuildings(bbls) {
  console.log(`\nCreating ${bbls.length} buildings (concurrency=${CONCURRENCY})...\n`);
  let created = 0, failed = 0, processed = 0;

  for (let i = 0; i < bbls.length; i += CONCURRENCY) {
    const batch = bbls.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(async (bbl) => {
      const addr = await geocodeBbl(bbl);
      if (!addr || !addr.full_address || addr.full_address.length < 5) return { bbl, ok: false };

      const slug = generateSlug(addr.full_address);
      const { error } = await sb.from("buildings").upsert({
        bbl, borough: addr.borough, house_number: addr.house_number || null,
        street_name: addr.street_name, zip_code: addr.zip_code,
        full_address: addr.full_address, slug, city: "New York", state: "NY", metro: "new-york",
      }, { onConflict: "bbl" });

      return { bbl, ok: !error };
    }));

    for (const r of results) { r.ok ? created++ : failed++; }
    processed += batch.length;

    if (processed % 500 === 0 || processed === bbls.length) {
      console.log(`  Progress: ${processed}/${bbls.length} (${created} created, ${failed} failed)`);
    }

    // Rate limit — PLUTO API
    if (i + CONCURRENCY < bbls.length) await sleep(200);
  }

  console.log(`\nCreation complete: ${created} created, ${failed} failed\n`);
  return created;
}

// Step 4: Link all unlinked violations
async function linkAll() {
  console.log("Linking all unlinked HPD violations to buildings...");
  let totalLinked = 0;
  let batchNum = 0;

  while (true) {
    batchNum++;
    const { data: unlinked, error } = await sb
      .from("hpd_violations")
      .select("id, bbl")
      .is("building_id", null)
      .not("bbl", "is", null)
      .neq("bbl", "")
      .order("id", { ascending: true })
      .limit(1000);

    if (error || !unlinked || unlinked.length === 0) break;

    const bblSet = [...new Set(unlinked.map(r => r.bbl).filter(Boolean))];
    const bblToBuilding = new Map();

    for (let i = 0; i < bblSet.length; i += 500) {
      const batch = bblSet.slice(i, i + 500);
      const { data: buildings } = await sb.from("buildings").select("id, bbl").in("bbl", batch);
      if (buildings) for (const b of buildings) bblToBuilding.set(b.bbl, b.id);
    }

    // Group by building_id for bulk updates
    const updates = new Map();
    let unmatchable = 0;
    for (const r of unlinked) {
      const bid = r.bbl ? bblToBuilding.get(r.bbl) : undefined;
      if (bid) {
        if (!updates.has(bid)) updates.set(bid, []);
        updates.get(bid).push(r.id);
      } else {
        unmatchable++;
      }
    }

    let batchLinked = 0;
    for (const [buildingId, ids] of updates) {
      const { error: upErr } = await sb.from("hpd_violations").update({ building_id: buildingId }).in("id", ids);
      if (!upErr) batchLinked += ids.length;
    }

    totalLinked += batchLinked;

    if (batchNum % 50 === 0 || batchLinked < 500) {
      console.log(`  Batch ${batchNum}: linked ${batchLinked}/${unlinked.length} (${unmatchable} unmatchable, total: ${totalLinked})`);
    }

    // If most records in batch are unmatchable, we've hit the ceiling
    if (batchLinked === 0 || unmatchable > 900) {
      console.log(`  Stopping — too many unmatchable records (${unmatchable}/1000)`);
      break;
    }
  }

  console.log(`\nTotal linked: ${totalLinked}`);
  return totalLinked;
}

// Main
async function main() {
  if (LINK_ONLY) {
    await linkAll();
    return;
  }

  const allBbls = await getAllUnlinkedBbls();
  console.log(`Found ${allBbls.length} unique valid unlinked BBLs\n`);

  const missingBbls = await filterExistingBbls(allBbls);

  if (missingBbls.length > 0 && !SKIP_LINK) {
    await createBuildings(missingBbls);
  }

  await linkAll();
}

main().catch(console.error);

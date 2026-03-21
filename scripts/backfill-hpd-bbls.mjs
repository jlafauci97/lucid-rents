#!/usr/bin/env node
/**
 * Backfill BBLs for HPD violations that have NULL bbl.
 * Constructs BBL from the record's borough + house_number + street_name
 * by looking up the building table or HPD API.
 *
 * Strategy:
 * 1. Find HPD violations with NULL bbl but valid house_number + street_name
 * 2. Try to match address to existing buildings to get BBL
 * 3. For unmatched: use NYC GeoSearch API to resolve address -> BBL
 * 4. Update the violation record's bbl field
 * 5. Then run linkByBbl logic to link to buildings
 *
 * Usage:
 *   node scripts/backfill-hpd-bbls.mjs
 *   node scripts/backfill-hpd-bbls.mjs --limit=5000
 *   node scripts/backfill-hpd-bbls.mjs --dry-run
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

// Parse .env.local
const envPath = resolve(process.cwd(), ".env.local");
const env = {};
for (const line of readFileSync(envPath, "utf8").split("\n")) {
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
const LIMIT = parseInt(args.limit || "10000", 10);
const DRY_RUN = args["dry-run"] === "true";

const BOROUGH_CODES = {
  manhattan: "1", bronx: "2", brooklyn: "3", queens: "4", "staten island": "5",
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function geosearchBbl(houseNumber, streetName, borough) {
  const boroCode = BOROUGH_CODES[(borough || "").toLowerCase()];
  if (!boroCode || !houseNumber || !streetName) return null;

  const addr = `${houseNumber} ${streetName}, ${borough}, NY`;
  try {
    const url = `https://geosearch.planninglabs.nyc/v2/search?text=${encodeURIComponent(addr)}&size=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const props = data?.features?.[0]?.properties;
    if (props?.addendum?.pad?.bbl) {
      return props.addendum.pad.bbl;
    }
    return null;
  } catch {
    return null;
  }
}

async function main() {
  console.log(`\n=== Backfill HPD Violation BBLs ===`);
  console.log(`Limit: ${LIMIT}, Dry run: ${DRY_RUN}\n`);

  // Step 1: Find violations with NULL bbl but valid address info
  const { data: unlinked, error: queryErr } = await supabase
    .from("hpd_violations")
    .select("id, violation_id, borough, house_number, street_name")
    .is("bbl", null)
    .eq("metro", "nyc")
    .not("street_name", "is", null)
    .not("borough", "is", null)
    .limit(LIMIT);

  if (queryErr) {
    console.error("Query error:", queryErr.message);
    process.exit(1);
  }

  console.log(`Found ${unlinked.length} HPD violations with NULL bbl and valid address`);
  if (unlinked.length === 0) {
    console.log("Nothing to do!");
    process.exit(0);
  }

  // Step 2: Group by address to minimize lookups
  const addrToIds = new Map();
  for (const r of unlinked) {
    const key = `${r.house_number || ""}|${r.street_name}|${r.borough}`;
    if (!addrToIds.has(key)) addrToIds.set(key, []);
    addrToIds.get(key).push(r.id);
  }
  console.log(`Unique addresses: ${addrToIds.size}`);

  // Step 3: Try to find BBL from existing buildings first
  let fromBuildings = 0;
  let fromGeosearch = 0;
  let notFound = 0;
  let updated = 0;

  let processed = 0;
  for (const [key, ids] of addrToIds) {
    const [houseNumber, streetName, borough] = key.split("|");
    processed++;
    if (processed % 100 === 0) {
      console.log(`  Progress: ${processed}/${addrToIds.size} addresses (${updated} BBLs set)`);
    }

    // Try matching to existing building
    const searchAddr = `${houseNumber} ${streetName}`.trim().toUpperCase();
    const { data: buildings } = await supabase
      .from("buildings")
      .select("bbl")
      .ilike("full_address", `%${searchAddr}%`)
      .not("bbl", "is", null)
      .limit(1);

    let bbl = buildings?.[0]?.bbl || null;
    if (bbl) {
      fromBuildings++;
    } else {
      // Try GeoSearch API
      bbl = await geosearchBbl(houseNumber, streetName, borough);
      if (bbl) {
        fromGeosearch++;
      } else {
        notFound++;
        continue;
      }
      // Rate limit geosearch
      await sleep(50);
    }

    if (!bbl || !/^\d{10}$/.test(bbl)) continue;

    // Update all violations at this address
    if (!DRY_RUN) {
      for (let i = 0; i < ids.length; i += 200) {
        const batch = ids.slice(i, i + 200);
        const { error: updateErr } = await supabase
          .from("hpd_violations")
          .update({ bbl })
          .in("id", batch);

        if (updateErr) {
          console.error(`  Update error for ${searchAddr}: ${updateErr.message}`);
        } else {
          updated += batch.length;
        }
      }
    } else {
      updated += ids.length;
    }
  }

  console.log(`\n=== Results ===`);
  console.log(`BBLs from buildings: ${fromBuildings}`);
  console.log(`BBLs from GeoSearch: ${fromGeosearch}`);
  console.log(`Not found: ${notFound}`);
  console.log(`Total violations updated: ${updated}`);
  if (DRY_RUN) console.log(`(DRY RUN — no changes made)`);

  // Step 4: Now link newly-BBL'd records to buildings
  if (!DRY_RUN && updated > 0) {
    console.log(`\nLinking ${updated} records to buildings...`);

    const { data: toLink } = await supabase
      .from("hpd_violations")
      .select("id, bbl")
      .is("building_id", null)
      .not("bbl", "is", null)
      .eq("metro", "nyc")
      .limit(50000);

    if (toLink && toLink.length > 0) {
      const bblSet = [...new Set(toLink.map(r => r.bbl).filter(b => /^\d{10}$/.test(b)))];

      // Fetch building IDs for those BBLs
      const bblToBuilding = new Map();
      for (let i = 0; i < bblSet.length; i += 500) {
        const batch = bblSet.slice(i, i + 500);
        const { data: buildings } = await supabase
          .from("buildings")
          .select("id, bbl")
          .in("bbl", batch);
        if (buildings) {
          for (const b of buildings) bblToBuilding.set(b.bbl, b.id);
        }
      }

      console.log(`Found ${bblToBuilding.size} matching buildings for ${bblSet.length} BBLs`);

      let linked = 0;
      for (const r of toLink) {
        const buildingId = bblToBuilding.get(r.bbl);
        if (!buildingId) continue;

        const { error: linkErr } = await supabase
          .from("hpd_violations")
          .update({ building_id: buildingId })
          .eq("id", r.id);

        if (!linkErr) linked++;
      }

      console.log(`Linked ${linked} violations to buildings`);

      // Update building counts
      const affectedBuildings = new Set(
        toLink.filter(r => bblToBuilding.has(r.bbl)).map(r => bblToBuilding.get(r.bbl))
      );
      console.log(`Updating counts for ${affectedBuildings.size} buildings...`);

      for (const bid of affectedBuildings) {
        const { count } = await supabase
          .from("hpd_violations")
          .select("id", { count: "exact", head: true })
          .eq("building_id", bid);

        await supabase
          .from("buildings")
          .update({ violation_count: count ?? 0 })
          .eq("id", bid);
      }

      console.log("Building counts updated!");
    }
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

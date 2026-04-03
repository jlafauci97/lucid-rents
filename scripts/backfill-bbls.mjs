#!/usr/bin/env node
/**
 * Backfill BBLs for buildings that were created without one.
 * Uses NYC geocoder APIs to resolve address -> BBL.
 *
 * Usage:
 *   node scripts/backfill-bbls.mjs                  # default batch of 500
 *   node scripts/backfill-bbls.mjs --limit=2000     # bigger batch
 *   node scripts/backfill-bbls.mjs --dry-run        # preview without updating
 *   node scripts/backfill-bbls.mjs --delete-empty   # delete buildings with no BBL that can't be resolved
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
const LIMIT = parseInt(args.limit || "500", 10);
const DRY_RUN = args["dry-run"] === "true";
const DELETE_EMPTY = args["delete-empty"] === "true";
const CONCURRENCY = parseInt(args.concurrency || "10", 10);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const BOROUGH_CODES = {
  manhattan: "1",
  "new york": "1",
  bronx: "2",
  brooklyn: "3",
  queens: "4",
  "staten island": "5",
};

function boroCode(borough) {
  return BOROUGH_CODES[(borough || "").toLowerCase()] || null;
}

/**
 * Try to find the BBL for a building using multiple strategies:
 * 1. Check if any data table already has a record at this address with a BBL
 * 2. NYC GeoSearch API (free, no key needed)
 * 3. NYC PLUTO via address search
 */
async function resolveBbl(building) {
  const { house_number, street_name, borough, zip_code } = building;
  if (!house_number || !street_name) return null;

  // Strategy 1: Check existing data tables for matching address + BBL
  const tables = [
    { name: "hpd_violations", houseCol: "house_number", streetCol: "street_name", bblCol: "bbl" },
    { name: "dob_violations", houseCol: "house_number", streetCol: "street_name", bblCol: "bbl" },
  ];

  for (const t of tables) {
    try {
      const { data } = await supabase
        .from(t.name)
        .select(t.bblCol)
        .eq(t.houseCol, house_number)
        .ilike(t.streetCol, street_name)
        .not(t.bblCol, "is", null)
        .limit(1);

      if (data?.length > 0 && data[0][t.bblCol]) {
        const bbl = data[0][t.bblCol].trim();
        if (bbl.length === 10 || bbl.length === 11) {
          return bbl.length === 11 ? bbl.substring(0, 10) : bbl;
        }
      }
    } catch {
      // Skip this table on error
    }
  }

  // Strategy 2: NYC GeoSearch API
  try {
    const query = `${house_number} ${street_name}, ${borough || "New York"}, NY`;
    const url = `https://geosearch.planninglabs.nyc/v2/search?text=${encodeURIComponent(query)}&size=1`;
    const resp = await fetch(url);
    if (resp.ok) {
      const json = await resp.json();
      const feature = json?.features?.[0];
      const pad_bbl = feature?.properties?.addendum?.pad?.bbl;
      if (pad_bbl && pad_bbl.length === 10) return pad_bbl;
    }
  } catch {
    // Fall through
  }

  // Strategy 3: NYC PLUTO address search
  try {
    const boro = boroCode(borough);
    if (boro) {
      const addr = `${house_number} ${street_name}`.toUpperCase();
      const plutoUrl = `https://data.cityofnewyork.us/resource/64uk-42ks.json?$where=address='${encodeURIComponent(addr)}' AND borocode='${boro}'&$limit=1`;
      const resp = await fetch(plutoUrl);
      if (resp.ok) {
        const rows = await resp.json();
        if (rows.length > 0) {
          const r = rows[0];
          const bbl = `${r.borocode}${r.block?.padStart(5, "0")}${r.lot?.padStart(4, "0")}`;
          if (bbl.length === 10) return bbl;
        }
      }
    }
  } catch {
    // Fall through
  }

  return null;
}

async function main() {
  console.log(`Fetching up to ${LIMIT} buildings with null BBL...`);

  const { data: buildings, error } = await supabase
    .from("buildings")
    .select("id, house_number, street_name, borough, zip_code, full_address, slug")
    .is("bbl", null)
    .not("house_number", "is", null)
    .not("street_name", "is", null)
    .limit(LIMIT);

  if (error) {
    console.error("Error fetching buildings:", error.message);
    process.exit(1);
  }

  console.log(`Found ${buildings.length} buildings to process`);

  let resolved = 0;
  let failed = 0;
  let duplicates = 0;
  let errors = [];

  for (let i = 0; i < buildings.length; i += CONCURRENCY) {
    const batch = buildings.slice(i, i + CONCURRENCY);

    const results = await Promise.all(
      batch.map(async (b) => {
        try {
          const bbl = await resolveBbl(b);
          return { building: b, bbl };
        } catch (err) {
          return { building: b, bbl: null, error: err.message };
        }
      })
    );

    for (const { building, bbl, error: err } of results) {
      if (err) {
        errors.push(`${building.full_address}: ${err}`);
        failed++;
        continue;
      }

      if (!bbl) {
        failed++;
        continue;
      }

      if (DRY_RUN) {
        console.log(`  [DRY RUN] ${building.full_address} -> BBL ${bbl}`);
        resolved++;
        continue;
      }

      // Check if another building already has this BBL
      const { data: existing } = await supabase
        .from("buildings")
        .select("id, full_address")
        .eq("bbl", bbl)
        .neq("id", building.id)
        .limit(1);

      if (existing?.length > 0) {
        // Duplicate — this BBL already belongs to another building.
        // Merge: move any linked records to the existing building, then delete this one.
        duplicates++;
        if (!DRY_RUN) {
          const keepId = existing[0].id;
          // Move any records that point to the duplicate building
          const linkTables = [
            "hpd_violations", "dob_violations", "hpd_litigations",
            "evictions", "bedbug_reports", "complaints_311",
            "dob_permits", "sidewalk_sheds", "nypd_complaints",
          ];
          for (const t of linkTables) {
            await supabase.from(t).update({ building_id: keepId }).eq("building_id", building.id);
          }
          // Delete the duplicate
          await supabase.from("buildings").delete().eq("id", building.id);
          console.log(`  [MERGED] ${building.full_address} -> merged into existing (BBL ${bbl})`);
        }
        continue;
      }

      // Update with BBL
      const { error: updateErr } = await supabase
        .from("buildings")
        .update({ bbl })
        .eq("id", building.id);

      if (updateErr) {
        errors.push(`${building.full_address}: update failed — ${updateErr.message}`);
        failed++;
      } else {
        resolved++;
        if (resolved % 50 === 0) {
          console.log(`  Progress: ${resolved} resolved, ${failed} failed, ${duplicates} merged (${i + batch.length}/${buildings.length})`);
        }
      }
    }

    // Rate limit to avoid hammering geocoder
    if (i + CONCURRENCY < buildings.length) {
      await sleep(200);
    }
  }

  console.log(`\nDone!`);
  console.log(`  Resolved: ${resolved}`);
  console.log(`  Duplicates merged: ${duplicates}`);
  console.log(`  Failed/unresolvable: ${failed}`);
  if (errors.length > 0) {
    console.log(`  Errors (first 10):`);
    for (const e of errors.slice(0, 10)) console.log(`    ${e}`);
  }

  // Count remaining
  const { count } = await supabase
    .from("buildings")
    .select("id", { count: "exact", head: true })
    .is("bbl", null);
  console.log(`\n  Remaining buildings with null BBL: ${count}`);
}

main().catch(console.error);

#!/usr/bin/env node
/**
 * Backfill links for Chicago records by address matching.
 * Handles: dob_violations, complaints_311, nypd_complaints where metro='chicago'
 *
 * Usage:
 *   node scripts/backfill-chicago-links.mjs
 *   node scripts/backfill-chicago-links.mjs --table=dob_violations
 *   node scripts/backfill-chicago-links.mjs --dry-run
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

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const args = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => {
    const [k, v] = a.slice(2).split("=");
    return [k, v || "true"];
  })
);
const DRY_RUN = args["dry-run"] === "true";
const TABLE_FILTER = args.table || null;

const TABLES = [
  {
    name: "dob_violations",
    idCol: "id",
    addrCols: ["house_number", "street_name"],
    countCol: "dob_violation_count",
    label: "Chicago Building Violations",
  },
  {
    name: "complaints_311",
    idCol: "unique_key",
    addrCols: ["incident_address"],
    countCol: "complaint_count",
    label: "Chicago 311 Complaints",
  },
  {
    name: "nypd_complaints",
    idCol: "cmplnt_num",
    addrCols: null, // Crime data uses lat/lng, not address
    countCol: null,
    label: "Chicago Crime",
    useGeo: true,
  },
];

function normalizeAddress(addr) {
  if (!addr) return "";
  return addr
    .toUpperCase()
    .replace(/\s+/g, " ")
    .replace(/\s+(APT|UNIT|#|FL|FLOOR|STE|SUITE|RM|ROOM)\b.*$/i, "")
    .trim();
}

async function linkTable({ name, idCol, addrCols, countCol, label, useGeo }) {
  console.log(`\n--- ${label} (${name}) ---`);

  if (useGeo) {
    console.log("  Skipping geo-based linking (crime uses lat/lng proximity, not address match).");
    console.log("  Use a separate geo-linking pass for crime data.");
    return;
  }

  const primaryCol = addrCols[addrCols.length - 1];
  const selectCols = [idCol, ...addrCols].join(", ");

  // Fetch ALL unlinked Chicago records
  let allUnlinked = [];
  let offset = 0;
  const PAGE = 5000;
  while (true) {
    const { data, error } = await supabase
      .from(name)
      .select(selectCols)
      .is("building_id", null)
      .eq("metro", "chicago")
      .not(primaryCol, "is", null)
      .range(offset, offset + PAGE - 1);

    if (error) {
      console.error(`  Query error: ${error.message}`);
      break;
    }
    if (!data || data.length === 0) break;
    allUnlinked = allUnlinked.concat(data);
    if (data.length < PAGE) break;
    offset += PAGE;
  }

  console.log(`  Found ${allUnlinked.length} unlinked records`);
  if (allUnlinked.length === 0) return;

  // Group by normalized address
  const addrToIds = new Map();
  for (const r of allUnlinked) {
    let addr;
    if (addrCols.length > 1) {
      addr = addrCols.map((c) => String(r[c] || "").trim()).filter(Boolean).join(" ");
    } else {
      addr = String(r[addrCols[0]] || "").trim();
    }
    addr = normalizeAddress(addr);
    if (!addr || addr.length < 5) continue;
    if (!addrToIds.has(addr)) addrToIds.set(addr, []);
    addrToIds.get(addr).push(String(r[idCol]));
  }

  console.log(`  Unique addresses: ${addrToIds.size}`);

  let linked = 0;
  let matched = 0;
  let lookups = 0;
  const affectedBuildings = new Set();

  for (const [address, recordIds] of addrToIds) {
    lookups++;
    if (lookups % 500 === 0) {
      console.log(`  Progress: ${lookups}/${addrToIds.size} addresses, ${linked} linked`);
    }

    const { data: buildings } = await supabase
      .from("buildings")
      .select("id")
      .ilike("full_address", `%${address}%`)
      .eq("metro", "chicago")
      .limit(1);

    if (buildings && buildings.length > 0) {
      matched++;
      const buildingId = buildings[0].id;

      if (!DRY_RUN) {
        for (let i = 0; i < recordIds.length; i += 200) {
          const batch = recordIds.slice(i, i + 200);
          const { error: linkErr } = await supabase
            .from(name)
            .update({ building_id: buildingId })
            .in(idCol, batch);

          if (!linkErr) {
            linked += batch.length;
          } else {
            console.error(`  Link error: ${linkErr.message}`);
          }
        }
        affectedBuildings.add(buildingId);
      } else {
        linked += recordIds.length;
      }
    }
  }

  console.log(`  Addresses matched: ${matched}/${addrToIds.size}`);
  console.log(`  Records linked: ${linked}`);
  if (DRY_RUN) console.log(`  (DRY RUN - no changes made)`);

  // Update building counts
  if (!DRY_RUN && affectedBuildings.size > 0 && countCol) {
    console.log(`  Updating counts for ${affectedBuildings.size} buildings...`);
    let countsDone = 0;
    for (const bid of affectedBuildings) {
      const { count } = await supabase
        .from(name)
        .select("id", { count: "exact", head: true })
        .eq("building_id", bid);

      await supabase
        .from("buildings")
        .update({ [countCol]: count ?? 0 })
        .eq("id", bid);

      countsDone++;
      if (countsDone % 200 === 0) {
        console.log(`    Counts: ${countsDone}/${affectedBuildings.size}`);
      }
    }
    console.log(`  Counts updated!`);
  }

  return { linked, matched, total: allUnlinked.length };
}

async function main() {
  console.log(`\n=== Chicago Records Address Linking Backfill ===`);
  console.log(`Dry run: ${DRY_RUN}`);
  if (TABLE_FILTER) console.log(`Table filter: ${TABLE_FILTER}`);

  const tables = TABLE_FILTER
    ? TABLES.filter((t) => t.name === TABLE_FILTER)
    : TABLES;

  for (const table of tables) {
    await linkTable(table);
  }

  console.log(`\n=== Done! ===`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Backfill building_id for ALL unlinked records across all tables.
 * Links by BBL matching to existing buildings.
 * Run: node scripts/backfill-links.mjs
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

const envPath = resolve(process.cwd(), ".env.local");
const env = {};
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, "").replace(/\\n/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const TABLES = [
  { name: "dob_permits", idCol: "id" },
  { name: "sidewalk_sheds", idCol: "id" },
  { name: "dob_violations", idCol: "id" },
  { name: "evictions", idCol: "id" },
  { name: "hpd_violations", idCol: "id" },
  { name: "bedbug_reports", idCol: "id" },
  { name: "hpd_litigations", idCol: "id" },
  { name: "complaints_311", idCol: "id" },
];

async function linkTable(tableName, idCol) {
  console.log(`\n=== Linking ${tableName} ===`);
  let totalLinked = 0;
  let offset = 0;
  let passes = 0;

  while (true) {
    passes++;
    const { data: unlinked, error } = await sb
      .from(tableName)
      .select(`${idCol}, bbl`)
      .is("building_id", null)
      .not("bbl", "is", null)
      .range(offset, offset + 4999);

    if (error) {
      console.error(`  Fetch error: ${error.message}`);
      break;
    }
    if (!unlinked || unlinked.length === 0) break;

    const valid = unlinked.filter(r => r.bbl && /^\d{10}$/.test(r.bbl));
    if (valid.length === 0) {
      offset += unlinked.length;
      if (unlinked.length < 5000) break;
      continue;
    }

    const bblSet = [...new Set(valid.map(r => r.bbl))];

    const bblToBuilding = new Map();
    for (let i = 0; i < bblSet.length; i += 500) {
      const batch = bblSet.slice(i, i + 500);
      const { data: buildings } = await sb
        .from("buildings")
        .select("id, bbl")
        .in("bbl", batch);
      if (buildings) {
        for (const b of buildings) bblToBuilding.set(b.bbl, b.id);
      }
    }

    const buildingToIds = new Map();
    let unmatched = 0;
    for (const r of valid) {
      const buildingId = bblToBuilding.get(r.bbl);
      if (buildingId) {
        if (!buildingToIds.has(buildingId)) buildingToIds.set(buildingId, []);
        buildingToIds.get(buildingId).push(r[idCol]);
      } else {
        unmatched++;
      }
    }

    let batchLinked = 0;
    const entries = [...buildingToIds.entries()];
    // Process 20 buildings concurrently
    for (let i = 0; i < entries.length; i += 20) {
      const chunk = entries.slice(i, i + 20);
      await Promise.all(
        chunk.map(async ([buildingId, ids]) => {
          for (let j = 0; j < ids.length; j += 200) {
            const batch = ids.slice(j, j + 200);
            const { error: updateErr } = await sb
              .from(tableName)
              .update({ building_id: buildingId })
              .in(idCol, batch);
            if (!updateErr) batchLinked += batch.length;
          }
        })
      );
    }

    totalLinked += batchLinked;
    console.log(`  Pass ${passes}: ${valid.length} records, ${bblToBuilding.size} BBL matches, ${batchLinked} linked, ${unmatched} unmatched`);

    if (batchLinked === 0) {
      offset += unlinked.length;
    }

    if (unlinked.length < 5000) break;
    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`  Total linked for ${tableName}: ${totalLinked}`);
  return totalLinked;
}

console.log("Starting backfill linking for all tables...");

let grandTotal = 0;
for (const { name, idCol } of TABLES) {
  grandTotal += await linkTable(name, idCol);
}

console.log(`\n=== DONE! Grand total linked: ${grandTotal} ===`);

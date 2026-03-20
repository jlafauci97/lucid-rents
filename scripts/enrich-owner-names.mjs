#!/usr/bin/env node
/**
 * Enrich buildings with owner_name from NYC PLUTO data.
 * Targets buildings that have a BBL but are missing owner_name.
 *
 * Usage:
 *   node scripts/enrich-owner-names.mjs [--dry-run] [--limit=N] [--borough=Manhattan]
 *
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 */

import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

// Parse .env.local manually (no dotenv)
const envRaw = readFileSync(".env.local", "utf-8");
const env = {};
for (const line of envRaw.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  const val = trimmed.slice(eqIdx + 1).trim().replace(/^"|"$/g, "").replace(/\\n/g, "");
  env[key] = val;
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const PLUTO_ENDPOINT = "https://data.cityofnewyork.us/resource/64uk-42ks.json";

// CLI args
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const limitArg = args.find((a) => a.startsWith("--limit="));
const boroughArg = args.find((a) => a.startsWith("--borough="));
const fetchLimit = limitArg ? parseInt(limitArg.split("=")[1]) : null;
const boroughFilter = boroughArg ? boroughArg.split("=")[1] : null;

async function fetchPlutoByBbls(bbls) {
  const bblList = bbls.map((b) => `'${b}'`).join(",");
  const whereClause = `bbl in(${bblList})`;
  const params = new URLSearchParams({
    $select: "bbl,ownername",
    $where: whereClause,
    $limit: String(bbls.length),
  });
  const url = `${PLUTO_ENDPOINT}?${params.toString()}`;
  const resp = await fetch(url);
  if (!resp.ok) {
    const body = await resp.text();
    console.error(`PLUTO API error: ${resp.status} - ${body.slice(0, 200)}`);
    return [];
  }
  return resp.json();
}

async function getBuildingsMissingOwner(offset, batchSize) {
  let query = supabase
    .from("buildings")
    .select("id,bbl")
    .not("bbl", "is", null)
    .is("owner_name", null)
    .order("id", { ascending: true })
    .range(offset, offset + batchSize - 1);

  if (boroughFilter) {
    query = query.eq("borough", boroughFilter);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Supabase error: ${error.message}`);
  return data || [];
}

async function main() {
  console.log("Owner Name Enrichment via PLUTO");
  console.log("================================");
  if (dryRun) console.log("** DRY RUN **");
  if (boroughFilter) console.log(`Borough: ${boroughFilter}`);
  if (fetchLimit) console.log(`Limit: ${fetchLimit}`);
  console.log();

  let offset = 0;
  const BATCH_SIZE = 1000;
  const PLUTO_BATCH = 100;
  let totalProcessed = 0;
  let totalUpdated = 0;
  let totalNoPluto = 0;
  let totalNoOwner = 0;

  while (true) {
    if (fetchLimit && totalProcessed >= fetchLimit) break;

    const remaining = fetchLimit ? Math.min(BATCH_SIZE, fetchLimit - totalProcessed) : BATCH_SIZE;
    const buildings = await getBuildingsMissingOwner(offset, remaining);
    if (buildings.length === 0) break;

    console.log(`\nBatch: ${buildings.length} buildings missing owner_name (offset ${offset})`);

    for (let i = 0; i < buildings.length; i += PLUTO_BATCH) {
      const chunk = buildings.slice(i, i + PLUTO_BATCH);
      const bbls = chunk.map((b) => b.bbl).filter(Boolean);
      if (bbls.length === 0) continue;

      const plutoData = await fetchPlutoByBbls(bbls);
      const plutoMap = {};
      for (const p of plutoData) {
        if (p.bbl) {
          const cleanBbl = p.bbl.split(".")[0];
          plutoMap[cleanBbl] = p;
        }
      }

      const updatePromises = [];
      for (const building of chunk) {
        const pluto = plutoMap[building.bbl];
        if (!pluto) {
          totalNoPluto++;
          continue;
        }
        if (!pluto.ownername || pluto.ownername.trim() === "") {
          totalNoOwner++;
          continue;
        }

        if (dryRun) {
          console.log(`  Would set ${building.bbl} -> "${pluto.ownername}"`);
          totalUpdated++;
        } else {
          updatePromises.push(
            supabase
              .from("buildings")
              .update({ owner_name: pluto.ownername })
              .eq("id", building.id)
              .then(({ error }) => {
                if (error) {
                  console.error(`  Failed ${building.id}: ${error.message}`);
                } else {
                  totalUpdated++;
                }
              })
          );
        }

        if (updatePromises.length >= 20) {
          await Promise.all(updatePromises);
          updatePromises.length = 0;
        }
      }

      if (updatePromises.length > 0) {
        await Promise.all(updatePromises);
      }

      totalProcessed += chunk.length;
      process.stdout.write(`\r  Processed: ${totalProcessed} | Updated: ${totalUpdated} | No PLUTO: ${totalNoPluto} | No owner in PLUTO: ${totalNoOwner}`);
    }

    // If we got fewer than batch size, we're done
    if (buildings.length < BATCH_SIZE) break;
    offset += buildings.length;

    await new Promise((r) => setTimeout(r, 200));
  }

  console.log("\n\n=== DONE ===");
  console.log(`Total processed: ${totalProcessed}`);
  console.log(`Total updated:   ${totalUpdated}`);
  console.log(`No PLUTO data:   ${totalNoPluto}`);
  console.log(`No owner in PLUTO: ${totalNoOwner}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

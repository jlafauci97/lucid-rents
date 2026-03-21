#!/usr/bin/env node
/**
 * Enrich shell buildings with NYC PLUTO data.
 * Targets buildings that have a BBL but are missing year_built, total_units, etc.
 *
 * Usage:
 *   node scripts/enrich-buildings-pluto.mjs [--dry-run] [--limit=N] [--borough=Manhattan]
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
const PLUTO_FIELDS = "bbl,address,zipcode,yearbuilt,numfloors,unitsres,unitstotal,landuse,bldgclass,ownername,latitude,longitude";

// CLI args
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const limitArg = args.find((a) => a.startsWith("--limit="));
const boroughArg = args.find((a) => a.startsWith("--borough="));
const fetchLimit = limitArg ? parseInt(limitArg.split("=")[1]) : null;
const boroughFilter = boroughArg ? boroughArg.split("=")[1] : null;

function deriveScore(violations, complaints) {
  const total = violations + complaints;
  if (total === 0) return 10;
  const score = Math.max(0, 10 - Math.log10(total + 1) * 3);
  return Math.round(score * 10) / 10;
}

async function fetchPlutoByBbls(bbls, retries = 3) {
  const bblList = bbls.map((b) => `'${b}'`).join(",");
  const whereClause = `bbl in(${bblList})`;
  const params = new URLSearchParams({
    $select: PLUTO_FIELDS,
    $where: whereClause,
    $limit: String(bbls.length),
  });
  const url = `${PLUTO_ENDPOINT}?${params.toString()}`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const resp = await fetch(url);
      if (!resp.ok) {
        const body = await resp.text();
        console.error(`\nPLUTO API error: ${resp.status} ${resp.statusText} - ${body}`);
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 2000 * attempt));
          continue;
        }
        return [];
      }
      return await resp.json();
    } catch (err) {
      console.error(`\nPLUTO fetch error (attempt ${attempt}/${retries}): ${err.message}`);
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      } else {
        return [];
      }
    }
  }
  return [];
}

async function getShellBuildings(afterId, batchSize, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    let query = supabase
      .from("buildings")
      .select("id,bbl,borough,year_built,total_units,num_floors,latitude,longitude,violation_count,complaint_count,overall_score,owner_name,building_class,land_use,residential_units,commercial_units")
      .not("bbl", "is", null)
      .is("year_built", null)
      .order("id", { ascending: true })
      .limit(batchSize);

    if (afterId) {
      query = query.gt("id", afterId);
    }

    if (boroughFilter) {
      query = query.eq("borough", boroughFilter);
    }

    const { data, error } = await query;
    if (error) {
      console.error(`\nSupabase query error (attempt ${attempt}/${retries}): ${error.message}`);
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 3000 * attempt));
        continue;
      }
      throw new Error(`Supabase error after ${retries} attempts: ${error.message}`);
    }
    return data || [];
  }
  return [];
}

async function updateBuilding(id, updates) {
  const { error } = await supabase.from("buildings").update(updates).eq("id", id);
  if (error) {
    console.error(`  Failed to update building ${id}: ${error.message}`);
    return false;
  }
  return true;
}

function mapPlutoToBuilding(pluto, existing) {
  const updates = {};

  if (pluto.yearbuilt && parseInt(pluto.yearbuilt) > 0 && !existing.year_built) {
    updates.year_built = parseInt(pluto.yearbuilt);
  }
  if (pluto.numfloors && parseFloat(pluto.numfloors) > 0 && !existing.num_floors) {
    updates.num_floors = Math.round(parseFloat(pluto.numfloors));
  }
  if (pluto.unitstotal && parseInt(pluto.unitstotal) > 0 && !existing.total_units) {
    updates.total_units = parseInt(pluto.unitstotal);
  }
  if (pluto.unitsres && parseInt(pluto.unitsres) > 0 && !existing.residential_units) {
    updates.residential_units = parseInt(pluto.unitsres);
  }
  if (pluto.landuse && !existing.land_use) {
    updates.land_use = pluto.landuse;
  }
  if (pluto.bldgclass && !existing.building_class) {
    updates.building_class = pluto.bldgclass;
  }
  if (pluto.ownername && !existing.owner_name) {
    updates.owner_name = pluto.ownername;
  }
  if (pluto.latitude && pluto.longitude && !existing.latitude) {
    updates.latitude = parseFloat(pluto.latitude);
    updates.longitude = parseFloat(pluto.longitude);
  }

  // Compute overall_score if we have violation/complaint counts
  if (!existing.overall_score) {
    updates.overall_score = deriveScore(
      existing.violation_count || 0,
      existing.complaint_count || 0
    );
  }

  return Object.keys(updates).length > 0 ? updates : null;
}

async function main() {
  console.log("PLUTO Building Enrichment");
  console.log("========================");
  if (dryRun) console.log("** DRY RUN - no updates will be made **");
  if (boroughFilter) console.log(`Filtering by borough: ${boroughFilter}`);
  if (fetchLimit) console.log(`Limiting to ${fetchLimit} buildings`);
  console.log();

  let lastId = null;
  const BATCH_SIZE = 500;
  const PLUTO_BATCH = 100; // PLUTO API batch size for BBL lookups
  let totalProcessed = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalNoPluto = 0;

  while (true) {
    if (fetchLimit && totalProcessed >= fetchLimit) break;

    const remaining = fetchLimit ? Math.min(BATCH_SIZE, fetchLimit - totalProcessed) : BATCH_SIZE;
    const buildings = await getShellBuildings(lastId, remaining);
    if (buildings.length === 0) break;

    // Update cursor to last ID in batch
    lastId = buildings[buildings.length - 1].id;
    console.log(`Fetched ${buildings.length} shell buildings (cursor after id ${lastId})`);

    // Process in PLUTO API batches
    for (let i = 0; i < buildings.length; i += PLUTO_BATCH) {
      const chunk = buildings.slice(i, i + PLUTO_BATCH);
      const bbls = chunk.map((b) => b.bbl).filter(Boolean);
      if (bbls.length === 0) continue;

      const plutoData = await fetchPlutoByBbls(bbls);
      const plutoMap = {};
      for (const p of plutoData) {
        if (p.bbl) {
          // PLUTO BBLs have decimals like "4160420048.00000000" — normalize to integer string
          const cleanBbl = p.bbl.split(".")[0];
          plutoMap[cleanBbl] = p;
        }
      }

      // Process updates in parallel (limited concurrency)
      const updatePromises = [];
      for (const building of chunk) {
        const pluto = plutoMap[building.bbl];
        if (!pluto) {
          totalNoPluto++;
          continue;
        }

        const updates = mapPlutoToBuilding(pluto, building);
        if (!updates) {
          totalSkipped++;
          continue;
        }

        if (dryRun) {
          console.log(`  Would update ${building.bbl}: ${JSON.stringify(updates)}`);
          totalUpdated++;
        } else {
          updatePromises.push(
            updateBuilding(building.id, updates).then((ok) => {
              if (ok) totalUpdated++;
              else totalSkipped++;
            })
          );
        }

        // Limit concurrency to 20
        if (updatePromises.length >= 20) {
          await Promise.all(updatePromises);
          updatePromises.length = 0;
        }
      }

      if (updatePromises.length > 0) {
        await Promise.all(updatePromises);
      }

      totalProcessed += chunk.length;
      process.stdout.write(`\r  Processed: ${totalProcessed} | Updated: ${totalUpdated} | No PLUTO: ${totalNoPluto} | Skipped: ${totalSkipped}`);
    }

    console.log();

    // Delay between batches to avoid rate limits
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log("\n\n=== DONE ===");
  console.log(`Total processed: ${totalProcessed}`);
  console.log(`Total updated:   ${totalUpdated}`);
  console.log(`No PLUTO data:   ${totalNoPluto}`);
  console.log(`Skipped:         ${totalSkipped}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

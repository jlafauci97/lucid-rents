#!/usr/bin/env node
/**
 * Fix bad BBLs on buildings and enrich with owner_name from PLUTO.
 *
 * For buildings missing owner_name that have a BBL:
 * 1. Check if current BBL resolves in PLUTO -> if yes, just set owner_name
 * 2. If not, use the building's address to look up correct BBL via GeoSearch
 * 3. Update building with correct BBL + owner_name from PLUTO
 *
 * Usage:
 *   node scripts/fix-bbls-and-enrich.mjs [--limit=N] [--dry-run]
 */

import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const envRaw = readFileSync(".env.local", "utf-8");
const env = {};
for (const line of envRaw.split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq === -1) continue;
  env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^"|"$/g, "").replace(/\\n/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const limitArg = args.find((a) => a.startsWith("--limit="));
const fetchLimit = limitArg ? parseInt(limitArg.split("=")[1]) : null;

const PLUTO_API = "https://data.cityofnewyork.us/resource/64uk-42ks.json";
const GEOSEARCH_API = "https://geosearch.planninglabs.nyc/v2/search";

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

let stats = {
  processed: 0,
  plutoHit: 0,
  geoFixed: 0,
  ownerSet: 0,
  bblFixed: 0,
  noAddress: 0,
  noResult: 0,
  errors: 0,
  skippedHasOwner: 0,
};

async function fetchPlutoBatch(bbls) {
  if (bbls.length === 0) return {};
  const bblList = bbls.map(b => `'${b}'`).join(",");
  const params = new URLSearchParams({
    $select: "bbl,ownername",
    $where: `bbl in(${bblList})`,
    $limit: String(bbls.length),
  });
  try {
    const resp = await fetch(`${PLUTO_API}?${params}`);
    if (!resp.ok) return {};
    const data = await resp.json();
    const map = {};
    for (const d of data) {
      if (d.bbl && d.ownername) {
        map[d.bbl.split(".")[0]] = d.ownername;
      }
    }
    return map;
  } catch {
    return {};
  }
}

async function geocodeAddress(houseNumber, streetName, borough, retries = 3) {
  if (!houseNumber || !streetName) return null;
  const query = `${houseNumber} ${streetName}, ${borough || "New York"}, NY`;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const resp = await fetch(`${GEOSEARCH_API}?text=${encodeURIComponent(query)}&size=1`);
      if (!resp.ok) {
        if (attempt < retries - 1) { await sleep(2000 * (attempt + 1)); continue; }
        return null;
      }
      const json = await resp.json();
      const bbl = json?.features?.[0]?.properties?.addendum?.pad?.bbl;
      if (bbl && /^\d{10}$/.test(bbl)) return bbl;
      return null;
    } catch {
      if (attempt < retries - 1) { await sleep(2000 * (attempt + 1)); continue; }
      return null;
    }
  }
  return null;
}

async function main() {
  console.log("Fix BBLs + Enrich Owner Names");
  console.log("==============================");
  if (dryRun) console.log("** DRY RUN **");
  if (fetchLimit) console.log(`Limit: ${fetchLimit}`);
  console.log();

  const BATCH = 500;
  const PLUTO_BATCH = 100;
  const GEO_CONCURRENCY = 5;

  // Scan ALL buildings by ID (fast, indexed) and skip those with owner_name
  // in the script. This avoids the slow `is("owner_name", null)` filter.
  let lastId = null;
  let consecutiveErrors = 0;

  while (true) {
    if (fetchLimit && stats.processed >= fetchLimit) break;
    if (consecutiveErrors >= 10) {
      console.error("\nToo many consecutive errors, stopping.");
      break;
    }

    const remaining = fetchLimit ? Math.min(BATCH, fetchLimit - stats.processed) : BATCH;

    let query = sb
      .from("buildings")
      .select("id,bbl,owner_name,house_number,street_name,borough,full_address")
      .not("bbl", "is", null)
      .order("id", { ascending: true })
      .limit(remaining);

    if (lastId) query = query.gt("id", lastId);

    const { data: allBuildings, error } = await query;
    if (error) {
      console.error("\nDB error:", error.message);
      consecutiveErrors++;
      const backoff = Math.min(10000 * Math.pow(2, consecutiveErrors - 1), 120000);
      console.log(` Retrying in ${backoff/1000}s...`);
      await sleep(backoff);
      continue;
    }
    if (!allBuildings || allBuildings.length === 0) break;
    consecutiveErrors = 0;

    lastId = allBuildings[allBuildings.length - 1].id;

    // Filter to only buildings missing owner_name
    const buildings = allBuildings.filter(b => !b.owner_name);

    // Step 1: Try current BBLs against PLUTO in batches
    const validBbls = buildings.filter(b => /^\d{10}$/.test(b.bbl)).map(b => b.bbl);
    const plutoMap = {};
    for (let i = 0; i < validBbls.length; i += PLUTO_BATCH) {
      const chunk = validBbls.slice(i, i + PLUTO_BATCH);
      const result = await fetchPlutoBatch(chunk);
      Object.assign(plutoMap, result);
    }

    // Categorize buildings
    const directHits = []; // BBL found in PLUTO
    const needsGeo = [];   // BBL not in PLUTO, has address

    for (const b of buildings) {
      if (plutoMap[b.bbl]) {
        directHits.push({ ...b, ownerName: plutoMap[b.bbl] });
        stats.plutoHit++;
      } else if (b.house_number && b.street_name) {
        needsGeo.push(b);
      } else {
        stats.noAddress++;
      }
    }

    // Step 2: Update direct hits (just set owner_name)
    for (const b of directHits) {
      if (!dryRun) {
        await sb.from("buildings").update({ owner_name: b.ownerName }).eq("id", b.id);
      }
      stats.ownerSet++;
    }

    // Step 3: Geocode addresses for buildings where BBL didn't match PLUTO
    for (let i = 0; i < needsGeo.length; i += GEO_CONCURRENCY) {
      const chunk = needsGeo.slice(i, i + GEO_CONCURRENCY);
      const geoResults = await Promise.all(
        chunk.map(async (b) => {
          try {
            const newBbl = await geocodeAddress(b.house_number, b.street_name, b.borough);
            return { building: b, newBbl };
          } catch (e) {
            stats.errors++;
            return { building: b, newBbl: null };
          }
        })
      );

      // Look up owner names for newly resolved BBLs
      const newBbls = geoResults.filter(r => r.newBbl).map(r => r.newBbl);
      let newPlutoMap = {};
      try {
        newPlutoMap = await fetchPlutoBatch(newBbls);
      } catch (e) {
        // PLUTO lookup failed, continue without owner names
      }

      for (const { building, newBbl } of geoResults) {
        if (!newBbl) {
          stats.noResult++;
          continue;
        }

        const updates = {};
        if (newBbl !== building.bbl) {
          updates.bbl = newBbl;
          stats.bblFixed++;
        }
        const owner = newPlutoMap[newBbl];
        if (owner) {
          updates.owner_name = owner;
          stats.ownerSet++;
        }
        stats.geoFixed++;

        if (Object.keys(updates).length > 0 && !dryRun) {
          const { error } = await sb.from("buildings").update(updates).eq("id", building.id);
          if (error) {
            // BBL conflict: another building already has this BBL
            // Just set owner_name without changing BBL
            if (error.message.includes("duplicate") || error.message.includes("unique")) {
              if (updates.owner_name) {
                await sb.from("buildings").update({ owner_name: updates.owner_name }).eq("id", building.id);
              }
            }
            stats.errors++;
          }
        }
      }

      // Rate limit geocoder
      await sleep(100);
    }

    stats.processed += buildings.length;
    const scanned = stats.processed + stats.skippedHasOwner;
    stats.skippedHasOwner = (stats.skippedHasOwner || 0) + (allBuildings.length - buildings.length);
    process.stdout.write(
      `\r  Scanned: ${scanned} | Need fix: ${stats.processed} | Owners set: ${stats.ownerSet} | BBLs fixed: ${stats.bblFixed} | No result: ${stats.noResult} | Errors: ${stats.errors}`
    );

    await sleep(50);
  } // end while

  console.log("\n\n=== DONE ===");
  console.log(`Total processed:  ${stats.processed}`);
  console.log(`PLUTO direct hit: ${stats.plutoHit}`);
  console.log(`Geocode resolved: ${stats.geoFixed}`);
  console.log(`Owners set:       ${stats.ownerSet}`);
  console.log(`BBLs corrected:   ${stats.bblFixed}`);
  console.log(`No address:       ${stats.noAddress}`);
  console.log(`No result:        ${stats.noResult}`);
  console.log(`Errors:           ${stats.errors}`);
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});

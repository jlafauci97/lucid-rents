#!/usr/bin/env node

/**
 * Backfill APNs for LA buildings using spatial (coordinate) queries.
 *
 * For each building with latitude/longitude but no APN, queries the
 * LA County Assessor ArcGIS layer with the building's coordinates to
 * find the parcel it falls within, then updates the APN.
 *
 * This is MUCH more reliable than address matching — 94% of LA buildings
 * have coordinates, and spatial queries bypass address format mismatches.
 *
 * Usage:
 *   node scripts/backfill-apn-spatial.mjs                    # all LA buildings
 *   node scripts/backfill-apn-spatial.mjs --zip=90028        # single zip
 *   node scripts/backfill-apn-spatial.mjs --limit=1000       # first 1000
 *   node scripts/backfill-apn-spatial.mjs --dry-run          # preview only
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env.local");
const envText = fs.readFileSync(envPath, "utf8");
const env = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, "").replace(/\\n/g, "");
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const ARCGIS_URL =
  "https://public.gis.lacounty.gov/public/rest/services/LACounty_Cache/LACounty_Parcel/MapServer/0/query";

// ── CLI flags ────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function flag(name) {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return undefined;
  return args[i + 1];
}
const FLAG_ZIP = flag("zip");
const FLAG_LIMIT = parseInt(flag("limit") || "0", 10) || 0;
const DRY_RUN = args.includes("--dry-run");

// ── Rate limiting ────────────────────────────────────────────────────────
const CONCURRENCY = 75;          // parallel ArcGIS requests
const BATCH_SIZE = 200;          // DB update batch size
const DELAY_BETWEEN_BATCHES = 100; // ms between DB batches
const RETRY_DELAY = 2000;        // ms between retries
const MAX_RETRIES = 3;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── ArcGIS spatial query ─────────────────────────────────────────────────
async function queryParcelByCoords(lat, lng) {
  const params = new URLSearchParams({
    geometry: `${lng},${lat}`,
    geometryType: "esriGeometryPoint",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "APN,SitusAddress,SitusZIP,UseType,YearBuilt1,Units1",
    returnGeometry: "false",
    f: "json",
    inSR: "4326",
  });

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const resp = await fetch(`${ARCGIS_URL}?${params}`, {
        headers: { "User-Agent": "LucidRents-APN-Backfill/1.0" },
      });

      if (!resp.ok) {
        if (resp.status === 429 || resp.status >= 500) {
          await sleep(RETRY_DELAY * (attempt + 1));
          continue;
        }
        return null;
      }

      const data = await resp.json();
      const features = data.features || [];
      if (features.length === 0) return null;

      return features[0].attributes;
    } catch (e) {
      if (attempt < MAX_RETRIES - 1) {
        await sleep(RETRY_DELAY * (attempt + 1));
      }
    }
  }
  return null;
}

// ── Load buildings ───────────────────────────────────────────────────────
async function loadBuildings() {
  console.log("Loading LA buildings with coordinates but no APN...");
  const all = [];
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    let query = supabase
      .from("buildings")
      .select("id, latitude, longitude, zip_code, full_address")
      .eq("metro", "los-angeles")
      .is("apn", null)
      .not("latitude", "is", null)
      .not("longitude", "is", null);

    if (FLAG_ZIP) query = query.eq("zip_code", FLAG_ZIP);

    const { data, error } = await query.range(offset, offset + pageSize - 1);
    if (error) {
      console.error("DB error:", error.message);
      break;
    }
    all.push(...(data || []));
    if (!data || data.length < pageSize) break;
    offset += pageSize;
  }

  if (FLAG_LIMIT && all.length > FLAG_LIMIT) {
    return all.slice(0, FLAG_LIMIT);
  }
  return all;
}

// ── Process buildings in parallel batches ─────────────────────────────────
async function processBatch(buildings, stats) {
  const updates = [];

  // Query ArcGIS in parallel (CONCURRENCY at a time)
  for (let i = 0; i < buildings.length; i += CONCURRENCY) {
    const chunk = buildings.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      chunk.map(async (bldg) => {
        const attrs = await queryParcelByCoords(bldg.latitude, bldg.longitude);
        return { bldg, attrs };
      })
    );

    for (const { bldg, attrs } of results) {
      if (attrs && attrs.APN) {
        // Format APN with dashes: "5033018023" -> "5033-018-023"
        let apn = attrs.APN.replace(/[^0-9]/g, "");
        if (apn.length === 10) {
          apn = `${apn.slice(0, 4)}-${apn.slice(4, 7)}-${apn.slice(7)}`;
        }

        const update = { apn };

        // Also enrich year_built and total_units if available
        if (attrs.YearBuilt1 && attrs.YearBuilt1 !== "0") {
          update.year_built = parseInt(attrs.YearBuilt1, 10) || null;
        }
        if (attrs.Units1 && attrs.Units1 > 0) {
          update.total_units = attrs.Units1;
        }

        updates.push({ id: bldg.id, ...update });
        stats.matched++;
      } else {
        stats.noParcel++;
      }
    }
  }

  // Write to DB in batches
  if (!DRY_RUN && updates.length > 0) {
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = updates.slice(i, i + BATCH_SIZE);
      const promises = batch.map(({ id, ...fields }) =>
        supabase.from("buildings").update(fields).eq("id", id)
      );
      const results = await Promise.all(promises);
      const errors = results.filter((r) => r.error);
      if (errors.length > 0) {
        console.error(`  ${errors.length} update errors in batch`);
      }
      stats.updated += batch.length - errors.length;
      if (i + BATCH_SIZE < updates.length) await sleep(DELAY_BETWEEN_BATCHES);
    }
  } else if (DRY_RUN) {
    stats.updated += updates.length;
  }

  return updates;
}

// ── Main ─────────────────────────────────────────────────────────────────
async function run() {
  console.log("=== LA APN Backfill (Spatial Query) ===");
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  if (FLAG_ZIP) console.log(`Filtering to zip: ${FLAG_ZIP}`);
  if (FLAG_LIMIT) console.log(`Limit: ${FLAG_LIMIT}`);
  console.log();

  const buildings = await loadBuildings();
  console.log(`Found ${buildings.length} buildings to process\n`);

  if (buildings.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  const stats = { matched: 0, noParcel: 0, updated: 0 };
  const PROCESS_BATCH = 500; // process N buildings at a time for progress logging
  const startTime = Date.now();

  for (let i = 0; i < buildings.length; i += PROCESS_BATCH) {
    const batch = buildings.slice(i, i + PROCESS_BATCH);
    await processBatch(batch, stats);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const pct = (((i + batch.length) / buildings.length) * 100).toFixed(1);
    const rate = ((stats.matched / (i + batch.length)) * 100).toFixed(1);
    console.log(
      `  [${pct}%] ${i + batch.length}/${buildings.length} processed | ` +
        `${stats.matched} matched (${rate}%) | ${elapsed}s elapsed`
    );
  }

  console.log();
  console.log("=== Summary ===");
  console.log(`Buildings processed: ${buildings.length}`);
  console.log(`APNs found:         ${stats.matched} (${((stats.matched / buildings.length) * 100).toFixed(1)}%)`);
  console.log(`No parcel found:    ${stats.noParcel}`);
  console.log(`DB updated:         ${stats.updated}`);
  console.log(`Time:               ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  if (DRY_RUN) console.log("(dry run — no writes performed)");
}

run().catch(console.error);

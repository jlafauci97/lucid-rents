#!/usr/bin/env node

/**
 * Ingest FEMA National Flood Hazard Layer (NFHL) polygons into flood_zones.
 *
 * Sources:
 *   - FEMA Hazards Map Service (public, no auth, free)
 *   - Layer 28: Flood Hazard Zones (polygons keyed by DFIRM_ID = county FIPS)
 *
 * Coverage ingested:
 *   - Miami-Dade County (FIPS 12086) → metro='miami'      (~3,637 polygons)
 *   - Harris County (FIPS 48201)     → metro='houston'    (~10,775 polygons)
 *
 * The script paginates the FEMA ArcGIS REST API, converts each feature's
 * geometry to a WKT MULTIPOLYGON via PostGIS (letting the DB do the conversion
 * avoids shipping a Node GeoJSON-to-WKT library), and upserts into
 * `flood_zones` keyed on (metro, zone_id).
 *
 * Idempotent: re-running skips rows with matching (metro, zone_id).
 *
 * Usage:
 *   node scripts/ingest-fema-nfhl.mjs                           # both counties
 *   node scripts/ingest-fema-nfhl.mjs --metro=miami             # Miami only
 *   node scripts/ingest-fema-nfhl.mjs --metro=houston           # Houston only
 *   node scripts/ingest-fema-nfhl.mjs --dry-run
 *
 * Plan: docs/superpowers/plans/2026-04-10-fema-flood-zones.md
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

// --- Env loading ------------------------------------------------------------
const envPath = resolve(process.cwd(), ".env.local");
const env = {};
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, "").replace(/\\n/g, "");
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// --- CLI args ---------------------------------------------------------------
const args = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => {
    const [k, v] = a.slice(2).split("=");
    return [k, v === undefined ? "true" : v];
  })
);
const METRO_FILTER = args.metro || null;
const DRY_RUN = args["dry-run"] === "true";
const START_OFFSET = args["start-offset"] ? parseInt(args["start-offset"], 10) : 0;

// Retry wrapper — returns null if the operation keeps failing.
async function withRetry(fn, label, maxAttempts = 4) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt === maxAttempts) {
        console.error(`  ${label}: failed after ${attempt} attempts — ${msg}`);
        return null;
      }
      const backoff = Math.min(2000 * 2 ** (attempt - 1), 20_000);
      console.warn(`  ${label}: attempt ${attempt} failed (${msg.slice(0, 80)}), retrying in ${backoff}ms`);
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  return null;
}

// --- FEMA NFHL service -----------------------------------------------------
const NFHL_LAYER_URL =
  "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28";
// FEMA NFHL layer 28 advertises maxRecordCount=2000, but in practice
// requests of 500+ geometries return HTTP 500 ("Error performing query
// operation"). 200 works reliably. Bumping beyond this is asking for pain.
const PAGE_SIZE = 200;

const COUNTIES = [
  { metro: "miami", fips: "12086", label: "Miami-Dade" },
  { metro: "houston", fips: "48201", label: "Harris County" },
];

// --- Helpers ---------------------------------------------------------------

async function countZones(fips) {
  const url = `${NFHL_LAYER_URL}/query?where=DFIRM_ID+LIKE+'${fips}%25'&returnCountOnly=true&f=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FEMA count query failed: ${res.status}`);
  return (await res.json()).count;
}

async function fetchPage(fips, offset) {
  // Return features as GeoJSON — ArcGIS supports f=geojson on query endpoints
  // which gives us standard MULTIPOLYGON coordinates that PostGIS can parse
  // via ST_GeomFromGeoJSON. Outfields include everything we need for upsert.
  const params = new URLSearchParams({
    where: `DFIRM_ID LIKE '${fips}%'`,
    outFields: "FLD_AR_ID,FLD_ZONE,ZONE_SUBTY,STATIC_BFE,DFIRM_ID",
    returnGeometry: "true",
    outSR: "4326",
    f: "geojson",
    resultOffset: String(offset),
    resultRecordCount: String(PAGE_SIZE),
  });
  const url = `${NFHL_LAYER_URL}/query?${params}`;
  const result = await withRetry(
    async () => {
      const res = await fetch(url, { signal: AbortSignal.timeout(90_000) });
      if (!res.ok) throw new Error(`FEMA ${res.status} at offset ${offset}`);
      return res.json();
    },
    `fetchPage offset=${offset}`,
    4
  );
  // On persistent failure, return an empty features array so the loop
  // advances past the bad offset rather than crashing the whole run.
  return result || { features: [] };
}

/**
 * Upsert a batch of GeoJSON features into flood_zones.
 *
 * Uses the `upsert_flood_zones_batch` RPC which accepts a JSONB array and
 * upserts all rows in a single statement. This is ~20x faster than the
 * per-row `upsert_flood_zone` RPC (first Miami run was ~100 rows/min; batch
 * form does ~2000 rows/min).
 */
async function upsertBatch(features, metro) {
  if (features.length === 0) return 0;

  const rows = features
    .map((feat) => {
      const props = feat.properties || {};
      const zoneId = props.FLD_AR_ID;
      const zoneCode = props.FLD_ZONE;
      if (!zoneId || !zoneCode || !feat.geometry) return null;
      // ArcGIS may return Polygon or MultiPolygon. Normalize to MultiPolygon.
      let geometry = feat.geometry;
      if (geometry.type === "Polygon") {
        geometry = { type: "MultiPolygon", coordinates: [geometry.coordinates] };
      }
      return {
        metro,
        zone_id: String(zoneId),
        zone_code: String(zoneCode),
        zone_subtype: props.ZONE_SUBTY ? String(props.ZONE_SUBTY) : null,
        bfe:
          typeof props.STATIC_BFE === "number" && props.STATIC_BFE > -9000
            ? props.STATIC_BFE
            : null,
        // Pass geometry as a string so the RPC can call ST_GeomFromGeoJSON
        geometry: JSON.stringify(geometry),
      };
    })
    .filter(Boolean);

  if (DRY_RUN) return rows.length;
  if (rows.length === 0) return 0;

  const result = await withRetry(
    async () => {
      const { data, error } = await supabase.rpc("upsert_flood_zones_batch", {
        p_features: rows,
      });
      if (error) throw new Error(error.message);
      return typeof data === "number" ? data : rows.length;
    },
    `upsertBatch(${rows.length})`,
    4
  );
  return result ?? 0;
}

// --- Main ------------------------------------------------------------------

async function ingestCounty({ metro, fips, label }) {
  console.log(`\n=== ${label} (metro=${metro}, DFIRM_ID LIKE '${fips}%') ===`);

  const expectedCount = await countZones(fips);
  console.log(`Expected ${expectedCount} flood zone polygons from FEMA`);
  if (START_OFFSET > 0) console.log(`Starting from offset ${START_OFFSET}`);

  let offset = START_OFFSET;
  let totalUpserted = 0;
  let totalFetched = 0;
  let consecutiveEmpty = 0;

  while (offset < expectedCount) {
    const startMs = Date.now();
    const json = await fetchPage(fips, offset);
    const features = json.features || [];

    if (features.length === 0) {
      // Skip bad offset and keep going — maxAttempts of retries already failed.
      consecutiveEmpty++;
      console.warn(
        `  offset ${offset}: empty page (${consecutiveEmpty} consecutive). Skipping to offset ${offset + PAGE_SIZE}.`
      );
      if (consecutiveEmpty >= 5) {
        console.error(`  Too many consecutive empty pages — aborting.`);
        break;
      }
      offset += PAGE_SIZE;
      continue;
    }
    consecutiveEmpty = 0;

    const upserted = await upsertBatch(features, metro);
    totalFetched += features.length;
    totalUpserted += upserted;

    console.log(
      JSON.stringify({
        evt: "page",
        metro,
        offset,
        fetched: features.length,
        upserted,
        total_fetched: totalFetched,
        total_upserted: totalUpserted,
        expected: expectedCount,
        page_ms: Date.now() - startMs,
      })
    );

    if (features.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  console.log(
    `[${label}] Done. Fetched ${totalFetched}, upserted ${totalUpserted} of expected ${expectedCount}.`
  );
}

async function main() {
  console.log("=== FEMA NFHL Ingestion ===");
  if (DRY_RUN) console.log("[DRY RUN] No data will be written.");

  const counties = METRO_FILTER
    ? COUNTIES.filter((c) => c.metro === METRO_FILTER)
    : COUNTIES;

  if (counties.length === 0) {
    console.error(`Unknown metro: ${METRO_FILTER}. Valid: miami, houston`);
    process.exit(1);
  }

  for (const county of counties) {
    await ingestCounty(county);
  }

  console.log("\n=== All done. ===");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

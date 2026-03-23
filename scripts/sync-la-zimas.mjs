#!/usr/bin/env node

/**
 * Sync LA Planning Cases from ZIMAS ArcGIS REST API
 * Source: https://zimas.lacity.org/arcgis/rest/services/D_CASES_WDI_PWA/MapServer/2/query
 *
 * Usage:
 *   node scripts/sync-la-zimas.mjs
 *   node scripts/sync-la-zimas.mjs --limit=2000
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

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

const args = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => {
    const [k, v] = a.slice(2).split("=");
    return [k, v || "true"];
  })
);

const LIMIT = parseInt(args.limit || "5000", 10);
const PAGE_SIZE = 1000;
const BATCH = 200;
const SOURCE = "la_zimas";
const BASE_URL = "https://zimas.lacity.org/arcgis/rest/services/D_CASES_WDI_PWA/MapServer/2/query";

const CASE_TYPE_CATEGORY = {
  CPC: "zoning_change",
  ZA: "zoning_change",
  DIR: "zoning_change",
  APC: "zoning_change",
  CUB: "new_development",
  "Conditional Use": "new_development",
  "Coastal Development Permit": "zoning_change",
  ENV: "other",
  HPO: "building_safety",
  "Building Line": "zoning_change",
  "Certificate of Compliance": "other",
  CHC: "building_safety",
  Temporary: "other",
  PRIOR: "other",
};

function categorize(caseType) {
  return CASE_TYPE_CATEGORY[caseType] || "other";
}

function normalizeStatus(statusCode) {
  if (statusCode === 2) return "completed";
  if (statusCode === 3) return "withdrawn";
  return "active";
}

function getCentroid(geometry) {
  if (!geometry || !geometry.rings || geometry.rings.length === 0) return null;
  const ring = geometry.rings[0];
  let sumX = 0, sumY = 0;
  for (const [x, y] of ring) {
    sumX += x;
    sumY += y;
  }
  return {
    lng: sumX / ring.length,
    lat: sumY / ring.length,
  };
}

async function main() {
  console.log(`\n=== Syncing LA ZIMAS Planning Cases ===`);
  console.log(`Limit: ${LIMIT}\n`);

  let offset = 0;
  let totalFetched = 0;
  let totalUpserted = 0;

  while (totalFetched < LIMIT) {
    const fetchSize = Math.min(PAGE_SIZE, LIMIT - totalFetched);
    const params = new URLSearchParams({
      where: "1=1",
      outFields: "CASE_NBR,CASE_TYPE,CASE_ID,STATUS",
      returnGeometry: "true",
      f: "json",
      resultRecordCount: String(fetchSize),
      resultOffset: String(offset),
      orderByFields: "CASE_ID DESC",
    });

    console.log(`Fetching ZIMAS cases ${offset}-${offset + fetchSize}...`);
    const res = await fetch(`${BASE_URL}?${params}`);
    if (!res.ok) {
      console.error(`ArcGIS API error: ${res.status}`);
      break;
    }

    const json = await res.json();
    const features = json.features;
    if (!features || features.length === 0) {
      console.log("No more records.");
      break;
    }

    const rows = [];
    for (const f of features) {
      const attrs = f.attributes;
      const caseNbr = attrs.CASE_NBR;
      if (!caseNbr) continue;

      const centroid = getCentroid(f.geometry);
      const caseType = attrs.CASE_TYPE || "";

      rows.push({
        metro: "los-angeles",
        source: SOURCE,
        external_id: caseNbr,
        title: caseType ? `${caseType} - ${caseNbr}` : caseNbr,
        type: "land_use",
        status: normalizeStatus(attrs.STATUS),
        category: categorize(caseType),
        borough: null,
        council_district: null,
        neighborhood: null,
        sponsor: null,
        intro_date: "2020-01-01",
        last_action_date: null,
        hearing_date: null,
        source_url: `https://planning.lacity.gov/pdiscaseinfo/search/encoded/${encodeURIComponent(caseNbr)}`,
        latitude: centroid?.lat || null,
        longitude: centroid?.lng || null,
        raw_data: attrs,
        updated_at: new Date().toISOString(),
      });
    }

    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const { error } = await supabase
        .from("proposals")
        .upsert(batch, { onConflict: "source,external_id" });
      if (error) {
        console.error("  Upsert error:", error.message);
      } else {
        totalUpserted += batch.length;
      }
    }

    totalFetched += features.length;
    offset += features.length;
    console.log(`  Processed ${features.length} cases (total: ${totalUpserted} upserted)`);

    if (features.length < fetchSize) break;
  }

  console.log(`\nLA ZIMAS: ${totalUpserted} upserted\n`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

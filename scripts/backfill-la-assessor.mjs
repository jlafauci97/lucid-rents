#!/usr/bin/env node

/**
 * Backfill LA building details from LA County Assessor ArcGIS.
 * Updates year_built, total_units, latitude, longitude for LA buildings.
 *
 * Source: LA County Assessor Parcel MapServer
 * https://public.gis.lacounty.gov/public/rest/services/LACounty_Cache/LACounty_Parcel/MapServer/0
 *
 * Usage:
 *   node scripts/backfill-la-assessor.mjs
 *   node scripts/backfill-la-assessor.mjs --limit=5000
 *   node scripts/backfill-la-assessor.mjs --zip=90028
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

const args = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => {
    const [k, v] = a.slice(2).split("=");
    return [k, v || "true"];
  })
);
const LIMIT = parseInt(args.limit || "50000", 10);
const ZIP_FILTER = args.zip || "";
const CONCURRENCY = 10;

const ASSESSOR_URL = "https://public.gis.lacounty.gov/public/rest/services/LACounty_Cache/LACounty_Parcel/MapServer/0/query";

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function queryAssessor(zip, offset = 0) {
  const where = `SitusZIP LIKE '${zip}%' AND UseType LIKE '%Residential%'`;
  const params = new URLSearchParams({
    where,
    outFields: "AIN,SitusAddress,SitusZIP,YearBuilt1,Units1,Bedrooms1,Bathrooms1,SQFTmain1,CENTER_LAT,CENTER_LON",
    resultRecordCount: "1000",
    resultOffset: String(offset),
    f: "json",
  });

  const res = await fetch(`${ASSESSOR_URL}?${params}`);
  if (!res.ok) throw new Error(`Assessor API ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(`Assessor error: ${data.error.message}`);
  return data.features?.map((f) => f.attributes) || [];
}

async function main() {
  console.log("\n=== LA Assessor Data Backfill ===\n");

  // Get LA zip codes from our buildings
  const zips = ZIP_FILTER ? [ZIP_FILTER] : [];
  if (!ZIP_FILTER) {
    console.log("Loading LA zip codes from buildings...");
    const { data } = await supabase
      .from("zip_centroids")
      .select("zip_code")
      .eq("metro", "los-angeles");
    if (data) {
      for (const z of data) zips.push(z.zip_code);
    }
    console.log(`  Found ${zips.length} LA zip codes\n`);
  }

  let totalUpdated = 0;
  let totalSkipped = 0;

  for (const zip of zips) {
    if (totalUpdated >= LIMIT) break;

    let offset = 0;
    let zipUpdated = 0;

    while (true) {
      let records;
      try {
        records = await queryAssessor(zip, offset);
      } catch (err) {
        console.error(`  ${zip} error at offset ${offset}: ${err.message}`);
        break;
      }

      if (!records || records.length === 0) break;

      // Build address lookup for this batch
      const updates = [];
      for (const r of records) {
        if (!r.SitusAddress) continue;
        const addr = r.SitusAddress.trim().toUpperCase();
        const rzip = (r.SitusZIP || "").slice(0, 5);
        const slug = addr.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
        const fullSlug = `${slug}-los-angeles-ca-${rzip}`;

        updates.push({
          slug: fullSlug,
          year_built: r.YearBuilt1 ? parseInt(r.YearBuilt1, 10) : null,
          total_units: r.Units1 || null,
          latitude: r.CENTER_LAT || null,
          longitude: r.CENTER_LON || null,
        });
      }

      // Update buildings by slug match (concurrent)
      for (let i = 0; i < updates.length; i += CONCURRENCY) {
        const batch = updates.slice(i, i + CONCURRENCY);
        const results = await Promise.all(batch.map(async (u) => {
          const updateData = {};
          if (u.year_built) updateData.year_built = u.year_built;
          if (u.total_units) updateData.total_units = u.total_units;
          if (u.latitude && u.longitude) {
            updateData.latitude = u.latitude;
            updateData.longitude = u.longitude;
          }

          if (Object.keys(updateData).length === 0) return 0;

          const { count } = await supabase
            .from("buildings")
            .update(updateData, { count: "exact" })
            .eq("slug", u.slug)
            .eq("metro", "los-angeles");
          return count || 0;
        }));

        zipUpdated += results.reduce((a, b) => a + b, 0);
      }

      offset += records.length;
      if (records.length < 1000) break;
      await sleep(200); // Rate limit
    }

    totalUpdated += zipUpdated;
    if (zipUpdated > 0) {
      console.log(`  ${zip}: updated ${zipUpdated} buildings (total: ${totalUpdated})`);
    }
  }

  console.log(`\n✅ Updated ${totalUpdated} LA buildings with assessor data`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

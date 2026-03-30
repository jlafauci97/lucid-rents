#!/usr/bin/env node
/**
 * Backfill zip_code for Chicago crime records using nearest zip centroid.
 * Groups records by assigned zip and does bulk updates — much faster
 * than individual row updates.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

const envPath = resolve(process.cwd(), ".env.local");
const env = {};
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, "");
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: centroids } = await supabase
  .from("zip_centroids")
  .select("zip_code, avg_lat, avg_lon")
  .eq("metro", "chicago");

console.log(`Loaded ${centroids.length} Chicago zip centroids`);

function findNearestZip(lat, lng) {
  let bestZip = null, bestDist = Infinity;
  for (const c of centroids) {
    const d = (lat - c.avg_lat) ** 2 + (lng - c.avg_lon) ** 2;
    if (d < bestDist) { bestDist = d; bestZip = c.zip_code; }
  }
  return bestZip;
}

const FETCH_BATCH = 10000;
let total = 0;

while (true) {
  const { data: records, error } = await supabase
    .from("nypd_complaints")
    .select("id, latitude, longitude")
    .eq("metro", "chicago")
    .is("zip_code", null)
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .limit(FETCH_BATCH);

  if (error) { console.error("Fetch error:", error.message); break; }
  if (!records || records.length === 0) { console.log("No more records to process."); break; }

  // Group IDs by their nearest zip code
  const byZip = {};
  for (const r of records) {
    const zip = findNearestZip(r.latitude, r.longitude);
    if (!zip) continue;
    (byZip[zip] ??= []).push(r.id);
  }

  // Bulk update: one call per zip per chunk (max ~55 zips vs 10000 individual rows)
  for (const [zip, ids] of Object.entries(byZip)) {
    for (let i = 0; i < ids.length; i += 1000) {
      const chunk = ids.slice(i, i + 1000);
      const { error: uErr } = await supabase
        .from("nypd_complaints")
        .update({ zip_code: zip })
        .in("id", chunk);
      if (uErr) console.error(`  Error updating zip ${zip}: ${uErr.message}`);
    }
  }

  total += records.length;
  console.log(`  Processed ${records.length} records (total: ${total})`);
}

console.log(`\nDone! Total records with zip codes assigned: ${total}`);

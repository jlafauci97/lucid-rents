#!/usr/bin/env node
/**
 * Batch geocode buildings using NYC PLUTO dataset.
 * Run: node scripts/geocode-buildings.mjs
 */
import { createRequire } from "module";
import { readFileSync } from "fs";
import { resolve } from "path";

// Parse .env.local manually (no dotenv dependency)
const envPath = resolve(process.cwd(), ".env.local");
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const idx = trimmed.indexOf("=");
  if (idx === -1) continue;
  const key = trimmed.slice(0, idx).trim();
  const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "").replace(/\\n$/g, "");
  if (!process.env[key]) process.env[key] = val;
}

const require = createRequire(import.meta.url);
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PLUTO_API = "https://data.cityofnewyork.us/resource/64uk-42ks.json";
const BATCH_SIZE = 500;

async function fetchPlutoCoords(bbls) {
  const whereClause = bbls.join(",");
  const url = `${PLUTO_API}?$select=bbl,latitude,longitude&$where=bbl in(${whereClause})&$limit=${bbls.length}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`PLUTO API ${res.status}`);
  return res.json();
}

async function main() {
  let totalUpdated = 0;
  let offset = 0;
  let hasMore = true;

  console.log("Starting PLUTO geocoding backfill...");

  while (hasMore) {
    // Get batch of buildings missing coords
    const { data: buildings, error } = await supabase
      .from("buildings")
      .select("id, bbl")
      .is("latitude", null)
      .not("bbl", "is", null)
      .neq("bbl", "")
      .order("id", { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      console.error("Fetch error:", error.message);
      break;
    }

    if (!buildings || buildings.length === 0) {
      hasMore = false;
      break;
    }

    // Build BBL map
    const bblMap = new Map();
    for (const b of buildings) {
      const bbl = b.bbl?.trim();
      if (!bbl) continue;
      if (!bblMap.has(bbl)) bblMap.set(bbl, []);
      bblMap.get(bbl).push(b.id);
    }

    const uniqueBbls = Array.from(bblMap.keys());
    if (uniqueBbls.length === 0) {
      offset += BATCH_SIZE;
      continue;
    }

    // Fetch PLUTO data
    let plutoData;
    try {
      plutoData = await fetchPlutoCoords(uniqueBbls);
    } catch (err) {
      console.error(`PLUTO fetch failed at offset ${offset}:`, err.message);
      offset += BATCH_SIZE;
      continue;
    }

    // Update buildings in parallel
    let batchUpdated = 0;
    const updates = [];

    for (const p of plutoData) {
      const lat = parseFloat(p.latitude);
      const lng = parseFloat(p.longitude);
      if (isNaN(lat) || isNaN(lng)) continue;
      if (lat < 40.4 || lat > 41.0 || lng < -74.3 || lng > -73.6) continue;

      const cleanBbl = p.bbl.split(".")[0];
      const buildingIds = bblMap.get(cleanBbl);
      if (!buildingIds) continue;

      updates.push(
        supabase
          .from("buildings")
          .update({ latitude: lat, longitude: lng })
          .in("id", buildingIds)
          .then(({ error: updateErr }) => {
            if (updateErr) {
              console.error(`Update error for BBL ${cleanBbl}:`, updateErr.message);
            } else {
              batchUpdated += buildingIds.length;
            }
          })
      );
    }

    await Promise.all(updates);
    totalUpdated += batchUpdated;

    // If we updated any, the next query will naturally skip them (latitude IS NULL)
    // Only increment offset if we didn't update anything (unmatched BBLs)
    if (batchUpdated === 0) {
      offset += BATCH_SIZE;
    }
    // If we updated some, keep offset same since updated rows drop out of the NULL filter

    console.log(
      `Batch at offset ${offset}: ${buildings.length} buildings, ${plutoData.length} PLUTO matches, ${batchUpdated} updated. Total: ${totalUpdated}`
    );

    // Small delay to avoid rate limiting
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\nDone! Total buildings geocoded: ${totalUpdated}`);

  // Final count
  const { data: countData } = await supabase
    .from("buildings")
    .select("id", { count: "exact", head: true })
    .is("latitude", null);

  console.log(`Buildings still missing coords: ${countData?.length ?? "unknown"}`);
}

main().catch(console.error);

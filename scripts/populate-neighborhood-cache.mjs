#!/usr/bin/env node
/**
 * Populate neighborhood_stats_cache table from buildings data.
 * Run: node scripts/populate-neighborhood-cache.mjs
 */
import { config } from "dotenv";
config({ path: ".env.local" });

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const CITIES = ["nyc", "los-angeles", "chicago", "miami", "houston"];

async function fetchBuildingStats(city) {
  const pageSize = 5000;
  let lastId = "00000000-0000-0000-0000-000000000000";
  const zipStats = new Map();
  let total = 0;

  while (true) {
    const url = `${SB_URL}/rest/v1/buildings?metro=eq.${city}&zip_code=not.is.null&id=gt.${lastId}&select=id,zip_code,overall_score,violation_count&order=id.asc&limit=${pageSize}`;
    let res;
    for (let attempt = 0; attempt < 3; attempt++) {
      res = await fetch(url, { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });
      if (res.ok) break;
      if (res.status === 504 && attempt < 2) { await new Promise(r => setTimeout(r, 2000)); continue; }
      throw new Error(`Fetch failed: ${res.status}`);
    }
    const data = await res.json();
    if (data.length === 0) break;

    for (const b of data) {
      if (!b.zip_code) continue;
      if (!zipStats.has(b.zip_code)) zipStats.set(b.zip_code, { count: 0, scoreSum: 0, scoreCount: 0, violations: 0 });
      const s = zipStats.get(b.zip_code);
      s.count++;
      if (b.overall_score != null) { s.scoreSum += Number(b.overall_score); s.scoreCount++; }
      s.violations += Number(b.violation_count || 0);
    }

    lastId = data[data.length - 1].id;
    total += data.length;
    process.stdout.write(`  ${city}: ${total.toLocaleString()} buildings (${zipStats.size} zips)\r`);
    if (data.length < pageSize) break;
  }
  console.log(`  ${city}: ${total.toLocaleString()} buildings total, ${zipStats.size} zip codes`);
  return zipStats;
}

async function upsertCache(city, zipStats) {
  const entries = [...zipStats].map(([zip, s]) => ({
    metro: city, zip_code: zip, building_count: s.count,
    avg_score: s.scoreCount > 0 ? Number((s.scoreSum / s.scoreCount).toFixed(2)) : null,
    total_violations: s.violations, updated_at: new Date().toISOString(),
  }));
  for (let i = 0; i < entries.length; i += 100) {
    const batch = entries.slice(i, i + 100);
    const res = await fetch(`${SB_URL}/rest/v1/neighborhood_stats_cache`, {
      method: "POST", headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(batch),
    });
    if (!res.ok) console.error(`Upsert failed: ${res.status} ${await res.text()}`);
  }
  console.log(`  ${city}: upserted ${entries.length} zip code stats\n`);
}

async function main() {
  console.log("Populating neighborhood_stats_cache...\n");
  for (const city of CITIES) { console.log(`Processing ${city}...`); await upsertCache(city, await fetchBuildingStats(city)); }
  console.log("Done!");
}

main().catch(e => { console.error(e); process.exit(1); });

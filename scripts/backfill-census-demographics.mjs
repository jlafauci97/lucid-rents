#!/usr/bin/env node
import { config } from "dotenv";
config({ path: ".env.local" });

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function getTrackedZips() {
  const all = [];
  let offset = 0;
  while (true) {
    const res = await fetch(`${SB_URL}/rest/v1/neighborhood_stats_cache?select=zip_code&order=zip_code&offset=${offset}&limit=1000`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });
    const data = await res.json();
    if (data.length === 0) break;
    all.push(...data.map((r) => r.zip_code));
    offset += data.length;
    if (data.length < 1000) break;
  }
  return [...new Set(all)];
}

async function main() {
  console.log("Backfilling census demographics...\n");
  const zips = await getTrackedZips();
  console.log(`Tracking ${zips.length} zip codes`);

  console.log("Fetching Census ACS data...");
  const res = await fetch("https://api.census.gov/data/2022/acs/acs5?get=NAME,B01003_001E,B19013_001E,B25003_001E,B25003_003E,B01002_001E&for=zip%20code%20tabulation%20area:*");
  if (!res.ok) throw new Error(`Census API error: ${res.status}`);
  const raw = await res.json();
  const headers = raw[0];
  const zipSet = new Set(zips);
  const results = [];

  for (let i = 1; i < raw.length; i++) {
    const row = raw[i];
    const zcta = row[headers.indexOf("zip code tabulation area")];
    if (!zipSet.has(zcta)) continue;
    const pop = parseInt(row[headers.indexOf("B01003_001E")]) || null;
    const income = parseInt(row[headers.indexOf("B19013_001E")]) || null;
    const totalH = parseInt(row[headers.indexOf("B25003_001E")]) || null;
    const renter = parseInt(row[headers.indexOf("B25003_003E")]) || null;
    const age = parseFloat(row[headers.indexOf("B01002_001E")]) || null;
    const renterPct = totalH && renter ? Number(((renter / totalH) * 100).toFixed(2)) : null;
    if (!pop && !income && !renterPct && !age) continue;
    results.push({ zip_code: zcta, population: pop, median_household_income: income > 0 ? income : null, renter_occupied_pct: renterPct, median_age: age, updated_at: new Date().toISOString() });
  }
  console.log(`Found Census data for ${results.length} of ${zips.length} tracked zips`);

  for (let i = 0; i < results.length; i += 100) {
    const batch = results.slice(i, i + 100);
    const r = await fetch(`${SB_URL}/rest/v1/census_demographics`, { method: "POST", headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" }, body: JSON.stringify(batch) });
    if (!r.ok) console.error(`Batch ${i} failed: ${r.status} ${await r.text()}`);
  }
  console.log(`Upserted ${results.length} records. Done!`);
}

main().catch(e => { console.error(e); process.exit(1); });

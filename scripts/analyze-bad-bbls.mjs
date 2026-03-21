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

const boroMap = {
  "Manhattan": "1",
  "Bronx": "2",
  "Brooklyn": "3",
  "Queens": "4",
  "Staten Island": "5",
};

// Get a sample of buildings missing owner_name with BBLs
const { data: buildings } = await sb
  .from("buildings")
  .select("id,bbl,borough,full_address")
  .is("owner_name", null)
  .not("bbl", "is", null)
  .limit(500);

let matchBoro = 0;
let mismatchBoro = 0;
let invalidFormat = 0;
const mismatchExamples = [];
const mismatchPatterns = {};

for (const b of buildings) {
  if (!/^\d{10}$/.test(b.bbl)) {
    invalidFormat++;
    continue;
  }
  const bblBoro = b.bbl[0];
  const expectedBoro = boroMap[b.borough];
  if (!expectedBoro) continue;

  if (bblBoro === expectedBoro) {
    matchBoro++;
  } else {
    mismatchBoro++;
    const key = `${b.borough}(expected ${expectedBoro}) has bbl_boro=${bblBoro}`;
    mismatchPatterns[key] = (mismatchPatterns[key] || 0) + 1;
    if (mismatchExamples.length < 15) {
      mismatchExamples.push({
        bbl: b.bbl,
        borough: b.borough,
        bblBoro,
        expectedBoro,
        address: b.full_address,
      });
    }
  }
}

console.log("=== BBL Borough Analysis (500 sample) ===");
console.log("Matching boro digit:", matchBoro);
console.log("Mismatched boro digit:", mismatchBoro);
console.log("Invalid format:", invalidFormat);
console.log("\nMismatch patterns:");
for (const [k, v] of Object.entries(mismatchPatterns)) {
  console.log(`  ${k}: ${v}`);
}

console.log("\nMismatch examples:");
for (const ex of mismatchExamples) {
  console.log(`  BBL ${ex.bbl} | borough=${ex.borough} (expected boro=${ex.expectedBoro}, got=${ex.bblBoro}) | ${ex.address}`);
}

// Now test: for mismatched ones, what if we fix the boro digit?
console.log("\n=== Testing PLUTO with corrected boro digit ===");
const testCases = mismatchExamples.slice(0, 5);
for (const tc of testCases) {
  const correctedBbl = tc.expectedBoro + tc.bbl.slice(1);
  const origUrl = `https://data.cityofnewyork.us/resource/64uk-42ks.json?$where=bbl='${tc.bbl}'&$select=bbl,ownername,address&$limit=1`;
  const fixedUrl = `https://data.cityofnewyork.us/resource/64uk-42ks.json?$where=bbl='${correctedBbl}'&$select=bbl,ownername,address&$limit=1`;

  const [origResp, fixedResp] = await Promise.all([fetch(origUrl), fetch(fixedUrl)]);
  const [origData, fixedData] = await Promise.all([origResp.json(), fixedResp.json()]);

  console.log(`\n  BBL ${tc.bbl} (${tc.borough}, ${tc.address})`);
  console.log(`    Original: ${origData.length > 0 ? `FOUND - ${origData[0].ownername} @ ${origData[0].address}` : "NOT FOUND"}`);
  console.log(`    Corrected (${correctedBbl}): ${fixedData.length > 0 ? `FOUND - ${fixedData[0].ownername} @ ${fixedData[0].address}` : "NOT FOUND"}`);
}

// Also test: matching boro ones that still fail PLUTO
console.log("\n=== Testing matching-boro buildings against PLUTO ===");
const matchingSample = buildings.filter(b => {
  if (!/^\d{10}$/.test(b.bbl)) return false;
  return b.bbl[0] === boroMap[b.borough];
}).slice(0, 5);

for (const b of matchingSample) {
  const url = `https://data.cityofnewyork.us/resource/64uk-42ks.json?$where=bbl='${b.bbl}'&$select=bbl,ownername,address&$limit=1`;
  const resp = await fetch(url);
  const data = await resp.json();
  console.log(`  BBL ${b.bbl} (${b.borough}): ${data.length > 0 ? `FOUND - ${data[0].ownername}` : "NOT FOUND"}`);
}

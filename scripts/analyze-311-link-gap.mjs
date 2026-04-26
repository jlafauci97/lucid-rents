// Investigate why ~62% of NYC 311 records didn't link to a building.
// Hypothesis: address normalization mismatches.
//
// We already know the totals from the backfill log:
//   total    = 15,651,764
//   linked   =  5,923,404 (37.8%)
//   unlinked =  9,728,360 (62.2%)
// Statement timeout (30s) means we can't get exact split of unlinked by
// null-vs-has-address. Instead we pull a representative sample of unlinked
// rows by date window (uses the created_date index) and analyze in JS.

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const TOTAL = 15_651_764;
const LINKED = 5_923_404;
const UNLINKED = TOTAL - LINKED;

console.log("=== known totals (from backfill log) ===");
console.log(`total:    ${TOTAL.toLocaleString()}`);
console.log(`linked:   ${LINKED.toLocaleString()}  (${((100 * LINKED) / TOTAL).toFixed(1)}%)`);
console.log(`unlinked: ${UNLINKED.toLocaleString()}  (${((100 * UNLINKED) / TOTAL).toFixed(1)}%)`);

// 1) Pull representative sample of unlinked rows: ~5000 per week × 10 windows
//    spread across the 7-year backfill range. Each window query uses the
//    created_date index, so it returns in well under 30s.
const WINDOWS = [
  ["2019-06-01", "2019-06-08"],
  ["2020-06-01", "2020-06-08"],
  ["2021-06-01", "2021-06-08"],
  ["2022-06-01", "2022-06-08"],
  ["2023-06-01", "2023-06-08"],
  ["2024-06-01", "2024-06-08"],
  ["2025-01-01", "2025-01-08"],
  ["2025-06-01", "2025-06-08"],
  ["2025-11-01", "2025-11-08"],
  ["2026-03-01", "2026-03-08"],
];

let allRows = [];
let allLinkedInWindow = 0;
let allTotalInWindow = 0;

for (const [start, end] of WINDOWS) {
  // Total in window (linked + unlinked) — for global linked-rate sanity check.
  const { data: totals } = await supabase
    .from("complaints_311")
    .select("building_id")
    .eq("metro", "nyc")
    .gte("created_date", start)
    .lt("created_date", end)
    .limit(20000);
  if (totals) {
    allTotalInWindow += totals.length;
    allLinkedInWindow += totals.filter((r) => r.building_id !== null).length;
  }

  // Unlinked-with-address subset.
  const { data, error } = await supabase
    .from("complaints_311")
    .select("incident_address, complaint_type")
    .eq("metro", "nyc")
    .is("building_id", null)
    .not("incident_address", "is", null)
    .gte("created_date", start)
    .lt("created_date", end)
    .limit(5000);
  if (error) {
    console.error(`window ${start}..${end} error:`, error);
    continue;
  }
  console.log(`  window ${start}..${end}: pulled ${data.length} unlinked-with-address rows`);
  allRows = allRows.concat(data);
}

console.log(`\nlinked rate in stratified windows (sanity): ${allLinkedInWindow}/${allTotalInWindow} = ${((100 * allLinkedInWindow) / allTotalInWindow).toFixed(1)}%`);

// Also: how many unlinked rows have null address? Pull a small sample with no
// address filter, separately, just to estimate the null-address share.
let nullAddrSeen = 0;
let unlinkedSeen = 0;
for (const [start, end] of WINDOWS.slice(0, 5)) {
  const { data } = await supabase
    .from("complaints_311")
    .select("incident_address")
    .eq("metro", "nyc")
    .is("building_id", null)
    .gte("created_date", start)
    .lt("created_date", end)
    .limit(5000);
  if (data) {
    unlinkedSeen += data.length;
    nullAddrSeen += data.filter((r) => r.incident_address === null).length;
  }
}
console.log(`null-address share among unlinked (in 5 windows): ${nullAddrSeen}/${unlinkedSeen} = ${((100 * nullAddrSeen) / unlinkedSeen).toFixed(1)}%`);
console.log(`  → projected unlinked-null-addr count: ${Math.round((nullAddrSeen / unlinkedSeen) * UNLINKED).toLocaleString()}`);
console.log(`  → projected unlinked-has-addr count:  ${Math.round((1 - nullAddrSeen / unlinkedSeen) * UNLINKED).toLocaleString()}`);

// 2) Analyze parseability + suffixes of the unlinked-with-address sample.
const PARSE = /^(\d[\d-]*)\s+(.+)$/i;
let parseable = 0;
let unparseable = 0;
const suffixCount = new Map();
const unparseableExamples = [];
const parseableExamples = [];
const complaintTypeCount = new Map();

for (const row of allRows) {
  const m = PARSE.exec(row.incident_address || "");
  if (!m) {
    unparseable++;
    if (unparseableExamples.length < 20) unparseableExamples.push(row.incident_address);
    continue;
  }
  parseable++;
  const street = m[2].trim().toUpperCase();
  const lastWord = street.split(/\s+/).pop();
  suffixCount.set(lastWord, (suffixCount.get(lastWord) || 0) + 1);
  if (parseableExamples.length < 30) {
    parseableExamples.push({ addr: row.incident_address, type: row.complaint_type });
  }
  const ct = row.complaint_type || "(null)";
  complaintTypeCount.set(ct, (complaintTypeCount.get(ct) || 0) + 1);
}

console.log(`\n=== sample composition ===`);
console.log(`unlinked-with-address rows pulled: ${allRows.length.toLocaleString()}`);
console.log(`parseable by linker regex: ${parseable.toLocaleString()}  (${pct(parseable, allRows.length)}%)`);
console.log(`unparseable:               ${unparseable.toLocaleString()}  (${pct(unparseable, allRows.length)}%)`);

console.log(`\n=== top parsed street SUFFIXES among parseable-but-unlinked ===`);
console.log(`(if STREET/AVE/AVENUE etc. dominate, normalization mismatch is real)`);
const topSuffixes = [...suffixCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);
for (const [suffix, n] of topSuffixes) {
  console.log(`  ${suffix.padEnd(20)} ${n.toString().padStart(7)}  (${pct(n, parseable)}%)`);
}

console.log(`\n=== top complaint types in unlinked sample ===`);
const topCT = [...complaintTypeCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
for (const [ct, n] of topCT) {
  console.log(`  ${ct.padEnd(40)} ${n.toString().padStart(7)}`);
}

console.log(`\n=== sample UNPARSEABLE incident_address values ===`);
for (const a of unparseableExamples) console.log(`  ${a}`);

console.log(`\n=== sample PARSEABLE-BUT-UNLINKED incident_address values ===`);
for (const ex of parseableExamples.slice(0, 20)) {
  console.log(`  [${(ex.type || "").slice(0, 30).padEnd(30)}] ${ex.addr}`);
}

// 3) For 12 unique parseable-but-unlinked addresses, look up the buildings
//    table with suffix-stripped prefix match. Estimate recoverable share.
console.log(`\n=== spot-check vs. buildings (suffix-stripped prefix match) ===`);
const SUFFIX_RE = /\s+(STREET|ST|AVENUE|AVE|ROAD|RD|BOULEVARD|BLVD|PLACE|PL|DRIVE|DR|COURT|CT|LANE|LN|TERRACE|TER|PARKWAY|PKWY|HIGHWAY|HWY|EXPRESSWAY|EXPY|SQUARE|SQ)$/i;

const checked = new Set();
let recoverableSpot = 0;
let nonrecoverableSpot = 0;
for (const ex of parseableExamples) {
  if (checked.size >= 12) break;
  if (checked.has(ex.addr)) continue;
  checked.add(ex.addr);

  const m = PARSE.exec(ex.addr);
  if (!m) continue;
  const hnum = m[1];
  const fullStreet = m[2].trim().toUpperCase();
  const stripped = fullStreet.replace(SUFFIX_RE, "").trim();
  const { data: matches, error } = await supabase
    .from("buildings")
    .select("id, street_name, house_number")
    .eq("metro", "nyc")
    .ilike("street_name", `${stripped}%`)
    .limit(5);
  if (error) {
    console.log(`  ${ex.addr}  -> error: ${error.message}`);
    continue;
  }
  if (matches.length === 0) {
    console.log(`  ${ex.addr}  -> ❌ no buildings starting with "${stripped}"`);
    nonrecoverableSpot++;
  } else {
    const sameNum = matches.filter((b) => b.house_number === hnum);
    if (sameNum.length > 0) {
      console.log(`  ${ex.addr}  -> ✅ RECOVERABLE: buildings has "${sameNum[0].street_name}" #${sameNum[0].house_number}`);
      recoverableSpot++;
    } else {
      console.log(`  ${ex.addr}  -> ⚠️  street exists ("${matches[0].street_name}") but house# ${hnum} not present (sample #${matches[0].house_number})`);
      nonrecoverableSpot++;
    }
  }
}
console.log(`\nspot-check: ${recoverableSpot} recoverable / ${nonrecoverableSpot} likely real gap (out of ${recoverableSpot + nonrecoverableSpot})`);

function pct(num, denom) {
  if (!denom) return "0.0";
  return ((100 * num) / denom).toFixed(1);
}

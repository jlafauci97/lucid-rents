#!/usr/bin/env node
/**
 * Backfill building links v2 — improved address normalization.
 * Fixes: city/state/zip in 311 addresses, address ranges, ordinal suffixes.
 *
 * Usage: node scripts/backfill-links-v2.mjs [--metro miami] [--table complaints_311]
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const METROS = ["nyc", "los-angeles", "chicago", "miami", "houston"];

const TABLES = [
  { table: "complaints_311", idColumn: "unique_key", addressColumns: ["incident_address"], label: "311 Complaints" },
  { table: "dob_violations", idColumn: "id", addressColumns: ["house_number", "street_name"], label: "Violations (DOB)" },
  { table: "hpd_violations", idColumn: "id", addressColumns: ["house_number", "street_name"], label: "Violations (HPD/LAHD)" },
  { table: "nypd_complaints", idColumn: "id", addressColumns: ["incident_address"], label: "Crime Reports" },
  { table: "dob_permits", idColumn: "id", addressColumns: ["house_no", "street_name"], label: "Permits" },
  { table: "hpd_litigations", idColumn: "id", addressColumns: ["house_number", "street_name"], label: "Litigations" },
  { table: "bedbug_reports", idColumn: "id", addressColumns: ["house_number", "street_name"], label: "Bedbugs" },
  { table: "evictions", idColumn: "id", addressColumns: ["eviction_address"], label: "Evictions" },
  { table: "sidewalk_sheds", idColumn: "id", addressColumns: ["house_number", "street_name"], label: "Sidewalk Sheds" },
  { table: "lahd_evictions", idColumn: "id", addressColumns: ["address"], label: "LAHD Evictions" },
  { table: "lahd_tenant_buyouts", idColumn: "id", addressColumns: ["address"], label: "LAHD Buyouts" },
  { table: "lahd_ccris_cases", idColumn: "id", addressColumns: ["address"], label: "LAHD CCRIS" },
];

const CITY_META = {
  nyc: { city: "New York", state: "NY", borough: "Manhattan", cityNames: ["NEW YORK", "NY", "NYC", "MANHATTAN", "BROOKLYN", "QUEENS", "BRONX", "STATEN ISLAND"] },
  "los-angeles": { city: "Los Angeles", state: "CA", borough: "Los Angeles", cityNames: ["LOS ANGELES", "LA", "L A"] },
  chicago: { city: "Chicago", state: "IL", borough: "Chicago", cityNames: ["CHICAGO", "CHI"] },
  miami: { city: "Miami", state: "FL", borough: "Miami-Dade", cityNames: ["MIAMI", "MIAMI-DADE", "MIAMI DADE"] },
  houston: { city: "Houston", state: "TX", borough: "Houston", cityNames: ["HOUSTON"] },
};

const STATE_NAMES = ["TEXAS", "CALIFORNIA", "FLORIDA", "ILLINOIS", "NEW YORK", "TX", "CA", "FL", "IL", "NY"];

/**
 * Improved address normalization that handles:
 * 1. City/state/zip suffixes in 311 data (e.g., "HOUSTON TEXAS 77087")
 * 2. Address ranges in building data (e.g., "4601 - 4621 SW 134TH AVE")
 * 3. Ordinal suffixes (e.g., "138TH" → "138")
 * 4. Directional words, street type abbreviations
 * 5. Zip codes embedded after comma or space
 */
function normalizeAddress(addr, metro) {
  if (!addr) return null;

  let s = addr.toUpperCase().trim();

  // Strip everything after first comma (city, state, zip)
  const commaIdx = s.indexOf(",");
  if (commaIdx > 0) s = s.substring(0, commaIdx).trim();

  // Remove punctuation
  s = s.replace(/[.,#]/g, "");

  // Remove "+" symbols (Houston uses "HOUSTON + 77477")
  s = s.replace(/\+/g, "").trim();

  // Remove city names for this metro (do BEFORE zip removal so "HOUSTON 77087" → "77087" → removed)
  if (metro && CITY_META[metro]) {
    for (const cn of CITY_META[metro].cityNames) {
      s = s.replace(new RegExp(`\\b${cn.replace(/\s+/g, "\\s+")}\\b`, "g"), "").trim();
    }
  }

  // Remove state names
  for (const st of STATE_NAMES) {
    s = s.replace(new RegExp(`\\b${st}\\b`, "g"), "").trim();
  }

  // Remove zip codes — only those NOT at the start (to preserve 5-digit house numbers)
  s = s.replace(/(?<=\s)\d{5}(-\d{4})?(\s|$)/g, "").trim();

  // Collapse whitespace
  s = s.replace(/\s+/g, " ").trim();

  // Abbreviate street types
  s = s.replace(/\bSTREET\b/g, "ST")
    .replace(/\bAVENUE\b/g, "AVE")
    .replace(/\bBOULEVARD\b/g, "BLVD")
    .replace(/\bDRIVE\b/g, "DR").replace(/\bBL\b/g, "BLVD")
    .replace(/\bPLACE\b/g, "PL")
    .replace(/\bCOURT\b/g, "CT")
    .replace(/\bLANE\b/g, "LN")
    .replace(/\bROAD\b/g, "RD")
    .replace(/\bTERRACE\b/g, "TER")
    .replace(/\bCIRCLE\b/g, "CIR")
    .replace(/\bPARKWAY\b/g, "PKWY")
    .replace(/\bHIGHWAY\b/g, "HWY")
    .replace(/\bSPEEDWAY\b/g, "SPWY")
    .replace(/\bSQUARE\b/g, "SQ")
    .replace(/\bCRESCENT\b/g, "CRES")
    .replace(/\bWAY\b/g, "WAY");

  // Abbreviate directional words
  s = s.replace(/\bNORTH\b/g, "N")
    .replace(/\bSOUTH\b/g, "S")
    .replace(/\bEAST\b/g, "E")
    .replace(/\bWEST\b/g, "W")
    .replace(/\bNORTHEAST\b/g, "NE")
    .replace(/\bNORTHWEST\b/g, "NW")
    .replace(/\bSOUTHEAST\b/g, "SE")
    .replace(/\bSOUTHWEST\b/g, "SW");

  // Remove ordinal suffixes from numbers: 138TH → 138, 1ST → 1, 2ND → 2, 3RD → 3
  s = s.replace(/\b(\d+)(ST|ND|RD|TH)\b/g, "$1");

  // Strip apartment/unit/floor suffixes
  s = s.replace(/\s+(APT|UNIT|#|FL|FLOOR|STE|SUITE|RM|ROOM)\b.*$/i, "");

  // Handle address ranges: "4601 - 4621" → "4601"
  s = s.replace(/^(\d+)\s*-\s*\d+\s+/, "$1 ");

  return s.replace(/\s+/g, " ").trim();
}

function generateSlug(fullAddress) {
  return fullAddress.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 200);
}

async function loadBuildings(metro) {
  console.log(`  Loading ${metro} buildings...`);
  const addrMap = new Map();
  let offset = 0, total = 0;
  while (true) {
    const { data: batch } = await supabase.from("buildings").select("id, full_address")
      .eq("metro", metro).range(offset, offset + 10000 - 1);
    if (!batch || batch.length === 0) break;
    for (const b of batch) {
      const norm = normalizeAddress(b.full_address, metro);
      if (norm && norm.length >= 3) addrMap.set(norm, b.id);
    }
    total += batch.length;
    if (batch.length < 10000) break;
    offset += 10000;
  }
  console.log(`  Loaded ${total.toLocaleString()} buildings, ${addrMap.size.toLocaleString()} unique addresses`);
  return addrMap;
}

async function linkTable(metro, tableDef, buildingMap) {
  const { table, idColumn, addressColumns, label } = tableDef;
  const primaryCol = addressColumns[addressColumns.length - 1];

  console.log(`  ${label} [${metro}]: checking for unlinked records...`);

  let allUnlinked = [];
  let offset = 0;
  const cols = [idColumn, ...addressColumns].join(", ");
  while (true) {
    const { data: batch, error } = await supabase.from(table).select(cols)
      .is("building_id", null).eq("metro", metro).not(primaryCol, "is", null)
      .range(offset, offset + 5000 - 1);
    if (error) { console.error(`    Fetch error: ${error.message}`); break; }
    if (!batch || batch.length === 0) break;
    allUnlinked = allUnlinked.concat(batch);
    if (batch.length < 5000) break;
    offset += 5000;
    if (allUnlinked.length % 50000 === 0) {
      console.log(`    Fetched ${allUnlinked.length.toLocaleString()} unlinked so far...`);
    }
  }

  if (allUnlinked.length === 0) {
    console.log(`    No records with addresses found`);
    return { linked: 0, created: 0, unmatched: 0, skipped: false };
  }

  console.log(`    Fetched ${allUnlinked.length.toLocaleString()} unlinked records with addresses`);

  // Group by normalized address
  const addrToIds = new Map();
  for (const r of allUnlinked) {
    let raw;
    if (addressColumns.length > 1) {
      raw = addressColumns.map(c => String(r[c] || "").trim()).filter(Boolean).join(" ");
    } else {
      raw = String(r[addressColumns[0]] || "").trim();
    }
    const norm = normalizeAddress(raw, metro);
    if (!norm || norm.length < 3) continue;
    if (!addrToIds.has(norm)) addrToIds.set(norm, []);
    addrToIds.get(norm).push(String(r[idColumn]));
  }

  console.log(`    ${addrToIds.size.toLocaleString()} unique addresses to match`);

  // Log sample matches/misses for debugging
  let sampleMatches = 0, sampleMisses = 0;
  const missExamples = [];
  for (const [addr] of addrToIds) {
    if (buildingMap.has(addr)) { sampleMatches++; }
    else { sampleMisses++; if (missExamples.length < 5) missExamples.push(addr); }
    if (sampleMatches + sampleMisses >= 100) break;
  }
  console.log(`    Sample match rate (first 100): ${sampleMatches}% match, ${sampleMisses}% miss`);
  if (missExamples.length > 0) {
    console.log(`    Miss examples: ${missExamples.slice(0, 3).join(" | ")}`);
  }

  let matched = 0, unmatched = 0, totalLinked = 0, autoCreated = 0, processed = 0;
  const CONCURRENCY = 15;
  const entries = [...addrToIds.entries()];

  async function processAddress([addr, recordIds]) {
    let buildingId = buildingMap.get(addr);

    if (!buildingId && metro !== "nyc") {
      const meta = CITY_META[metro];
      const parts = addr.match(/^(\d+[-\d]*)\s+(.+)$/);
      const houseNum = parts ? parts[1] : "";
      const streetName = parts ? parts[2] : addr;
      const fullAddr = `${addr}, ${meta.city.toUpperCase()}, ${meta.state}`;
      const slug = generateSlug(fullAddr);

      const { data: newBuilding, error: createErr } = await supabase.from("buildings").insert({
        full_address: fullAddr, house_number: houseNum, street_name: streetName,
        city: meta.city, state: meta.state, borough: meta.borough, metro, slug,
        violation_count: 0, complaint_count: 0, review_count: 0, overall_score: null,
      }).select("id").single();

      if (createErr) {
        if (createErr.code === "23505") {
          const { data: existing } = await supabase.from("buildings").select("id")
            .eq("slug", slug).eq("metro", metro).single();
          if (existing) buildingId = existing.id;
        }
        if (!buildingId) { unmatched++; return; }
      } else if (newBuilding?.id) {
        buildingId = newBuilding.id;
        autoCreated++;
        buildingMap.set(addr, newBuilding.id);
      }
    }

    if (!buildingId) { unmatched++; return; }
    matched++;

    for (let i = 0; i < recordIds.length; i += 500) {
      const batch = recordIds.slice(i, i + 500);
      const { error: linkError } = await supabase.from(table)
        .update({ building_id: buildingId }).in(idColumn, batch);
      if (!linkError) totalLinked += batch.length;
    }
  }

  for (let i = 0; i < entries.length; i += CONCURRENCY) {
    const chunk = entries.slice(i, i + CONCURRENCY);
    await Promise.all(chunk.map(processAddress));
    processed += chunk.length;
    if (processed % 1000 === 0 || processed === entries.length) {
      console.log(`    Progress: ${processed.toLocaleString()}/${entries.length.toLocaleString()} addresses (${totalLinked.toLocaleString()} linked, ${autoCreated} created)`);
    }
  }

  console.log(`    Done: ${matched.toLocaleString()} matched, ${unmatched.toLocaleString()} unmatched, ${totalLinked.toLocaleString()} linked, ${autoCreated} buildings auto-created`);
  return { linked: totalLinked, created: autoCreated, unmatched, skipped: false };
}

// Parse CLI args
const args = process.argv.slice(2);
let filterMetro = null;
let filterTable = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--metro" && args[i + 1]) filterMetro = args[++i];
  if (args[i] === "--table" && args[i + 1]) filterTable = args[++i];
}

async function main() {
  const startTime = Date.now();
  const metros = filterMetro ? [filterMetro] : METROS;
  const tables = filterTable ? TABLES.filter(t => t.table === filterTable) : TABLES;

  console.log(`\n=== Link Backfill v2 (Improved Normalization) ===`);
  console.log(`Metros: ${metros.join(", ")}`);
  console.log(`Tables: ${tables.map(t => t.table).join(", ")}\n`);

  const results = {};

  for (const metro of metros) {
    console.log(`\n--- ${metro.toUpperCase()} ---`);
    const buildingMap = await loadBuildings(metro);

    if (buildingMap.size === 0) {
      console.log(`  No buildings found, skipping`);
      continue;
    }

    for (const tableDef of tables) {
      try {
        const result = await linkTable(metro, tableDef, buildingMap);
        if (!result.skipped) {
          const key = `${metro}/${tableDef.table}`;
          results[key] = result;
        }
      } catch (err) {
        console.error(`  Error linking ${tableDef.table}: ${err.message}`);
      }
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n=== Link Backfill v2 Complete (${elapsed}s) ===`);

  let totalLinked = 0, totalCreated = 0;
  for (const [key, r] of Object.entries(results)) {
    if (r.linked > 0 || r.created > 0 || r.unmatched > 0) {
      console.log(`  ${key}: ${r.linked.toLocaleString()} linked, ${r.created} buildings created, ${r.unmatched} unmatched`);
      totalLinked += r.linked;
      totalCreated += r.created;
    }
  }
  console.log(`\n  TOTAL: ${totalLinked.toLocaleString()} records linked, ${totalCreated} buildings created`);
}

main().catch(console.error);

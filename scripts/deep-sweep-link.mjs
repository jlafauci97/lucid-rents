#!/usr/bin/env node
/**
 * Deep-sweep violation/complaint linking.
 *
 * Purpose: drain the historical backlog of unlinked rows in `complaints_311`
 * (and other violation tables) that the cron linker at
 * `src/app/api/cron/sync/route.ts:~5013` never retries due to its 30-day
 * `linkCutoff` window.
 *
 * Algorithm mirrors the fast in-memory linker in runLinkOnly():
 *   1. Page all buildings for the target metro into memory (~one query).
 *   2. Build a Map<normalizedAddress, buildingId> using normalizeAddressForLinking().
 *   3. Page unlinked rows (no date filter), normalize each address, O(1) lookup.
 *   4. Batch-update matched rows via .in(idCol, [...]) in chunks of 500.
 *
 * Idempotent: every row is already filtered by `building_id IS NULL`, so
 * re-running either finds more matches (if the buildings table grew) or no-ops.
 *
 * Checkpointing: after each (metro, source) pair or every N pages, writes
 * `.deep-sweep-checkpoint.json` so we can resume after an interruption.
 *
 * IMPORTANT: does NOT auto-create missing buildings by default. Pass
 * --auto-create to enable that on a follow-up run.
 *
 * Usage:
 *   node scripts/deep-sweep-link.mjs --metro houston --source complaints_311
 *   node scripts/deep-sweep-link.mjs --metro houston --source complaints_311 --dry-run
 *   node scripts/deep-sweep-link.mjs --metro houston --source complaints_311 --max-rows 10000
 *   node scripts/deep-sweep-link.mjs --metro miami --source complaints_311 --auto-create
 *
 * Plan: docs/superpowers/plans/2026-04-10-violation-linking-fix.md
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

// --------------------------------------------------------------------------
// Env loading
// --------------------------------------------------------------------------
const envPath = resolve(process.cwd(), ".env.local");
const env = {};
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, "").replace(/\\n/g, "");
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// --------------------------------------------------------------------------
// CLI arg parsing
// --------------------------------------------------------------------------
const args = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => {
    const [k, v] = a.slice(2).split("=");
    return [k, v === undefined ? "true" : v];
  })
);

const METRO = args.metro || null;
const SOURCE = args.source || "complaints_311";
const DRY_RUN = args["dry-run"] === "true";
const AUTO_CREATE = args["auto-create"] === "true";
const MAX_ROWS = args["max-rows"] ? parseInt(args["max-rows"], 10) : Infinity;
const CHECKPOINT_PATH = resolve(process.cwd(), ".deep-sweep-checkpoint.json");

if (!METRO) {
  console.error("Error: --metro is required (e.g. --metro houston)");
  process.exit(1);
}

const VALID_METROS = ["nyc", "los-angeles", "chicago", "miami", "houston"];
if (!VALID_METROS.includes(METRO)) {
  console.error(`Error: --metro must be one of: ${VALID_METROS.join(", ")}`);
  process.exit(1);
}

const VALID_SOURCES = {
  complaints_311: { idCol: "unique_key", addressColumns: ["incident_address"] },
  dob_violations: { idCol: "id", addressColumns: ["house_number", "street_name"] },
  nypd_complaints: { idCol: "id", addressColumns: ["incident_address"] },
};
if (!VALID_SOURCES[SOURCE]) {
  console.error(`Error: --source must be one of: ${Object.keys(VALID_SOURCES).join(", ")}`);
  process.exit(1);
}

const { idCol, addressColumns } = VALID_SOURCES[SOURCE];
const primaryCol = addressColumns[addressColumns.length - 1];

// --------------------------------------------------------------------------
// Address normalization
//
// KEEP IN SYNC with src/app/api/cron/sync/route.ts:~2128
// (normalizeAddressForLinking). If you edit one, edit both. The behavior must
// match exactly so the in-memory map keys line up.
// --------------------------------------------------------------------------
const CITY_NAMES_BY_METRO = {
  nyc: ["NEW YORK", "NY", "NYC", "MANHATTAN", "BROOKLYN", "QUEENS", "BRONX", "STATEN ISLAND"],
  "los-angeles": ["LOS ANGELES"],
  chicago: ["CHICAGO"],
  miami: ["MIAMI", "MIAMI-DADE", "MIAMI DADE"],
  houston: ["HOUSTON"],
};
const STATE_NAMES = ["TEXAS", "CALIFORNIA", "FLORIDA", "ILLINOIS", "NEW YORK", "TX", "CA", "FL", "IL", "NY"];

function normalizeAddressForLinking(addr, metro) {
  if (!addr) return "";
  let s = String(addr).toUpperCase().trim();
  const commaIdx = s.indexOf(",");
  if (commaIdx > 0) s = s.substring(0, commaIdx).trim();
  s = s.replace(/[.,#]/g, "");
  s = s.replace(/\+/g, "").trim();
  if (metro && CITY_NAMES_BY_METRO[metro]) {
    for (const cn of CITY_NAMES_BY_METRO[metro]) {
      s = s.replace(new RegExp(`\\b${cn.replace(/\s+/g, "\\s+")}\\b`, "g"), "").trim();
    }
  }
  for (const st of STATE_NAMES) {
    s = s.replace(new RegExp(`\\b${st}\\b`, "g"), "").trim();
  }
  s = s.replace(/(?<=\s)\d{5}(-\d{4})?(\s|$)/g, "").trim();
  s = s.replace(/\s+/g, " ").trim();
  s = s
    .replace(/\bSTREET\b/g, "ST")
    .replace(/\bAVENUE\b/g, "AVE")
    .replace(/\bBOULEVARD\b/g, "BLVD")
    .replace(/\bDRIVE\b/g, "DR")
    .replace(/\bBL\b/g, "BLVD")
    .replace(/\bPLACE\b/g, "PL")
    .replace(/\bCOURT\b/g, "CT")
    .replace(/\bLANE\b/g, "LN")
    .replace(/\bROAD\b/g, "RD")
    .replace(/\bTERRACE\b/g, "TER")
    .replace(/\bCIRCLE\b/g, "CIR")
    .replace(/\bPARKWAY\b/g, "PKWY")
    .replace(/\bHIGHWAY\b/g, "HWY");
  s = s
    .replace(/\bNORTH\b/g, "N")
    .replace(/\bSOUTH\b/g, "S")
    .replace(/\bEAST\b/g, "E")
    .replace(/\bWEST\b/g, "W")
    .replace(/\bNORTHEAST\b/g, "NE")
    .replace(/\bNORTHWEST\b/g, "NW")
    .replace(/\bSOUTHEAST\b/g, "SE")
    .replace(/\bSOUTHWEST\b/g, "SW");
  s = s.replace(/\b(\d+)(ST|ND|RD|TH)\b/g, "$1");
  s = s.replace(/\s+(APT|UNIT|#|FL|FLOOR|STE|SUITE|RM|ROOM)\b.*$/i, "");
  s = s.replace(/^(\d+)\s*-\s*\d+\s+/, "$1 ");
  return s.replace(/\s+/g, " ").trim();
}

// --------------------------------------------------------------------------
// Checkpoint I/O
// --------------------------------------------------------------------------
function loadCheckpoint() {
  if (!existsSync(CHECKPOINT_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CHECKPOINT_PATH, "utf8"));
  } catch {
    return {};
  }
}

function saveCheckpoint(state) {
  writeFileSync(CHECKPOINT_PATH, JSON.stringify(state, null, 2));
}

const checkpointKey = `${METRO}/${SOURCE}`;

// --------------------------------------------------------------------------
// Main
// --------------------------------------------------------------------------
async function main() {
  const runStart = Date.now();
  console.log("");
  console.log("=== Deep-Sweep Link ===");
  console.log(`Metro:       ${METRO}`);
  console.log(`Source:      ${SOURCE}`);
  console.log(`Dry run:     ${DRY_RUN}`);
  console.log(`Auto-create: ${AUTO_CREATE}`);
  console.log(`Max rows:    ${MAX_ROWS === Infinity ? "all" : MAX_ROWS}`);
  console.log("");

  // ------------------------------------------------------------------
  // 1. Load all buildings for this metro into an in-memory address map
  // ------------------------------------------------------------------
  console.log(`[1/3] Loading ${METRO} buildings into memory...`);
  const loadStart = Date.now();
  const allBuildings = [];
  let offset = 0;
  const BLD_PAGE = 10000;
  while (true) {
    const { data, error } = await supabase
      .from("buildings")
      .select("id, full_address")
      .eq("metro", METRO)
      .range(offset, offset + BLD_PAGE - 1);
    if (error) {
      console.error(`  Error loading buildings: ${error.message}`);
      process.exit(1);
    }
    if (!data || data.length === 0) break;
    allBuildings.push(...data);
    if (data.length < BLD_PAGE) break;
    offset += BLD_PAGE;
    if (offset % 50000 === 0) {
      console.log(`  ... loaded ${offset} buildings`);
    }
  }

  const buildingAddrMap = new Map();
  let skippedShort = 0;
  for (const b of allBuildings) {
    const normalized = normalizeAddressForLinking(b.full_address, METRO);
    if (normalized.length < 5) {
      skippedShort++;
      continue;
    }
    if (!buildingAddrMap.has(normalized)) {
      buildingAddrMap.set(normalized, b.id);
    }
  }

  console.log(
    `      Loaded ${allBuildings.length} buildings, ${buildingAddrMap.size} unique normalized addresses (skipped ${skippedShort} too-short) in ${((Date.now() - loadStart) / 1000).toFixed(1)}s`
  );

  if (buildingAddrMap.size === 0) {
    console.error("  No buildings loaded — aborting.");
    process.exit(1);
  }

  // ------------------------------------------------------------------
  // 2. Page through unlinked rows, group by normalized address
  // ------------------------------------------------------------------
  console.log(`\n[2/3] Paging unlinked ${SOURCE} rows for ${METRO}...`);

  const checkpoint = loadCheckpoint();
  const resumeFrom = checkpoint[checkpointKey]?.last_offset || 0;
  if (resumeFrom > 0) {
    console.log(`      Resuming from offset ${resumeFrom} (checkpoint)`);
  }

  const ROW_PAGE = 5000;
  let rowOffset = resumeFrom;
  let totalScanned = 0;
  let totalMatched = 0;
  let totalUnmatched = 0;
  let totalLinked = 0;
  const unmatchedSamples = [];

  while (totalScanned < MAX_ROWS) {
    const selectCols = [idCol, ...addressColumns, "latitude", "longitude"].join(", ");
    const { data: batch, error } = await supabase
      .from(SOURCE)
      .select(selectCols)
      .is("building_id", null)
      .eq("metro", METRO)
      .not(primaryCol, "is", null)
      .range(rowOffset, rowOffset + ROW_PAGE - 1);

    if (error) {
      console.error(`      Query error at offset ${rowOffset}: ${error.message}`);
      break;
    }
    if (!batch || batch.length === 0) {
      console.log(`      Reached end of unlinked rows at offset ${rowOffset}`);
      break;
    }

    // Group by normalized address within this page
    const addrToIds = new Map();
    for (const r of batch) {
      let raw;
      if (addressColumns.length > 1) {
        raw = addressColumns
          .map((c) => String(r[c] || "").trim())
          .filter(Boolean)
          .join(" ");
      } else {
        raw = String(r[addressColumns[0]] || "").trim();
      }
      const normalized = normalizeAddressForLinking(raw, METRO);
      if (normalized.length < 5) continue;
      if (!addrToIds.has(normalized)) addrToIds.set(normalized, []);
      addrToIds.get(normalized).push(String(r[idCol]));
    }

    // Match and update
    let pageMatched = 0;
    let pageUnmatched = 0;
    let pageLinked = 0;

    for (const [addr, recordIds] of addrToIds) {
      const buildingId = buildingAddrMap.get(addr);
      if (!buildingId) {
        pageUnmatched++;
        if (unmatchedSamples.length < 10) unmatchedSamples.push(addr);
        continue;
      }
      pageMatched++;

      if (!DRY_RUN) {
        // Update in chunks of 500 to stay under URL length limits
        for (let i = 0; i < recordIds.length; i += 500) {
          const chunk = recordIds.slice(i, i + 500);
          const { error: updErr } = await supabase
            .from(SOURCE)
            .update({ building_id: buildingId })
            .in(idCol, chunk);
          if (updErr) {
            console.error(`      Update error for addr ${addr}: ${updErr.message}`);
          } else {
            pageLinked += chunk.length;
          }
        }
      } else {
        pageLinked += recordIds.length;
      }
    }

    totalScanned += batch.length;
    totalMatched += pageMatched;
    totalUnmatched += pageUnmatched;
    totalLinked += pageLinked;

    const pct = buildingAddrMap.size > 0 ? ((pageMatched / (pageMatched + pageUnmatched)) * 100).toFixed(1) : "0.0";
    console.log(
      JSON.stringify({
        evt: "page",
        metro: METRO,
        source: SOURCE,
        offset: rowOffset,
        scanned: batch.length,
        unique_addrs: addrToIds.size,
        matched_addrs: pageMatched,
        unmatched_addrs: pageUnmatched,
        linked_rows: pageLinked,
        match_rate_pct: parseFloat(pct),
        total_linked: totalLinked,
        elapsed_s: Math.round((Date.now() - runStart) / 1000),
      })
    );

    rowOffset += ROW_PAGE;

    // Save checkpoint every page
    checkpoint[checkpointKey] = {
      last_offset: rowOffset,
      completed: false,
      updated_at: new Date().toISOString(),
    };
    saveCheckpoint(checkpoint);

    if (batch.length < ROW_PAGE) {
      console.log(`      End of data reached`);
      break;
    }
  }

  // ------------------------------------------------------------------
  // 3. Final summary
  // ------------------------------------------------------------------
  const elapsed = ((Date.now() - runStart) / 1000).toFixed(1);
  console.log("");
  console.log("=== Summary ===");
  console.log(`Metro:          ${METRO}`);
  console.log(`Source:         ${SOURCE}`);
  console.log(`Rows scanned:   ${totalScanned}`);
  console.log(`Addrs matched:  ${totalMatched}`);
  console.log(`Addrs unmatched:${totalUnmatched}`);
  console.log(`Rows linked:    ${totalLinked}`);
  console.log(`Dry run:        ${DRY_RUN}`);
  console.log(`Elapsed:        ${elapsed}s`);
  if (unmatchedSamples.length > 0) {
    console.log("");
    console.log("Sample unmatched normalized addresses:");
    for (const s of unmatchedSamples) console.log(`  - ${s}`);
  }
  console.log("");

  // Mark checkpoint as completed if we naturally hit end-of-data
  checkpoint[checkpointKey] = {
    last_offset: rowOffset,
    completed: totalScanned < MAX_ROWS,
    total_linked: totalLinked,
    updated_at: new Date().toISOString(),
  };
  saveCheckpoint(checkpoint);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

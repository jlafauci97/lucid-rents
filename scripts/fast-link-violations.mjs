#!/usr/bin/env node

/**
 * Fast bulk linker — links unlinked violations to buildings.
 *
 * Optimized for throughput:
 *   1. Pre-loads the entire BBL→building_id map (or per-borough slice)
 *   2. Paginates through unlinked violations using .range() to bypass 1K row cap
 *   3. Runs upserts with concurrency
 *
 * Usage:
 *   node scripts/fast-link-violations.mjs                        # all boroughs, all tables
 *   node scripts/fast-link-violations.mjs --bbl-prefix=1         # Manhattan only
 *   node scripts/fast-link-violations.mjs --table=dob_violations # one table only
 *   node scripts/fast-link-violations.mjs --batch=5000           # rows per page
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

const BBL_PREFIX = args["bbl-prefix"] || "";
const TABLE_FILTER = args.table || ""; // e.g. "dob_violations"
const BATCH_SIZE = parseInt(args.batch || "1000", 10); // rows per .range() page
const UPSERT_CHUNK = 500;
const CONCURRENCY = 15;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Step 1: Load full BBL → building_id map ──────────────────────────────────
async function loadBuildingMap() {
  const prefix = BBL_PREFIX ? ` (prefix=${BBL_PREFIX})` : "";
  console.log(`Loading building BBL map${prefix}...`);

  const bblMap = new Map();
  let page = 0;
  const pageSize = 1000;

  while (true) {
    let query = supabase
      .from("buildings")
      .select("id, bbl")
      .not("bbl", "is", null);

    if (BBL_PREFIX) {
      query = query.like("bbl", `${BBL_PREFIX}%`);
    }

    const { data, error } = await query.range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error("Error loading buildings:", error.message);
      break;
    }
    if (!data?.length) break;

    for (const b of data) {
      if (b.bbl) bblMap.set(b.bbl, b.id);
    }

    page++;
    if (data.length < pageSize) break;
  }

  console.log(`  Loaded ${bblMap.size} buildings (${page} pages)\n`);
  return bblMap;
}

// ── Step 2: Link violations for one table ────────────────────────────────────
async function linkTable(table, bblMap) {
  console.log(`\nLinking ${table}...`);
  let totalLinked = 0;
  let totalSkipped = 0;
  let totalProcessed = 0;
  let emptyPages = 0;

  while (true) {
    // Fetch a page of unlinked records using .range()
    // We always fetch from offset 0 because linked records disappear from the filter
    let query = supabase
      .from(table)
      .select("id, bbl")
      .is("building_id", null)
      .not("bbl", "is", null);

    if (BBL_PREFIX) {
      query = query.like("bbl", `${BBL_PREFIX}%`);
    }

    const { data: unlinked, error } = await query.range(0, BATCH_SIZE - 1);

    if (error) {
      console.error(`  Error fetching ${table}:`, error.message);
      break;
    }
    if (!unlinked?.length) {
      console.log(`  No more unlinked records`);
      break;
    }

    totalProcessed += unlinked.length;

    // Match violations to buildings
    const updates = [];
    let skipped = 0;

    for (const r of unlinked) {
      const bbl = r.bbl?.trim();
      if (!bbl) { skipped++; continue; }
      // Normalize 11-digit DOB BBL to 10-digit
      const norm = bbl.length === 11 ? bbl.substring(0, 10) : bbl;
      const buildingId = bblMap.get(norm);
      if (buildingId) {
        updates.push({ id: r.id, building_id: buildingId });
      } else {
        skipped++;
      }
    }

    if (updates.length === 0) {
      emptyPages++;
      totalSkipped += skipped;
      // If we've had 3 consecutive pages with no matches, the remaining
      // unlinked records don't have buildings yet — stop
      if (emptyPages >= 3) {
        console.log(`  ${emptyPages} consecutive pages with no matches — stopping (${totalSkipped} unmatched BBLs)`);
        break;
      }
      console.log(`  Page: 0 linked, ${skipped} skipped (no building) — retrying...`);
      continue;
    }
    emptyPages = 0;

    // Upsert in parallel chunks
    const chunks = [];
    for (let i = 0; i < updates.length; i += UPSERT_CHUNK) {
      chunks.push(updates.slice(i, i + UPSERT_CHUNK));
    }

    const results = await Promise.all(
      chunks.map((chunk) =>
        supabase.from(table).upsert(chunk, { onConflict: "id" }).then(({ error }) => {
          if (error) {
            console.error(`  Upsert error: ${error.message}`);
            return 0;
          }
          return chunk.length;
        })
      )
    );

    const batchLinked = results.reduce((a, b) => a + b, 0);
    totalLinked += batchLinked;
    totalSkipped += skipped;

    if (totalLinked % 5000 < batchLinked) {
      console.log(`  Progress: ${totalLinked} linked, ${totalSkipped} skipped, ${totalProcessed} processed`);
    }

    // Small delay to not overwhelm Supabase
    await sleep(50);
  }

  console.log(`  Done: ${totalLinked} linked, ${totalSkipped} skipped in ${table}`);
  return totalLinked;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`Fast link — bblPrefix=${BBL_PREFIX || "all"}, table=${TABLE_FILTER || "all"}, batch=${BATCH_SIZE}\n`);

  const bblMap = await loadBuildingMap();

  const tables = TABLE_FILTER
    ? [TABLE_FILTER]
    : ["dob_violations", "hpd_violations", "bedbug_reports", "evictions"];

  let grand = 0;
  for (const table of tables) {
    grand += await linkTable(table, bblMap);
  }

  console.log(`\nDone! Total linked across all tables: ${grand}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

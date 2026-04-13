#!/usr/bin/env node
/**
 * Audit + repair `buildings.violation_count` drift against actual `hpd_violations` rows.
 *
 * Problem: after building dedup, some buildings have `violation_count > 0` stored on
 * the buildings row but 0 actual rows in `hpd_violations WHERE building_id = <id>`.
 * The violation rows either:
 *   (a) still reference a building_id that was merged/deleted, or
 *   (b) were never linked (NULL building_id) and the count was populated by a sync
 *       that has since been invalidated.
 *
 * Symptom: the building page shows "HPD Violations (5936)" on the tab but clicking
 * the tab renders "No HPD violations on record." because the Timeline query returns
 * zero rows.
 *
 * Modes:
 *   --audit    (default)  Report drift: for each building in metro, compare
 *                         `violation_count` to actual row count. No writes.
 *   --relink              For drifted buildings with a BBL, re-link `hpd_violations`
 *                         rows matching that BBL to the canonical building.
 *   --recount             After relinking (or standalone), recompute and write
 *                         `buildings.violation_count` from actual row counts.
 *   --all                 Shortcut for --relink + --recount.
 *
 * Flags:
 *   --metro <nyc>         Metro to audit (default nyc — hpd_violations is NYC-only).
 *   --batch <1000>        Building batch size for the audit sweep.
 *   --min-count <1>       Only consider buildings with stored violation_count >= this.
 *   --limit <N>           Stop after processing N buildings.
 *   --dry-run             Print writes but don't apply (default off for --recount/
 *                         --relink — be deliberate, this mirrors deep-sweep-link.mjs).
 *
 * Usage:
 *   # Audit only (safe, read-only)
 *   node scripts/audit-violation-count-drift.mjs
 *
 *   # Audit + relink + recount in one pass
 *   node scripts/audit-violation-count-drift.mjs --all
 *
 *   # Dry-run the repair to see what would change
 *   node scripts/audit-violation-count-drift.mjs --all --dry-run
 *
 *   # Just recount (skip relinking) — useful if rows are already linked correctly
 *   # but stored counts are stale
 *   node scripts/audit-violation-count-drift.mjs --recount
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

// --------------------------------------------------------------------------
// Env loading (same pattern as other scripts in this dir)
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
// CLI args
// --------------------------------------------------------------------------
const args = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => {
    const [k, v] = a.slice(2).split("=");
    return [k, v === undefined ? "true" : v];
  })
);

const METRO = args.metro || "nyc";
const BATCH = parseInt(args.batch || "1000", 10);
const MIN_COUNT = parseInt(args["min-count"] || "1", 10);
const LIMIT = args.limit ? parseInt(args.limit, 10) : Infinity;
const DRY_RUN = args["dry-run"] === "true";
const DO_RELINK = args.relink === "true" || args.all === "true";
const DO_RECOUNT = args.recount === "true" || args.all === "true";

console.log("");
console.log("=== violation_count drift audit ===");
console.log(`Metro:      ${METRO}`);
console.log(`Batch:      ${BATCH}`);
console.log(`Min count:  ${MIN_COUNT}`);
console.log(`Limit:      ${LIMIT === Infinity ? "all" : LIMIT}`);
console.log(`Relink:     ${DO_RELINK ? "YES" : "no"}`);
console.log(`Recount:    ${DO_RECOUNT ? "YES" : "no"}`);
console.log(`Dry run:    ${DRY_RUN ? "YES" : "no"}`);
console.log("");

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

/**
 * Count actual hpd_violations rows for a batch of building_ids in a single query.
 * Supabase's PostgREST can't return grouped counts directly, so we fetch just
 * `building_id` for all rows in the batch and tally in memory. This is cheap
 * because we only pull a single column.
 */
async function actualCountsForBuildings(buildingIds) {
  const counts = new Map();
  for (const id of buildingIds) counts.set(id, 0);

  // Page through all matching rows
  const PAGE = 10000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("hpd_violations")
      .select("building_id")
      .in("building_id", buildingIds)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`hpd_violations tally failed: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const row of data) {
      counts.set(row.building_id, (counts.get(row.building_id) || 0) + 1);
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return counts;
}

/**
 * Relink hpd_violations rows that share a BBL with a known-good building.
 * Returns how many rows were updated.
 */
async function relinkByBbl(buildingId, bbl) {
  // Find all rows for this BBL that are either unlinked OR linked to the wrong id.
  // We do this in two phases to avoid a potentially huge IN list.
  const { data: rows, error: selErr } = await supabase
    .from("hpd_violations")
    .select("id, building_id")
    .eq("bbl", bbl);
  if (selErr) {
    console.error(`  select bbl=${bbl} failed:`, selErr.message);
    return 0;
  }
  if (!rows || rows.length === 0) return 0;

  const toUpdate = rows.filter((r) => r.building_id !== buildingId).map((r) => r.id);
  if (toUpdate.length === 0) return 0;

  if (DRY_RUN) {
    console.log(`  [dry] would relink ${toUpdate.length} rows (bbl=${bbl}) -> ${buildingId}`);
    return toUpdate.length;
  }

  // Update in chunks of 500 to stay under URL length limits
  let updated = 0;
  for (let i = 0; i < toUpdate.length; i += 500) {
    const chunk = toUpdate.slice(i, i + 500);
    const { error: upErr } = await supabase
      .from("hpd_violations")
      .update({ building_id: buildingId })
      .in("id", chunk);
    if (upErr) {
      console.error(`  update chunk failed:`, upErr.message);
      continue;
    }
    updated += chunk.length;
  }
  return updated;
}

/**
 * Write corrected violation_count back to the buildings row.
 */
async function writeRecount(buildingId, newCount) {
  if (DRY_RUN) return;
  const { error } = await supabase
    .from("buildings")
    .update({ violation_count: newCount })
    .eq("id", buildingId);
  if (error) console.error(`  recount write failed for ${buildingId}:`, error.message);
}

// --------------------------------------------------------------------------
// Main sweep
// --------------------------------------------------------------------------
async function main() {
  const runStart = Date.now();

  // Total buildings matching the filter (for progress reporting)
  const { count: total } = await supabase
    .from("buildings")
    .select("id", { count: "exact", head: true })
    .eq("metro", METRO)
    .gte("violation_count", MIN_COUNT);
  console.log(`Target: ${total ?? "?"} buildings in ${METRO} with violation_count >= ${MIN_COUNT}`);
  console.log("");

  const stats = {
    seen: 0,
    drifted: 0,            // stored count != actual count
    emptyButCounted: 0,    // stored > 0 but actual == 0
    relinked: 0,           // rows updated during --relink
    relinkedBuildings: 0,  // buildings that received relinked rows
    recountedBuildings: 0, // buildings whose stored count was corrected
    noBbl: 0,              // drifted but no bbl to relink on
    ok: 0,                 // stored count matches actual
  };

  let offset = 0;
  while (stats.seen < LIMIT) {
    const pageSize = Math.min(BATCH, LIMIT - stats.seen);
    const { data: buildings, error } = await supabase
      .from("buildings")
      .select("id, bbl, violation_count, full_address")
      .eq("metro", METRO)
      .gte("violation_count", MIN_COUNT)
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error("buildings fetch failed:", error.message);
      break;
    }
    if (!buildings || buildings.length === 0) break;

    const ids = buildings.map((b) => b.id);
    const actual = await actualCountsForBuildings(ids);

    for (const b of buildings) {
      stats.seen++;
      const stored = b.violation_count ?? 0;
      const real = actual.get(b.id) ?? 0;

      if (stored === real) {
        stats.ok++;
        continue;
      }

      stats.drifted++;
      if (real === 0 && stored > 0) stats.emptyButCounted++;

      // --relink: try to pull rows back in by BBL
      let newReal = real;
      if (DO_RELINK) {
        if (!b.bbl) {
          stats.noBbl++;
        } else {
          const updated = await relinkByBbl(b.id, b.bbl);
          if (updated > 0) {
            stats.relinked += updated;
            stats.relinkedBuildings++;
            newReal = real + updated;
            console.log(
              `  RELINK ${b.id} ${b.full_address} bbl=${b.bbl} — stored=${stored} actual=${real} -> +${updated}`
            );
          }
        }
      }

      // --recount: write corrected count
      if (DO_RECOUNT && newReal !== stored) {
        await writeRecount(b.id, newReal);
        stats.recountedBuildings++;
        if (!DO_RELINK) {
          console.log(
            `  RECOUNT ${b.id} ${b.full_address} — stored=${stored} -> actual=${newReal}`
          );
        }
      } else if (!DO_RELINK && !DO_RECOUNT) {
        // Audit mode: log the drift but don't write
        console.log(
          `  DRIFT  ${b.id} ${b.full_address} bbl=${b.bbl ?? "-"} stored=${stored} actual=${real}`
        );
      }
    }

    // Progress log every batch
    const pct = total ? ((stats.seen / total) * 100).toFixed(1) : "?";
    const elapsed = ((Date.now() - runStart) / 1000).toFixed(0);
    console.log(
      `[${elapsed}s] seen=${stats.seen}/${total ?? "?"} (${pct}%) drifted=${stats.drifted} empty=${stats.emptyButCounted} relinked=${stats.relinked} recounted=${stats.recountedBuildings}`
    );

    if (buildings.length < pageSize) break;
    offset += pageSize;
  }

  console.log("");
  console.log("=== Summary ===");
  console.log(`Buildings seen:            ${stats.seen}`);
  console.log(`  matching stored count:   ${stats.ok}`);
  console.log(`  drifted:                 ${stats.drifted}`);
  console.log(`  stored>0 but actual==0:  ${stats.emptyButCounted}`);
  if (DO_RELINK) {
    console.log(`Relinked rows:             ${stats.relinked}`);
    console.log(`Buildings relinked:        ${stats.relinkedBuildings}`);
    console.log(`Drifted without bbl:       ${stats.noBbl}`);
  }
  if (DO_RECOUNT) {
    console.log(`Buildings recounted:       ${stats.recountedBuildings}`);
  }
  if (DRY_RUN) console.log(`(dry run — no writes were applied)`);
  console.log(`Elapsed:                   ${((Date.now() - runStart) / 1000).toFixed(0)}s`);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});

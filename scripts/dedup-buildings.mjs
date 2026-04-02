#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync } from "fs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BATCH_SIZE = 500;
const METRO_NATURAL_KEY = {
  "nyc": "bbl",
  "los-angeles": "apn",
  "chicago": "pin",
  "houston": "hcad_account",
  "miami": "folio_number",
};

function progressPath(metro) {
  return `scripts/.dedup-progress-${metro}.json`;
}

function loadProgress(metro) {
  const p = progressPath(metro);
  if (existsSync(p)) return JSON.parse(readFileSync(p, "utf8"));
  return { completed: 0, deduped: 0, noKeyGroups: 0 };
}

function saveProgress(metro, progress) {
  writeFileSync(progressPath(metro), JSON.stringify(progress, null, 2));
}

function pickKeeper(rows, naturalKey) {
  const withKey = rows.filter(r => r[naturalKey] != null);
  if (withKey.length > 0) {
    return withKey.sort((a, b) => countNonNull(b) - countNonNull(a))[0];
  }
  return rows.sort((a, b) => {
    const diff = countNonNull(b) - countNonNull(a);
    if (diff !== 0) return diff;
    return new Date(a.created_at) - new Date(b.created_at);
  })[0];
}

function countNonNull(row) {
  return Object.values(row).filter(v => v != null).length;
}

async function dedupGroup(keeperId, loserIds, rows) {
  const keeper = rows.find(r => r.id === keeperId);
  const losers = rows.filter(r => loserIds.includes(r.id));

  // Build merge updates from losers (non-null values keeper is missing)
  const mergeUpdates = {};
  for (const loser of losers) {
    for (const [key, val] of Object.entries(loser)) {
      if (val != null && keeper[key] == null && key !== "id" && key !== "created_at" && key !== "updated_at") {
        mergeUpdates[key] = val;
      }
    }
  }

  const { error } = await supabase.rpc("dedup_building_group", {
    keeper_id: keeperId,
    loser_ids: loserIds,
    merge_updates: mergeUpdates,
  });
  if (error) throw new Error(`Dedup group failed for ${keeperId}: ${error.message}`);
}

async function dedupMetro(metro) {
  const naturalKey = METRO_NATURAL_KEY[metro];
  const progress = loadProgress(metro);
  console.log(`[${metro}] Starting dedup (${progress.deduped || 0} rows removed previously)`);

  let totalProcessed = progress.completed || 0;
  let deduped = progress.deduped || 0;
  let noKeyGroups = progress.noKeyGroups || 0;
  let hasMore = true;

  while (hasMore) {
    // Always OFFSET 0 because completed groups disappear from results
    const { data: groups, error } = await supabase.rpc("get_duplicate_groups_batch", {
      metro_filter: metro,
      batch_limit: BATCH_SIZE,
    });
    if (error) throw new Error(`[${metro}] Failed to get groups: ${error.message}`);

    if (!groups || groups.length === 0) {
      hasMore = false;
      break;
    }

    for (const group of groups) {
      const { data: rows } = await supabase
        .from("buildings")
        .select("*")
        .eq("full_address", group.full_address)
        .eq("metro", metro);

      if (!rows || rows.length <= 1) {
        totalProcessed++;
        continue;
      }

      // NYC special logic: sub-group by BBL
      if (metro === "nyc") {
        const bblGroups = {};
        for (const row of rows) {
          const key = row.bbl || "null";
          if (!bblGroups[key]) bblGroups[key] = [];
          bblGroups[key].push(row);
        }

        for (const [bbl, bblRows] of Object.entries(bblGroups)) {
          if (bbl === "null" || bblRows.length <= 1) continue;
          const keeper = pickKeeper(bblRows, naturalKey);
          const loserIds = bblRows.filter(r => r.id !== keeper.id).map(r => r.id);
          await dedupGroup(keeper.id, loserIds, bblRows);
          deduped += loserIds.length;
        }
      } else {
        const keeper = pickKeeper(rows, naturalKey);
        const loserIds = rows.filter(r => r.id !== keeper.id).map(r => r.id);
        if (keeper[naturalKey] == null) noKeyGroups++;
        await dedupGroup(keeper.id, loserIds, rows);
        deduped += loserIds.length;
      }

      totalProcessed++;
    }

    saveProgress(metro, { completed: totalProcessed, deduped, noKeyGroups });
    console.log(`[${metro}] ${totalProcessed} groups processed, ${deduped} rows removed`);
  }

  saveProgress(metro, { completed: totalProcessed, deduped, noKeyGroups, done: true });
  console.log(`[${metro}] COMPLETE: ${deduped} duplicate rows removed from ${totalProcessed} groups`);
  if (noKeyGroups > 0) {
    console.log(`[${metro}] WARNING: ${noKeyGroups} groups had no natural key populated`);
  }
}

// Main
const metroArg = process.argv[2];
const verifyOnly = process.argv.includes("--verify");

async function main() {
  console.log("Building dedup script starting...");

  const metros = metroArg && metroArg !== "--verify"
    ? [metroArg]
    : ["nyc", "chicago", "los-angeles", "houston", "miami"];

  console.log(`Running dedup for: ${metros.join(", ")}`);

  await Promise.all(metros.map(metro => dedupMetro(metro)));

  console.log("\nAll metros complete!");
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});

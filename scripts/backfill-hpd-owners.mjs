#!/usr/bin/env node
/**
 * HPD Registrations + Contacts backfill orchestrator.
 *
 * Drives the Supabase Edge Function `sync` iteratively until both HPD
 * datasets are drained, then runs the one-shot RPC that cascades
 * CorporateOwner names into buildings.owner_name.
 *
 * Each edge-function invocation pages up to MAX_PAGES × PAGE_SIZE rows
 * (50K) before returning, so we loop until records_added reaches 0 or
 * we hit the safety cap.
 *
 * Usage:
 *   node scripts/backfill-hpd-owners.mjs
 *   node scripts/backfill-hpd-owners.mjs --since=2000-01-01
 *   node scripts/backfill-hpd-owners.mjs --source=hpd-registrations   # one only
 *   node scripts/backfill-hpd-owners.mjs --skip-backfill               # sync only
 *   node scripts/backfill-hpd-owners.mjs --max-iters=30                # per source
 *   node scripts/backfill-hpd-owners.mjs --dry-run                     # print plan
 *
 * Env required in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  — used as CRON_SECRET bearer for edge fn
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Env — prefer .env.local next to cwd, fall back to process.env
// ---------------------------------------------------------------------------
const env = { ...process.env };
const envPath = resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, "").replace(/\\n/g, "");
  }
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL ?? env.SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and/or SUPABASE_SERVICE_ROLE_KEY.");
  console.error("Set them in .env.local at the cwd, or export them as env vars, then re-run.");
  process.exit(1);
}

const SYNC_URL = `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/sync`;

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter((a) => a.startsWith("--"))
    .map((a) => {
      const [k, v] = a.slice(2).split("=");
      return [k, v === undefined ? "true" : v];
    })
);

const SINCE = args.since || "2000-01-01";
const ONLY_SOURCE = args.source || null;
const SKIP_BACKFILL = args["skip-backfill"] === "true";
const MAX_ITERS = args["max-iters"] ? parseInt(args["max-iters"], 10) : 40;
const DRY_RUN = args["dry-run"] === "true";

const ALL_SOURCES = ["hpd-registrations", "hpd-contacts"];
const SOURCES = ONLY_SOURCE ? [ONLY_SOURCE] : ALL_SOURCES;

if (ONLY_SOURCE && !ALL_SOURCES.includes(ONLY_SOURCE)) {
  console.error(`Invalid --source. Use one of: ${ALL_SOURCES.join(", ")}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function nowIso() {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function log(msg) {
  console.log(`[${nowIso()}] ${msg}`);
}

async function callSync(source, since) {
  const res = await fetch(SYNC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({ source, since }),
    signal: AbortSignal.timeout(180_000),
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON response (status ${res.status}): ${text.slice(0, 200)}`);
  }

  if (!res.ok || json.success === false) {
    throw new Error(`Sync failed (status ${res.status}): ${JSON.stringify(json).slice(0, 400)}`);
  }

  const sourceKey = source.replace(/-/g, "_");
  const stats = json[sourceKey] ?? json[source] ?? {};
  return {
    added: stats.records_added ?? 0,
    linked: stats.records_linked ?? 0,
    errors: stats.errors ?? [],
    elapsedSec: json.duration_seconds ?? null,
  };
}

async function drain(source) {
  log(`-> ${source}: starting drain from ${SINCE}`);
  let totalAdded = 0;
  let totalLinked = 0;
  let iter = 0;

  while (iter < MAX_ITERS) {
    iter++;
    log(`   iter ${iter}/${MAX_ITERS}…`);

    let result;
    try {
      result = await callSync(source, SINCE);
    } catch (err) {
      log(`   iter ${iter} error: ${err.message}`);
      log(`   waiting 10s before retry…`);
      await new Promise((r) => setTimeout(r, 10_000));
      continue;
    }

    totalAdded += result.added;
    totalLinked += result.linked;
    log(`   iter ${iter}: added=${result.added} linked=${result.linked} (${result.elapsedSec}s). cumulative=${totalAdded}`);

    if (result.errors.length > 0) {
      log(`   iter ${iter} reported errors: ${result.errors.slice(0, 3).join(" | ")}`);
    }

    if (result.added === 0) {
      log(`<- ${source}: drained after ${iter} iterations. total added=${totalAdded}, linked=${totalLinked}`);
      return { iter, totalAdded, totalLinked };
    }
  }

  log(`<- ${source}: hit MAX_ITERS=${MAX_ITERS} with more rows likely remaining. Re-run to continue.`);
  return { iter, totalAdded, totalLinked, truncated: true };
}

async function runOwnerBackfill() {
  log(`-> backfill_buildings_owner_name(): filling buildings.owner_name from HPD`);
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await supabase.rpc("backfill_buildings_owner_name");
  if (error) throw new Error(`backfill_buildings_owner_name RPC failed: ${error.message}`);
  log(`<- backfill_buildings_owner_name: updated ${data} buildings`);
  return data;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  log(`HPD owner backfill orchestrator`);
  log(`Sync URL: ${SYNC_URL}`);
  log(`Since: ${SINCE}`);
  log(`Sources: ${SOURCES.join(", ")}`);
  log(`Skip building.owner_name backfill: ${SKIP_BACKFILL}`);
  log(`Max iters per source: ${MAX_ITERS}`);

  if (DRY_RUN) {
    log(`DRY RUN — exiting without calling anything.`);
    return;
  }

  const summary = {};
  for (const source of SOURCES) {
    summary[source] = await drain(source);
  }

  if (!SKIP_BACKFILL && !ONLY_SOURCE) {
    summary.ownerBackfillUpdated = await runOwnerBackfill();
  } else if (ONLY_SOURCE) {
    log(`Skipping owner_name backfill (single source mode).`);
  } else {
    log(`Skipping owner_name backfill (--skip-backfill).`);
  }

  log(`=== FINAL SUMMARY ===`);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(`Fatal: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * load-crime-aggregates.mjs
 *
 * Refreshes `crime_zip_aggregates` — one pre-aggregated row per (zip, metro) for
 * the incident-level crime metros (NYC, Chicago, LA, Houston) stored in
 * `nypd_complaints`. Miami is excluded (it uses miami_crime_aggregates, which is
 * population-apportioned, not incident-level).
 *
 * Why: the building page used to aggregate crime at request time by fetching up
 * to 1,000 raw rows and counting in JS. For high-volume zips that index scan
 * heap-fetches ~1,000 rows and takes ~12s, exceeding the anon role's
 * statement_timeout — so the query errored, safe() returned total12mo=0, and the
 * Crime section silently rendered nothing. This batch job does the work once as a
 * single seq-scan GROUP BY (a few minutes over 4.8M rows) so the page only does a
 * primary-key lookup.
 *
 * Connects directly (port 5432, not the pooler) so the heavy aggregate isn't
 * killed by a pooler/statement timeout. Idempotent: upserts on (zip, metro).
 *
 * Usage:
 *   node scripts/load-crime-aggregates.mjs            # refresh all metros
 *   node scripts/load-crime-aggregates.mjs --dry-run  # row counts only, no write
 *
 * Schedule: safe to run daily via cron (crime data is appended over time).
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { createRequire } from "module";

// Parse .env.local
const envPath = resolve(process.cwd(), ".env.local");
const env = {};
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, "").replace(/\\n/g, "");
}

const DRY_RUN = process.argv.includes("--dry-run");

// pg client lives in /tmp/pg-helper so the project tree stays clean.
const PG_HELPER = "/tmp/pg-helper";
const PG_PATH = `${PG_HELPER}/node_modules/pg`;
if (!existsSync(PG_PATH)) {
  console.log("Installing pg client to", PG_HELPER, "...");
  const { execSync } = await import("child_process");
  execSync(`mkdir -p ${PG_HELPER} && cd ${PG_HELPER} && npm install pg --silent`, { stdio: "inherit" });
}
const require = createRequire(`${PG_HELPER}/`);
const { Client } = require("pg");

const PROJECT_REF = env.NEXT_PUBLIC_SUPABASE_URL.match(/https:\/\/([^.]+)/)[1];
const DB_PASSWORD = env.SUPABASE_DB_PASSWORD;
if (!DB_PASSWORD) {
  console.error("SUPABASE_DB_PASSWORD missing from .env.local");
  process.exit(1);
}
const CONN = {
  host: `db.${PROJECT_REF}.supabase.co`,
  port: 5432,
  database: "postgres",
  user: "postgres",
  password: DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
  statement_timeout: 30 * 60 * 1000, // 30 min — the seq-scan aggregate over 4.8M rows
};

// Violent / property categorisation mirrors the regexes the page used to apply in
// JS (loadLocationData crime branch). Categories are mutually exclusive here, so
// violent + property + qol == total (cleaner than the old JS, which double-counted
// some misdemeanours into qol).
const VIOLENT_RE = "violent|assault|robbery|murder|rape|weapon";
const PROPERTY_RE = "property|burglary|larceny|theft|grand|petit";

const AGG_SELECT = `
  SELECT
    zip_code AS zip,
    metro,
    count(*)::int AS total_12mo,
    count(*) FILTER (WHERE crime_category ~* '${VIOLENT_RE}')::int AS violent,
    count(*) FILTER (
      WHERE crime_category !~* '${VIOLENT_RE}'
        AND crime_category ~* '${PROPERTY_RE}'
    )::int AS property,
    count(*) FILTER (
      WHERE crime_category !~* '${VIOLENT_RE}'
        AND crime_category !~* '${PROPERTY_RE}'
    )::int AS qol,
    -- top_precinct omitted: mode() WITHIN GROUP forces a sort of all 4.8M rows
    -- (spills to disk, ~30min+ under throttled IO). Plain counts below are a fast
    -- in-memory hash aggregate. The precinct line is a minor NYC-only detail.
    NULL::text AS top_precinct
  FROM public.nypd_complaints
  WHERE zip_code IS NOT NULL
    AND metro IS NOT NULL
    AND cmplnt_date >= (CURRENT_DATE - INTERVAL '12 months')
  GROUP BY zip_code, metro
`;

async function main() {
  const client = new Client(CONN);
  await client.connect();
  try {
    console.log("→ Aggregating nypd_complaints by (zip, metro) over the last 12 months…");
    const t0 = Date.now();

    if (DRY_RUN) {
      const { rows } = await client.query(
        `SELECT metro, count(*) AS zips, sum(total_12mo) AS incidents
         FROM (${AGG_SELECT}) s GROUP BY metro ORDER BY metro`
      );
      console.log(`  (dry run, ${(Date.now() - t0) / 1000}s) per-metro coverage:`);
      for (const r of rows) console.log(`    ${r.metro.padEnd(14)} ${String(r.zips).padStart(5)} zips · ${Number(r.incidents).toLocaleString()} incidents`);
      return;
    }

    const { rowCount } = await client.query(`
      INSERT INTO public.crime_zip_aggregates
        (zip, metro, total_12mo, violent, property, qol, top_precinct, updated_at)
      SELECT zip, metro, total_12mo, violent, property, qol, top_precinct, now()
      FROM (${AGG_SELECT}) s
      ON CONFLICT (zip, metro) DO UPDATE SET
        total_12mo   = EXCLUDED.total_12mo,
        violent      = EXCLUDED.violent,
        property     = EXCLUDED.property,
        qol          = EXCLUDED.qol,
        top_precinct = EXCLUDED.top_precinct,
        updated_at   = EXCLUDED.updated_at
    `);

    console.log(`✅ Upserted ${rowCount.toLocaleString()} (zip, metro) rows in ${((Date.now() - t0) / 1000).toFixed(1)}s.`);
    const { rows: byMetro } = await client.query(
      `SELECT metro, count(*) AS zips, sum(total_12mo) AS incidents
       FROM public.crime_zip_aggregates GROUP BY metro ORDER BY metro`
    );
    for (const r of byMetro) console.log(`    ${r.metro.padEnd(14)} ${String(r.zips).padStart(5)} zips · ${Number(r.incidents).toLocaleString()} incidents`);
  } finally {
    await client.end();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });

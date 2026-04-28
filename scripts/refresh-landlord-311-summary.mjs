#!/usr/bin/env node
/**
 * Refresh landlord_311_summary by SUMming buildings.complaint_count per owner.
 *
 * Why this aggregation source: complaints_311_X tables are huge (NYC = 16M rows)
 * and live aggregation via PostgREST exceeds the anon role's 3s timeout.
 * The upstream 311 ETL keeps buildings.complaint_count current per-building, so
 * we just need to roll that up to owner_name. Same source landlord_stats uses,
 * but we skip the slow build-landlord-stats.mjs full rebuild — it's a 311-only
 * delta that can run nightly.
 *
 * Run:  node scripts/refresh-landlord-311-summary.mjs                  (all metros)
 *       node scripts/refresh-landlord-311-summary.mjs nyc              (single)
 *       node scripts/refresh-landlord-311-summary.mjs nyc chicago      (some)
 */
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const line of readFileSync(".env.local", "utf-8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq === -1) continue;
  env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^"|"$/g, "");
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const ALL_METROS = ["nyc", "los-angeles", "chicago", "miami", "houston"];

const GARBAGE = new Set([
  "AVAILABLE FROM DATA SOURCE",
  "NAME NOT ON FILE",
  "NOT AVAILABLE",
  "NOT AVAILABLE FROM THE DATA",
  "NOT AVAILABLE FROM THE DATA SOURCE",
  "UNKNOWN",
  "UNKNOWN OWNER",
  "N/A",
  "NA",
  "UNAVAILABLE",
  "UNAVAILABLE OWNER",
  "Taxpayer Unknown",
]);

async function refreshMetro(metro) {
  console.log(`\n[${metro}] aggregating buildings.complaint_count by owner_name...`);
  const t0 = Date.now();

  // Wipe existing rows
  {
    const { error } = await sb.from("landlord_311_summary").delete().eq("metro", metro);
    if (error) throw new Error(`delete: ${error.message}`);
  }

  // Page through buildings (with non-null owner + complaint_count > 0), sum per owner.
  // buildings.id is a UUID — page via offset since the dataset per metro is bounded.
  const owner = new Map(); // name → { complaint_count, building_count }
  const PAGE = 5000;
  let scanned = 0;
  let offset = 0;

  while (true) {
    const { data, error } = await sb
      .from("buildings")
      .select("owner_name,complaint_count")
      .eq("metro", metro)
      .not("owner_name", "is", null)
      .gt("complaint_count", 0)
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(`buildings page (offset=${offset}): ${error.message}`);
    if (!data || data.length === 0) break;

    for (const b of data) {
      if (GARBAGE.has(b.owner_name)) continue;
      const cur = owner.get(b.owner_name) ?? { complaint_count: 0, building_count: 0 };
      cur.complaint_count += b.complaint_count;
      cur.building_count += 1;
      owner.set(b.owner_name, cur);
    }

    scanned += data.length;
    offset += data.length;
    if (offset % 25000 === 0) {
      console.log(`  scanned ${scanned.toLocaleString()} buildings · ${owner.size.toLocaleString()} unique owners`);
    }
    if (data.length < PAGE) break;
  }

  console.log(`  scanned ${scanned.toLocaleString()} buildings total · ${owner.size.toLocaleString()} unique owners`);

  // Bulk upsert
  const rows = [];
  for (const [name, agg] of owner) {
    rows.push({
      metro,
      name,
      building_count: agg.building_count,
      complaint_count: agg.complaint_count,
    });
  }
  rows.sort((a, b) => b.complaint_count - a.complaint_count);

  let inserted = 0;
  for (let i = 0; i < rows.length; i += 1000) {
    const slice = rows.slice(i, i + 1000);
    const { error } = await sb
      .from("landlord_311_summary")
      .upsert(slice, { onConflict: "metro,name" });
    if (error) throw new Error(`upsert: ${error.message}`);
    inserted += slice.length;
  }

  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`  ✓ ${metro}: ${inserted.toLocaleString()} rows in ${dt}s`);
  if (rows.length > 0) {
    const top = rows[0];
    console.log(`  top: ${top.name} → ${top.complaint_count.toLocaleString()} complaints across ${top.building_count} bldg`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const targets = args.length > 0 ? args.filter((a) => ALL_METROS.includes(a)) : ALL_METROS;
  console.log(`Refreshing landlord_311_summary for: ${targets.join(", ")}`);

  for (const m of targets) {
    try {
      await refreshMetro(m);
    } catch (e) {
      console.error(`ERROR ${m}: ${e.message}`);
    }
  }
  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Step 3a — new-zips report.
 *
 * Looks at the LA buildings cohort and classifies each ZIP into one of:
 *   - "new"      — ZIP had no buildings before the recent imports; ALL of its
 *                  current buildings are from the recent push.
 *   - "expanded" — ZIP existed before but ≥30% of its buildings were added in
 *                  the recent push.
 *   - "stable"   — ZIP existed before; new additions are <30% of total.
 *
 * "Recent push" = anything created on or after CUTOFF_DATE (default 2026-04-29,
 * the day the multifamily LA import landed). Override with --cutoff=YYYY-MM-DD.
 *
 * Output: data/.mf-scrape/zip-impact-la.json
 *   {
 *     metadata: { cutoff, totalBuildings, totalZips, ... },
 *     byZip: [{ zip, total, recent, recent_pct, classification, sampleNeighborhood }]
 *   }
 *
 * Usage:
 *   node scripts/multifamily-new-zips.mjs                  # apply default cutoff
 *   node scripts/multifamily-new-zips.mjs --cutoff=2026-04-29
 *   node scripts/multifamily-new-zips.mjs --top=20         # also print top-N to stdout
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split("\n")
    .filter((l) => l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const args = process.argv.slice(2);
const ARG = (n) => { const i = args.findIndex((a) => a === n || a.startsWith(`${n}=`)); if (i === -1) return null; const v = args[i]; return v.includes("=") ? v.split("=")[1] : args[i + 1]; };

const CUTOFF = ARG("--cutoff") || "2026-04-29";
const TOP_N = ARG("--top") ? parseInt(ARG("--top"), 10) : 25;
const METRO = "los-angeles";
const OUT_PATH = "data/.mf-scrape/zip-impact-la.json";

console.log(`metro=${METRO}  cutoff=${CUTOFF}  out=${OUT_PATH}\n`);

// Pull all LA buildings, keyset-paginated by id (avoids deep-offset PostgREST stalls).
async function fetchAll() {
  const PAGE = 5000;
  let lastId = "";
  const all = [];
  while (true) {
    let q = sb.from("buildings")
      .select("id, zip_code, created_at, borough")
      .eq("metro", METRO)
      .order("id", { ascending: true })
      .limit(PAGE);
    if (lastId) q = q.gt("id", lastId);
    let data = null, lastErr = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const res = await Promise.race([
          q,
          new Promise((_, rej) => setTimeout(() => rej(new Error("client timeout 60s")), 60_000)),
        ]);
        if (res.error) { lastErr = res.error; await new Promise(r => setTimeout(r, 2000 * (attempt + 1))); continue; }
        data = res.data; lastErr = null; break;
      } catch (e) {
        lastErr = e; await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
      }
    }
    if (lastErr || !data) {
      console.error(`page fetch failed: ${lastErr?.message}`);
      process.exit(1);
    }
    if (!data.length) break;
    all.push(...data);
    lastId = data[data.length - 1].id;
    process.stdout.write(`\r  fetched ${all.length.toLocaleString()} buildings`);
    if (data.length < PAGE) break;
  }
  console.log("");
  return all;
}

function classify(total, recent) {
  if (recent === total && total > 0) return "new";
  if (total === 0) return "empty";
  const pct = recent / total;
  if (pct >= 0.30) return "expanded";
  return "stable";
}

async function main() {
  const t0 = Date.now();
  console.log("loading LA buildings…");
  const rows = await fetchAll();
  console.log(`  total: ${rows.length.toLocaleString()}\n`);

  // Aggregate by zip
  const byZip = new Map();
  for (const r of rows) {
    const zip = (r.zip_code || "").trim();
    if (!zip) continue;
    if (!byZip.has(zip)) byZip.set(zip, { zip, total: 0, recent: 0, neighborhoods: new Map() });
    const ent = byZip.get(zip);
    ent.total++;
    if (r.created_at && r.created_at >= CUTOFF) ent.recent++;
    if (r.borough) ent.neighborhoods.set(r.borough, (ent.neighborhoods.get(r.borough) || 0) + 1);
  }

  // Build the output array
  const out = [];
  for (const [, e] of byZip) {
    const recent_pct = e.total > 0 ? +(e.recent / e.total).toFixed(3) : 0;
    // Sample neighborhood = the most-frequent borough/neighborhood label in this ZIP
    const sample = [...e.neighborhoods.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    out.push({
      zip: e.zip,
      total: e.total,
      recent: e.recent,
      recent_pct,
      classification: classify(e.total, e.recent),
      sampleNeighborhood: sample,
    });
  }

  // Counts by classification
  const cls = { new: 0, expanded: 0, stable: 0, empty: 0 };
  for (const z of out) cls[z.classification] = (cls[z.classification] || 0) + 1;

  out.sort((a, b) => b.recent - a.recent || b.total - a.total);

  // Write JSON
  const payload = {
    metadata: {
      metro: METRO,
      cutoff: CUTOFF,
      generated_at: new Date().toISOString(),
      totalBuildings: rows.length,
      totalZips: out.length,
      classification: cls,
      tookSecs: ((Date.now() - t0) / 1000).toFixed(1),
    },
    byZip: out,
  };
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2));

  // Print summary
  console.log("═══ ZIP IMPACT (LA) ═══");
  console.log(`  total buildings: ${rows.length.toLocaleString()}`);
  console.log(`  total zips:      ${out.length}`);
  console.log(`  classification:`);
  console.log(`    new       (100% recent):  ${cls.new}`);
  console.log(`    expanded  (≥30% recent):  ${cls.expanded}`);
  console.log(`    stable    (<30% recent):  ${cls.stable}`);
  console.log(`\n  written: ${OUT_PATH}`);

  if (TOP_N > 0) {
    console.log(`\n  top ${TOP_N} ZIPs by recent additions:`);
    console.log(`    ${"ZIP".padEnd(7)} ${"recent".padStart(7)} ${"total".padStart(7)} ${"pct".padStart(6)}  class       neighborhood`);
    for (const z of out.slice(0, TOP_N)) {
      const pct = (z.recent_pct * 100).toFixed(1) + "%";
      console.log(`    ${z.zip.padEnd(7)} ${String(z.recent).padStart(7)} ${String(z.total).padStart(7)} ${pct.padStart(6)}  ${z.classification.padEnd(10)}  ${z.sampleNeighborhood || ""}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

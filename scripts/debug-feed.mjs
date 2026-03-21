import { createRequire } from "module";
import { readFileSync } from "fs";
import { resolve } from "path";

const envPath = resolve(process.cwd(), ".env.local");
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const idx = trimmed.indexOf("=");
  if (idx === -1) continue;
  const key = trimmed.slice(0, idx).trim();
  const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "").replace(/\\n$/g, "");
  if (!process.env[key]) process.env[key] = val;
}

const require = createRequire(import.meta.url);
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Check counts for each feed source
const tables = [
  { name: "hpd_violations", dateCol: "inspection_date", bblCol: "bbl" },
  { name: "complaints_311", dateCol: "created_date", bblCol: "bbl" },
  { name: "hpd_litigations", dateCol: "case_open_date", bblCol: "bbl" },
  { name: "dob_violations", dateCol: "issue_date", bblCol: "bbl" },
  { name: "bedbug_reports", dateCol: "filing_date", bblCol: "bbl" },
  { name: "evictions", dateCol: "executed_date", bblCol: null },
];

const cutoff = new Date();
cutoff.setDate(cutoff.getDate() - 90);
const cutoffDate = cutoff.toISOString().slice(0, 10);

console.log("=== Activity Feed Debug ===");
console.log(`Date cutoff: ${cutoffDate}\n`);

for (const t of tables) {
  // Total recent records
  const { count: totalRecent } = await sb
    .from(t.name)
    .select("*", { count: "exact", head: true })
    .gte(t.dateCol, cutoffDate);

  // Recent with building_id
  const { count: linked } = await sb
    .from(t.name)
    .select("*", { count: "exact", head: true })
    .gte(t.dateCol, cutoffDate)
    .not("building_id", "is", null);

  // Recent with BBL but no building_id
  let unlinkable = "N/A";
  if (t.bblCol) {
    const { count: c } = await sb
      .from(t.name)
      .select("*", { count: "exact", head: true })
      .gte(t.dateCol, cutoffDate)
      .is("building_id", null)
      .not(t.bblCol, "is", null);
    unlinkable = String(c);
  }

  console.log(`${t.name}:`);
  console.log(`  Recent (90d): ${totalRecent}`);
  console.log(`  With building_id: ${linked}`);
  console.log(`  Has BBL but no building_id: ${unlinkable}`);
  console.log();
}

// Check sample unlinked HPD records
const { data: sample } = await sb
  .from("hpd_violations")
  .select("id, bbl, building_id, inspection_date, imported_at")
  .is("building_id", null)
  .not("bbl", "is", null)
  .gte("inspection_date", cutoffDate)
  .order("inspection_date", { ascending: false })
  .limit(5);

console.log("Sample unlinked HPD violations (with BBL):");
for (const r of sample || []) {
  // Check if this BBL exists in buildings
  const { data: building } = await sb
    .from("buildings")
    .select("id, bbl")
    .eq("bbl", r.bbl)
    .limit(1)
    .single();

  console.log(`  BBL: ${r.bbl} | date: ${r.inspection_date} | building match: ${building ? "YES (" + building.id + ")" : "NO"}`);
}

// Check sync_log for recent runs
const { data: syncLogs } = await sb
  .from("sync_log")
  .select("*")
  .order("started_at", { ascending: false })
  .limit(10);

console.log("\nRecent sync_log entries:");
for (const log of syncLogs || []) {
  console.log(`  ${log.source} | ${log.status} | started: ${log.started_at} | added: ${log.records_added} | linked: ${log.records_linked}`);
}

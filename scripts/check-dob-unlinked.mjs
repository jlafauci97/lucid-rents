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

// Get recent DOB violations with no building_id
const { data: unlinked, error } = await sb
  .from("dob_violations")
  .select("id, bbl, building_id, issue_date")
  .is("building_id", null)
  .not("bbl", "is", null)
  .gte("issue_date", "2025-12-01")
  .order("issue_date", { ascending: false })
  .limit(10);

if (error) {
  console.log("Error:", error.message);
} else if (!unlinked || unlinked.length === 0) {
  console.log("No unlinked DOB violations found in recent period!");
} else {
  console.log(`Found ${unlinked.length} unlinked DOB violations:`);
  for (const r of unlinked) {
    const { data: match } = await sb.from("buildings").select("id, bbl").eq("bbl", r.bbl).limit(1);
    console.log(`  BBL: "${r.bbl}" (len: ${r.bbl.length}) | date: ${r.issue_date} | building match: ${match && match.length > 0 ? "YES" : "NO"}`);
  }
}

// Also check how many unlinked DOB with BBL exist in the recent period
const { count } = await sb
  .from("dob_violations")
  .select("*", { count: "exact", head: true })
  .is("building_id", null)
  .not("bbl", "is", null)
  .gte("issue_date", "2025-12-01");

console.log(`\nTotal unlinked DOB violations (since 2025-12-01): ${count}`);

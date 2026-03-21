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

// Sample DOB BBLs
const { data: dob } = await sb.from("dob_violations").select("id, bbl, building_id").not("bbl", "is", null).limit(10);
console.log("DOB BBL samples:");
for (const r of dob || []) {
  console.log(`  "${r.bbl}" (len: ${r.bbl.length}) building_id: ${r.building_id || "NULL"}`);
}

// Sample building BBLs
const { data: bldg } = await sb.from("buildings").select("id, bbl").not("bbl", "is", null).limit(5);
console.log("\nBuilding BBL samples:");
for (const r of bldg || []) {
  console.log(`  "${r.bbl}" (len: ${r.bbl.length})`);
}

// Try matching first 3 DOB BBLs
console.log("\nMatch tests:");
for (const r of (dob || []).slice(0, 5)) {
  const { data: match } = await sb.from("buildings").select("id, bbl").eq("bbl", r.bbl).limit(1);
  console.log(`  DOB "${r.bbl}" -> ${match && match.length > 0 ? "MATCH (building " + match[0].id + ")" : "NO MATCH"}`);
}

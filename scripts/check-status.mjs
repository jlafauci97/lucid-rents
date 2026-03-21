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

const tables = [
  { name: "dob_violations", label: "DOB Violations" },
  { name: "hpd_violations", label: "HPD Violations" },
  { name: "hpd_litigations", label: "HPD Litigations" },
  { name: "evictions", label: "Evictions" },
  { name: "bedbug_reports", label: "Bedbug Reports" },
];

for (const t of tables) {
  const { count: total } = await supabase.from(t.name).select("id", { count: "exact", head: true });
  const { count: unlinked } = await supabase.from(t.name).select("id", { count: "exact", head: true }).is("building_id", null);
  if (total !== null && unlinked !== null) {
    const pct = total > 0 ? ((total - unlinked) / total * 100).toFixed(1) : "0";
    console.log(`${t.label}: ${(total - unlinked).toLocaleString()} linked / ${unlinked.toLocaleString()} unlinked (${pct}%)`);
  } else {
    console.log(`${t.label}: count timed out`);
  }
}

// 311 per borough (unlinked only — faster)
console.log("\n311 Complaints by borough:");
let total311Linked = 0;
let total311Unlinked = 0;
for (const boro of ["MANHATTAN", "BROOKLYN", "BRONX", "QUEENS", "STATEN ISLAND"]) {
  const { count: unlinked } = await supabase.from("complaints_311").select("id", { count: "exact", head: true }).is("building_id", null).eq("borough", boro);
  const { count: linked } = await supabase.from("complaints_311").select("id", { count: "exact", head: true }).not("building_id", "is", null).eq("borough", boro);
  if (unlinked !== null && linked !== null) {
    total311Linked += linked;
    total311Unlinked += unlinked;
    console.log(`  ${boro}: ${linked.toLocaleString()} linked / ${unlinked.toLocaleString()} unlinked`);
  } else {
    console.log(`  ${boro}: count timed out`);
  }
}
console.log(`  TOTAL: ${total311Linked.toLocaleString()} linked / ${total311Unlinked.toLocaleString()} unlinked`);

const { count: buildings } = await supabase.from("buildings").select("id", { count: "exact", head: true });
console.log(`\nBuildings: ${buildings?.toLocaleString()}`);

import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const envRaw = readFileSync(".env.local", "utf-8");
const env = {};
for (const line of envRaw.split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq === -1) continue;
  env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^"|"$/g, "").replace(/\\n/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Check most recently updated buildings with owner_name
const { data, error } = await sb
  .from("buildings")
  .select("id,bbl,owner_name,full_address,updated_at")
  .not("owner_name", "is", null)
  .order("updated_at", { ascending: false })
  .limit(10);

if (error) { console.error(error.message); process.exit(1); }

console.log("Most recently updated buildings with owner_name:");
for (const b of data) {
  console.log(`  ${b.updated_at} | BBL ${b.bbl} | ${b.owner_name} | ${b.full_address}`);
}

// Count total with owner now
const { count } = await sb.from("buildings").select("id", { count: "exact", head: true }).not("owner_name", "is", null);
console.log("\nTotal buildings with owner_name:", count);

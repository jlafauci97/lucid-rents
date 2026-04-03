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

// Try estimated count (much faster)
for (const boro of ["MANHATTAN", "BROOKLYN", "BRONX", "QUEENS", "STATEN ISLAND"]) {
  // Get linked count using estimated mode
  const { count: linked } = await supabase.from("complaints_311").select("id", { count: "estimated", head: true }).not("building_id", "is", null).eq("borough", boro);
  const { count: unlinked } = await supabase.from("complaints_311").select("id", { count: "estimated", head: true }).is("building_id", null).eq("borough", boro);
  console.log(`${boro}: ~${linked?.toLocaleString()} linked / ~${unlinked?.toLocaleString()} unlinked`);
}

// Building count estimated
const { count: bldgs } = await supabase.from("buildings").select("id", { count: "estimated", head: true });
console.log(`\nBuildings: ~${bldgs?.toLocaleString()}`);

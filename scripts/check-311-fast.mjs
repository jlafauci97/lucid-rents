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

// Use paginated approach to estimate unlinked 311
// Just check if there are ANY unlinked, then try to get count with borough filter
for (const boro of ["MANHATTAN", "BROOKLYN", "BRONX", "QUEENS", "STATEN ISLAND"]) {
  // Check if there are unlinked records in this borough
  const { data: sample } = await supabase
    .from("complaints_311")
    .select("id")
    .is("building_id", null)
    .eq("borough", boro)
    .limit(1);
  
  if (sample?.length === 0) {
    console.log(`${boro}: DONE (0 unlinked)`);
  } else {
    // Has unlinked - try to estimate with a limited count
    const { count } = await supabase
      .from("complaints_311")
      .select("id", { count: "estimated", head: true })
      .is("building_id", null)
      .eq("borough", boro);
    console.log(`${boro}: ~${count} unlinked (estimated)`);
  }
}

// Buildings count
const { count: bldgs } = await supabase.from("buildings").select("id", { count: "estimated", head: true });
console.log(`\nBuildings: ~${bldgs} (estimated)`);

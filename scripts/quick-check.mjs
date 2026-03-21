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

// Just check if there are any unlinked 311 records (quick check, no full count)
const { data: sample311 } = await supabase
  .from("complaints_311")
  .select("id, borough")
  .is("building_id", null)
  .limit(10);

if (sample311?.length === 0) {
  console.log("311: ALL LINKED!");
} else {
  console.log(`311: Still has unlinked records. Sample boroughs: ${sample311?.map(r => r.borough).join(", ")}`);
}

// Quick building count
const { count: bldgs } = await supabase.from("buildings").select("id", { count: "exact", head: true });
console.log(`Buildings: ${bldgs}`);

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

// Check sample of unlinked 311 — what do they look like?
const { data: samples } = await supabase
  .from("complaints_311")
  .select("id, incident_address, borough, complaint_type")
  .is("building_id", null)
  .limit(20);

console.log("Sample unlinked 311 records:");
for (const r of samples || []) {
  console.log(`  [${r.borough}] "${r.incident_address}" — ${r.complaint_type}`);
}

// Check how many have null/empty incident_address
const { data: nullAddr } = await supabase
  .from("complaints_311")
  .select("id")
  .is("building_id", null)
  .is("incident_address", null)
  .limit(1);

const { data: emptyAddr } = await supabase
  .from("complaints_311")
  .select("id")
  .is("building_id", null)
  .eq("incident_address", "")
  .limit(1);

console.log(`\nNull address exists: ${nullAddr?.length > 0}`);
console.log(`Empty address exists: ${emptyAddr?.length > 0}`);

// Check: how many have an address that starts with a number?
const { data: noNumber } = await supabase
  .from("complaints_311")
  .select("id, incident_address")
  .is("building_id", null)
  .not("incident_address", "is", null)
  .limit(50);

let parseable = 0;
let unparseable = 0;
for (const r of noNumber || []) {
  const addr = r.incident_address?.trim().replace(/\s+/g, " ");
  if (addr && /^\S+\s+.+$/.test(addr)) parseable++;
  else unparseable++;
}
console.log(`\nParseable addresses: ${parseable}/${noNumber?.length}`);
console.log(`Unparseable: ${unparseable}`);

import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

const envPath = resolve(process.cwd(), ".env.local");
const env = {};
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, "").replace(/\\n/g, "");
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log("=== Link Chicago Affordable Units to Buildings ===\n");

  // Load all unlinked affordable units
  const { data: units, error: uErr } = await supabase
    .from("chicago_affordable_units")
    .select("id, address")
    .is("building_id", null);

  if (uErr) { console.error("Fetch error:", uErr.message); return; }
  console.log(`Found ${units.length} unlinked affordable units`);

  let linked = 0;
  for (const unit of units) {
    if (!unit.address) continue;

    // Parse address: "1234 N MAIN ST" -> house_number="1234", street_name="N MAIN ST"
    const addr = unit.address.trim().toUpperCase();
    const match = addr.match(/^(\d+[-\d]*)\s+(.+)$/);
    if (!match) continue;

    const houseNum = match[1];
    const streetName = match[2];

    // Try to find matching building
    const { data: buildings } = await supabase
      .from("buildings")
      .select("id")
      .eq("metro", "chicago")
      .ilike("house_number", houseNum)
      .ilike("street_name", streetName)
      .limit(1);

    if (buildings && buildings.length > 0) {
      const { error: upErr } = await supabase
        .from("chicago_affordable_units")
        .update({ building_id: buildings[0].id })
        .eq("id", unit.id);

      if (!upErr) linked++;
    }
  }

  console.log(`\nDone! Linked ${linked} out of ${units.length} affordable units.`);
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });

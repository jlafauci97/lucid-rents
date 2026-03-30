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
  console.log("=== Link Chicago Violations to Buildings ===\n");

  // Step 1: Build an address lookup from Chicago buildings
  console.log("Loading Chicago buildings...");
  let allBuildings = [];
  let offset = 0;
  const PAGE = 5000;

  while (true) {
    const { data, error } = await supabase
      .from("buildings")
      .select("id, house_number, street_name")
      .eq("metro", "chicago")
      .not("house_number", "is", null)
      .not("street_name", "is", null)
      .range(offset, offset + PAGE - 1);

    if (error) { console.error("Building fetch error:", error.message); break; }
    if (!data || data.length === 0) break;
    allBuildings.push(...data);
    offset += PAGE;
    if (data.length < PAGE) break;
  }

  console.log(`Loaded ${allBuildings.length} buildings with addresses`);

  // Build lookup: "HOUSE_NUMBER|STREET_NAME" -> building_id
  const lookup = new Map();
  for (const b of allBuildings) {
    const key = `${(b.house_number || "").trim().toUpperCase()}|${(b.street_name || "").trim().toUpperCase()}`;
    if (key !== "|") lookup.set(key, b.id);
  }
  console.log(`Address lookup has ${lookup.size} unique addresses\n`);

  // Step 2: Iterate through unlinked violations in batches
  console.log("Linking violations...");
  let linked = 0;
  let processed = 0;
  let page = 0;
  const BATCH = 1000;

  while (true) {
    const { data: violations, error } = await supabase
      .from("dob_violations")
      .select("id, house_number, street_name")
      .eq("metro", "chicago")
      .is("building_id", null)
      .not("house_number", "is", null)
      .not("street_name", "is", null)
      .limit(BATCH);

    if (error) { console.error("Violation fetch error:", error.message); break; }
    if (!violations || violations.length === 0) break;

    // Match and update
    const updates = [];
    for (const v of violations) {
      const key = `${(v.house_number || "").trim().toUpperCase()}|${(v.street_name || "").trim().toUpperCase()}`;
      const buildingId = lookup.get(key);
      if (buildingId) {
        updates.push({ id: v.id, building_id: buildingId });
      }
    }

    if (updates.length > 0) {
      // Batch update using individual updates (supabase doesn't support bulk update by different values)
      for (let i = 0; i < updates.length; i += 100) {
        const batch = updates.slice(i, i + 100);
        const promises = batch.map((u) =>
          supabase.from("dob_violations").update({ building_id: u.building_id }).eq("id", u.id)
        );
        await Promise.all(promises);
      }
      linked += updates.length;
    }

    processed += violations.length;
    page++;
    if (page % 10 === 0) {
      console.log(`  Processed ${processed} violations, linked ${linked} so far...`);
    }

    // If none in this batch matched, we're going through unmatched ones - break to avoid infinite loop
    if (updates.length === 0) {
      // Skip these by fetching with offset
      console.log(`  ${violations.length} unmatched violations found, skipping...`);
      break;
    }
  }

  console.log(`\nDone! Linked ${linked} out of ${processed} violations processed.`);
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });

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

// Test specific addresses from the unlinked samples
const testAddrs = [
  { raw: "2588 7 AVENUE", houseNum: "2588", street: "7 AVENUE" },
  { raw: "43-10 48 STREET", houseNum: "43-10", street: "48 STREET" },
  { raw: "501 EAST  165 STREET", houseNum: "501", street: "EAST 165 STREET" },
  { raw: "787 EAST   46 STREET", houseNum: "787", street: "EAST 46 STREET" },
  { raw: "306 WEST   94 STREET", houseNum: "306", street: "WEST 94 STREET" },
];

for (const t of testAddrs) {
  const streetPattern = t.street.split(" ").filter(Boolean).join("%");
  
  // Current lookup method
  const { data: match } = await supabase
    .from("buildings")
    .select("id, house_number, street_name, full_address")
    .eq("house_number", t.houseNum)
    .ilike("street_name", streetPattern)
    .limit(3);
  
  console.log(`\n"${t.raw}" -> house="${t.houseNum}" street="${t.street}" pattern="${streetPattern}"`);
  if (match?.length > 0) {
    console.log(`  MATCH: ${match[0].full_address}`);
  } else {
    console.log(`  NO MATCH`);
    // Try just by house number to see what streets exist
    const { data: byHouse } = await supabase
      .from("buildings")
      .select("street_name")
      .eq("house_number", t.houseNum)
      .limit(5);
    if (byHouse?.length > 0) {
      console.log(`  Streets at house ${t.houseNum}: ${byHouse.map(b => b.street_name).join(", ")}`);
    } else {
      console.log(`  No buildings with house_number="${t.houseNum}" at all`);
    }
  }
}

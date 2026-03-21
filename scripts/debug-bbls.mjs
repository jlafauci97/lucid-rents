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

// Sample DOB violation BBLs
const { data: dobSample } = await sb
  .from("dob_violations")
  .select("id, bbl")
  .is("building_id", null)
  .not("bbl", "is", null)
  .limit(10);
console.log("DOB violation sample BBLs:");
for (const r of dobSample || []) {
  console.log(`  "${r.bbl}" (len: ${r.bbl.length})`);
}

// Sample HPD violation BBLs (recent only to avoid timeout)
const { data: hpdSample } = await sb
  .from("hpd_violations")
  .select("id, bbl")
  .is("building_id", null)
  .not("bbl", "is", null)
  .gte("inspection_date", "2026-03-01")
  .limit(10);
console.log("\nHPD violation sample BBLs:");
for (const r of hpdSample || []) {
  console.log(`  "${r.bbl}" (len: ${r.bbl.length})`);
}

// Sample buildings BBLs
const { data: bldgSample } = await sb
  .from("buildings")
  .select("id, bbl")
  .not("bbl", "is", null)
  .limit(10);
console.log("\nBuildings table sample BBLs:");
for (const r of bldgSample || []) {
  console.log(`  "${r.bbl}" (len: ${r.bbl.length})`);
}

// Try to match DOB BBLs against buildings with different truncation strategies
if (dobSample && dobSample.length > 0) {
  for (const r of dobSample.slice(0, 3)) {
    const bbl = r.bbl;
    // DOB BBL: boro(1) + block(5) + lot(5) = 11
    // Buildings BBL: boro(1) + block(5) + lot(4) = 10
    const boro = bbl.slice(0, 1);
    const block = bbl.slice(1, 6);
    const lot5 = bbl.slice(6, 11);
    const lot4 = lot5.slice(0, 4); // drop last digit
    const tenDigit = boro + block + lot4;

    console.log(`\nDOB BBL "${bbl}" -> boro=${boro} block=${block} lot=${lot5}`);
    console.log(`  10-digit (lot truncated): "${tenDigit}"`);

    const { data: m1 } = await sb.from("buildings").select("id, bbl, full_address").eq("bbl", tenDigit).limit(1);
    console.log(`  Match "${tenDigit}":`, m1?.length ? `YES -> ${m1[0].full_address}` : "NO");

    // Also try like query for any building with this boro+block
    const { data: m2 } = await sb.from("buildings").select("id, bbl").like("bbl", `${boro}${block}%`).limit(3);
    console.log(`  Buildings with boro+block "${boro}${block}*":`, m2?.map(b => b.bbl).join(", ") || "NONE");
  }
}

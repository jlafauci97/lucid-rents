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

const { count: withOwner } = await sb.from("buildings").select("id", { count: "exact", head: true }).not("owner_name", "is", null);
const { count: withoutOwner } = await sb.from("buildings").select("id", { count: "exact", head: true }).is("owner_name", null);
const { count: withoutOwnerWithBbl } = await sb.from("buildings").select("id", { count: "exact", head: true }).is("owner_name", null).not("bbl", "is", null);
const { count: withoutOwnerNoBbl } = await sb.from("buildings").select("id", { count: "exact", head: true }).is("owner_name", null).is("bbl", null);

console.log("Buildings WITH owner_name:", withOwner);
console.log("Buildings WITHOUT owner_name:", withoutOwner);
console.log("  - with BBL:", withoutOwnerWithBbl);
console.log("  - no BBL:", withoutOwnerNoBbl);

// Sample BBLs
const { data: samples } = await sb.from("buildings").select("bbl,full_address,borough").is("owner_name", null).not("bbl", "is", null).limit(10);
console.log("\nSample buildings missing owner_name:");
for (const s of samples) {
  console.log("  BBL:", s.bbl, "|", s.full_address, "|", s.borough);
}

// Test a sample BBL against PLUTO
if (samples.length > 0) {
  const testBbl = samples[0].bbl;
  console.log("\nTesting PLUTO for BBL:", testBbl);
  const resp = await fetch(`https://data.cityofnewyork.us/resource/64uk-42ks.json?$where=bbl='${testBbl}'&$limit=1`);
  const data = await resp.json();
  console.log("PLUTO result:", data.length > 0 ? JSON.stringify(data[0]).slice(0, 200) : "NO DATA");

  // Try without quotes
  const resp2 = await fetch(`https://data.cityofnewyork.us/resource/64uk-42ks.json?$where=bbl=${testBbl}&$limit=1`);
  const data2 = await resp2.json();
  console.log("PLUTO (no quotes):", data2.length > 0 ? "FOUND" : "NO DATA");
}

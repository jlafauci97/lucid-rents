#!/usr/bin/env node
/**
 * Fix the 8 null-BBL buildings that have linked 311 complaints.
 * Geocodes their address, then merges into existing or assigns BBL.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

const envPath = resolve(process.cwd(), ".env.local");
const env = {};
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, "").replace(/\\n/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Remaining 5 (first 3 already merged)
const IDS = [
  "7cfff141-9e73-4a27-a606-659590a6f278",
  "72fe229c-610a-43e4-a189-58387623876b",
  "bc1a2586-73bc-4418-96ce-f98347e1332e",
  "b6569afa-ddda-4caf-8a97-1fed7e000fd7",
  "1b5fb6df-f331-4199-8994-6f65886efaa6",
];

const LINK_TABLES = [
  "hpd_violations", "dob_violations", "hpd_litigations",
  "evictions", "bedbug_reports", "complaints_311",
  "dob_permits", "sidewalk_sheds", "nypd_complaints",
];

for (const id of IDS) {
  const { data: b } = await sb.from("buildings").select("id,full_address,house_number,street_name,borough").eq("id", id).single();
  if (!b) { console.log("Not found:", id); continue; }

  const q = `${b.house_number} ${b.street_name}, ${b.borough}, NY`;
  const resp = await fetch(`https://geosearch.planninglabs.nyc/v2/search?text=${encodeURIComponent(q)}&size=1`);
  const json = await resp.json();
  const bbl = json?.features?.[0]?.properties?.addendum?.pad?.bbl;

  if (!bbl) { console.log("No BBL for:", b.full_address); continue; }

  const { data: existing } = await sb.from("buildings").select("id,full_address").eq("bbl", bbl).neq("id", id).limit(1);

  if (existing && existing.length > 0) {
    const keepId = existing[0].id;
    for (const t of LINK_TABLES) {
      await sb.from(t).update({ building_id: keepId }).eq("building_id", id);
    }
    await sb.from("buildings").delete().eq("id", id);
    console.log(`MERGED: ${b.full_address} -> BBL ${bbl} (into ${existing[0].full_address})`);
  } else {
    await sb.from("buildings").update({ bbl }).eq("id", id);
    console.log(`ASSIGNED BBL: ${b.full_address} -> ${bbl}`);
  }
}
console.log("Done.");

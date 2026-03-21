#!/usr/bin/env node
/**
 * Link unlinked 311 complaints to buildings by address matching.
 * Builds an in-memory address->building_id index for fast lookups.
 * Run: node scripts/link-311-by-address.mjs
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

// Step 1: Build address index from buildings table
console.log("Loading building address index...");
const addrIndex = new Map(); // normalized address -> building_id
let bOffset = 0;
while (true) {
  const { data: buildings, error } = await sb
    .from("buildings")
    .select("id, full_address")
    .not("full_address", "is", null)
    .range(bOffset, bOffset + 999);
  if (error) { console.error("Building fetch error:", error.message); break; }
  if (!buildings || buildings.length === 0) break;

  for (const b of buildings) {
    // Extract just the street address part (before the borough/city)
    const full = b.full_address.trim().toUpperCase().replace(/\s+/g, " ");
    // Extract street part: "123 MAIN STREET, Brooklyn, NY, 11201" -> "123 MAIN STREET"
    const commaIdx = full.indexOf(",");
    const street = commaIdx > 0 ? full.slice(0, commaIdx).trim() : full;
    if (street && !addrIndex.has(street)) {
      addrIndex.set(street, b.id);
    }
  }

  bOffset += buildings.length;
  if (buildings.length < 1000) break;
}
console.log(`Loaded ${addrIndex.size} unique addresses from ${bOffset} buildings`);

// Step 2: Process unlinked 311 complaints
let totalLinked = 0;
let totalUnmatched = 0;
let offset = 0;
let pass = 0;

while (true) {
  pass++;
  const { data: unlinked, error } = await sb
    .from("complaints_311")
    .select("id, incident_address")
    .is("building_id", null)
    .not("incident_address", "is", null)
    .range(offset, offset + 999);

  if (error) { console.error("Fetch error:", error.message); break; }
  if (!unlinked || unlinked.length === 0) break;

  // Group by building_id match
  const buildingToIds = new Map();
  let unmatched = 0;
  for (const r of unlinked) {
    const addr = r.incident_address.trim().toUpperCase().replace(/\s+/g, " ");
    const buildingId = addrIndex.get(addr);
    if (buildingId) {
      if (!buildingToIds.has(buildingId)) buildingToIds.set(buildingId, []);
      buildingToIds.get(buildingId).push(r.id);
    } else {
      unmatched++;
    }
  }

  let batchLinked = 0;
  const entries = [...buildingToIds.entries()];
  for (let i = 0; i < entries.length; i += 20) {
    const chunk = entries.slice(i, i + 20);
    await Promise.all(
      chunk.map(async ([buildingId, ids]) => {
        for (let j = 0; j < ids.length; j += 200) {
          const batch = ids.slice(j, j + 200);
          const { error: updateErr } = await sb
            .from("complaints_311")
            .update({ building_id: buildingId })
            .in("id", batch);
          if (!updateErr) batchLinked += batch.length;
        }
      })
    );
  }

  totalLinked += batchLinked;
  totalUnmatched += unmatched;
  console.log(`Pass ${pass}: ${unlinked.length} records, ${batchLinked} linked, ${unmatched} unmatched`);

  if (batchLinked === 0) {
    offset += unlinked.length;
  }

  if (unlinked.length < 1000) break;
  await new Promise(r => setTimeout(r, 50));
}

console.log(`\nDone! Total linked: ${totalLinked}, unmatched: ${totalUnmatched}`);

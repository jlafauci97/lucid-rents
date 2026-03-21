#!/usr/bin/env node
/**
 * Fix malformed BBLs in dob_violations and link them to buildings.
 * Issues: letter-prefixed BBLs (M, B, Q, K, S) and 11-digit BBLs.
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

const BORO_MAP = { M: "1", B: "2", K: "3", Q: "4", S: "5" };

function normalizeBbl(bbl) {
  if (!bbl) return null;
  // Letter prefix: M0032300001 -> 1 + 00323 + 0001
  if (/^[MBKQS]/.test(bbl)) {
    const code = BORO_MAP[bbl[0]];
    if (!code) return null;
    const rest = bbl.slice(1);
    if (rest.length === 10) {
      // Format: Letter + 5-digit block + 5-digit lot -> trim lot to 4
      return code + rest.slice(0, 5) + rest.slice(6, 10);
    } else if (rest.length === 9) {
      return code + rest;
    }
    return null;
  }
  // 11-digit: trim lot from 5 to 4
  if (/^\d{11}$/.test(bbl)) {
    return bbl.slice(0, 6) + bbl.slice(7, 11);
  }
  if (/^\d{10}$/.test(bbl)) {
    return bbl;
  }
  return null;
}

async function main() {
  console.log("Fetching unlinked DOB violations with bad BBLs...");

  let totalFixed = 0;
  let totalLinked = 0;
  let offset = 0;

  while (true) {
    const { data, error } = await sb
      .from("dob_violations")
      .select("id, bbl")
      .is("building_id", null)
      .not("bbl", "is", null)
      .range(offset, offset + 999);

    if (error) { console.error("Fetch error:", error.message); break; }
    if (!data || data.length === 0) break;

    // Group by normalized BBL
    const bblToIds = new Map();
    let badCount = 0;
    for (const r of data) {
      const normalized = normalizeBbl(r.bbl);
      if (!normalized || normalized === r.bbl) {
        // Already normalized or unfixable — skip for offset
        continue;
      }
      badCount++;
      if (!bblToIds.has(normalized)) bblToIds.set(normalized, []);
      bblToIds.get(normalized).push(r.id);
    }

    if (badCount === 0 && data.length > 0) {
      // All records at this offset have valid BBLs but no building match
      offset += data.length;
      continue;
    }

    // Update BBLs in batches
    for (const [normalizedBbl, ids] of bblToIds) {
      for (let i = 0; i < ids.length; i += 100) {
        const batch = ids.slice(i, i + 100);
        await sb.from("dob_violations").update({ bbl: normalizedBbl }).in("id", batch);
        totalFixed += batch.length;
      }

      // Now try to link to building
      const { data: building } = await sb
        .from("buildings")
        .select("id")
        .eq("bbl", normalizedBbl)
        .limit(1);

      if (building && building.length > 0) {
        const buildingId = building[0].id;
        for (let i = 0; i < ids.length; i += 100) {
          const batch = ids.slice(i, i + 100);
          await sb.from("dob_violations").update({ building_id: buildingId }).in("id", batch);
          totalLinked += batch.length;
        }
      }
    }

    console.log(`Progress: fixed ${totalFixed}, linked ${totalLinked} (offset ${offset})`);

    if (data.length < 1000) break;
    // Don't increment offset — we just fixed records, so re-query same range
    // (fixed records now have valid BBLs and may have building_id)
  }

  console.log(`\nDone! Fixed ${totalFixed} BBLs, linked ${totalLinked} to buildings.`);

  // Count remaining unlinked
  const { count } = await sb
    .from("dob_violations")
    .select("id", { count: "exact", head: true })
    .is("building_id", null)
    .not("bbl", "is", null);
  console.log(`Remaining unlinked DOB violations with BBL: ${count}`);
}

main().catch(console.error);

#!/usr/bin/env node
/**
 * Backfill building_id for DOB violations by iterating through buildings
 * and updating matching unlinked DOB records. This avoids scanning the
 * 2.2M row dob_violations table for building_id IS NULL (which times out).
 */
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

console.log("Backfilling DOB violations from buildings table...\n");

let totalLinked = 0;
let totalBuildings = 0;
let hasMore = true;
let lastId = "";

while (hasMore) {
  // Paginate through buildings using cursor-based pagination
  let q = sb
    .from("buildings")
    .select("id, bbl")
    .not("bbl", "is", null)
    .order("id", { ascending: true })
    .limit(500);

  if (lastId) {
    q = q.gt("id", lastId);
  }

  const { data: buildings, error } = await q;

  if (error) {
    console.error(`Fetch error: ${error.message}`);
    await new Promise((r) => setTimeout(r, 5000));
    continue;
  }

  if (!buildings || buildings.length === 0) {
    hasMore = false;
    break;
  }

  lastId = buildings[buildings.length - 1].id;
  totalBuildings += buildings.length;

  // For each building, update any unlinked DOB violations with matching BBL
  // Process 20 at a time to avoid overwhelming Supabase
  let batchLinked = 0;
  for (let i = 0; i < buildings.length; i += 20) {
    const chunk = buildings.slice(i, i + 20);
    await Promise.all(
      chunk.map(async (b) => {
        const { count, error: updateErr } = await sb
          .from("dob_violations")
          .update({ building_id: b.id })
          .eq("bbl", b.bbl)
          .is("building_id", null)
          .select("id", { count: "exact", head: true });

        if (updateErr) {
          // Ignore "no rows updated" type errors
          if (!updateErr.message.includes("0 rows")) {
            console.error(`  Update error (${b.bbl}): ${updateErr.message}`);
          }
        } else if (count && count > 0) {
          batchLinked += count;
        }
      })
    );
  }

  totalLinked += batchLinked;
  if (totalBuildings % 5000 === 0 || batchLinked > 0) {
    console.log(`  Buildings processed: ${totalBuildings}, DOB linked: ${totalLinked}`);
  }

  await new Promise((r) => setTimeout(r, 100));
}

console.log(`\nDone! Buildings scanned: ${totalBuildings}, DOB violations linked: ${totalLinked}`);

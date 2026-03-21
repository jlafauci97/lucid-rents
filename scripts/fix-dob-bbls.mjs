#!/usr/bin/env node
/**
 * Fix DOB violations with 11-digit BBLs (5-digit lot) to 10-digit (4-digit lot).
 * DOB format: boro(1) + block(5) + lot(5) = 11 digits
 * Standard:   boro(1) + block(5) + lot(4) = 10 digits
 *
 * Uses concurrency-limited updates to avoid overwhelming Supabase.
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

// Group updates by target BBL and batch-update using .in("id", ids)
async function fixBatch(records) {
  // Group by target BBL
  const groups = new Map();
  for (const r of records) {
    const boro = r.bbl.slice(0, 1);
    const block = r.bbl.slice(1, 6);
    const lot5 = r.bbl.slice(6, 11);
    const lot4 = lot5.slice(-4);
    const fixedBbl = boro + block + lot4;

    if (!groups.has(fixedBbl)) groups.set(fixedBbl, []);
    groups.get(fixedBbl).push(r.id);
  }

  // Batch update each group (many records may share the same target BBL)
  let fixed = 0;
  let errors = 0;
  const entries = [...groups.entries()];

  // Process 20 groups concurrently
  for (let i = 0; i < entries.length; i += 20) {
    const chunk = entries.slice(i, i + 20);
    const results = await Promise.all(
      chunk.map(([fixedBbl, ids]) =>
        sb
          .from("dob_violations")
          .update({ bbl: fixedBbl })
          .in("id", ids)
          .then(({ error: e }) => {
            if (e) {
              errors += ids.length;
              console.error(`  Update error (${ids.length} records -> ${fixedBbl}): ${e.message}`);
            } else {
              fixed += ids.length;
            }
          })
      )
    );
  }

  return { fixed, errors };
}

console.log("Fixing DOB violations with 11-digit BBLs...\n");

let totalFixed = 0;
let totalErrors = 0;
let hasMore = true;

while (hasMore) {
  const { data: batch, error: err } = await sb
    .from("dob_violations")
    .select("id, bbl")
    .not("bbl", "is", null)
    .limit(1000);

  if (err) {
    console.error("Fetch error:", err.message);
    // Wait and retry on transient errors
    await new Promise((r) => setTimeout(r, 5000));
    continue;
  }

  // Filter to 11-digit BBLs in JS
  const toFix = (batch || []).filter((r) => r.bbl && r.bbl.length === 11);
  if (toFix.length === 0) {
    hasMore = false;
    break;
  }

  const { fixed, errors } = await fixBatch(toFix);
  totalFixed += fixed;
  totalErrors += errors;
  console.log(`Fixed ${fixed} records (total: ${totalFixed}, errors: ${totalErrors})`);

  await new Promise((r) => setTimeout(r, 200));
}

console.log(`\nDone! Total DOB BBLs fixed: ${totalFixed}, errors: ${totalErrors}`);

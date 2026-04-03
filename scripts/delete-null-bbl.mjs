#!/usr/bin/env node
/**
 * Delete all buildings with null BBL in batches.
 * These are empty shells with zero linked data.
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

let totalDeleted = 0;
const BATCH = 100;

while (true) {
  const { data: batch, error } = await sb
    .from("buildings")
    .select("id")
    .is("bbl", null)
    .limit(BATCH);

  if (error) {
    console.error("Fetch error:", error.message);
    break;
  }
  if (!batch || batch.length === 0) {
    console.log("No more null-BBL buildings.");
    break;
  }

  let batchDeleted = 0;
  // Delete one at a time to handle FK errors gracefully
  for (const b of batch) {
    const { error: delErr } = await sb
      .from("buildings")
      .delete()
      .eq("id", b.id);

    if (delErr) {
      if (totalDeleted === 0 && batchDeleted === 0) {
        console.error("Delete error on first attempt:", delErr.message, delErr.details, delErr.code);
      }
      // Skip FK-constrained rows
      continue;
    }
    batchDeleted++;
  }

  totalDeleted += batchDeleted;
  if (batchDeleted === 0) {
    console.log("No deletions in batch — likely all FK-constrained. Stopping.");
    break;
  }
  console.log(`Deleted ${totalDeleted} so far...`);
}

console.log(`\nDone! Total deleted: ${totalDeleted}`);

const { count } = await sb
  .from("buildings")
  .select("id", { count: "exact", head: true });
console.log(`Buildings remaining: ${count}`);

#!/usr/bin/env node
/**
 * Fast bulk score updater. Uses high concurrency and large batches.
 * Processes ~5000 buildings/minute.
 */
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const envRaw = readFileSync(".env.local", "utf-8");
const env = {};
for (const line of envRaw.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  env[trimmed.slice(0, eqIdx).trim()] = trimmed
    .slice(eqIdx + 1)
    .trim()
    .replace(/^"|"$/g, "")
    .replace(/\\n/g, "");
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

function deriveScore(v, c) {
  const t = (v || 0) + (c || 0);
  if (t === 0) return 10;
  return Math.round(Math.max(0, 10 - Math.log10(t + 1) * 3) * 10) / 10;
}

// Group buildings by score to batch-update all buildings with same score
async function processChunk(buildings) {
  // Group by computed score
  const byScore = {};
  for (const b of buildings) {
    const score = deriveScore(b.violation_count, b.complaint_count);
    if (!byScore[score]) byScore[score] = [];
    byScore[score].push(b.id);
  }

  // Update each score group — batch by ID list
  const promises = [];
  for (const [score, ids] of Object.entries(byScore)) {
    // Split into sub-batches of 200 IDs for the IN clause
    for (let i = 0; i < ids.length; i += 200) {
      const batch = ids.slice(i, i + 200);
      promises.push(
        sb
          .from("buildings")
          .update({ overall_score: parseFloat(score) })
          .in("id", batch)
          .then(({ error }) => {
            if (error) console.error(`\nUpdate err (score=${score}):`, error.message);
            return batch.length;
          })
      );
    }
  }

  // Run up to 10 concurrent batch updates
  let updated = 0;
  for (let i = 0; i < promises.length; i += 10) {
    const results = await Promise.all(promises.slice(i, i + 10));
    updated += results.reduce((a, b) => a + b, 0);
  }
  return updated;
}

async function main() {
  console.log("Bulk Score Updater");
  console.log("==================\n");

  const BATCH = 2000;
  let totalUpdated = 0;
  let round = 0;
  const startTime = Date.now();

  while (true) {
    round++;
    let data, error;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const res = await sb
        .from("buildings")
        .select("id, violation_count, complaint_count")
        .is("overall_score", null)
        .limit(BATCH);
      data = res.data;
      error = res.error;
      if (!error) break;
      console.error(`\nQuery error (attempt ${attempt}/3):`, error.message);
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }

    if (error) {
      console.error("\nFatal query error, stopping.");
      break;
    }
    if (!data || data.length === 0) break;

    const updated = await processChunk(data);
    totalUpdated += updated;

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    const rate = (totalUpdated / (elapsed / 60)).toFixed(0);
    process.stdout.write(
      `\rRound ${round}: ${totalUpdated.toLocaleString()} updated | ${rate}/min | ${elapsed}s elapsed`
    );

    // Tiny delay
    await new Promise((r) => setTimeout(r, 100));
  }

  console.log(`\n\nDone! Total updated: ${totalUpdated.toLocaleString()}`);

  const { count } = await sb
    .from("buildings")
    .select("id", { count: "exact", head: true })
    .is("overall_score", null);
  console.log(`Remaining without score: ${count}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

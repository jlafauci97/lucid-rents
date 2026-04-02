#!/usr/bin/env node
/**
 * Paraphrase all scraped reviews using Claude Haiku.
 * - Backs up originals to private.reviews_original (via RPC)
 * - Overwrites title + body with paraphrased versions
 * - Resumes from where it left off (skips already-backed-up reviews)
 *
 * Usage:
 *   node scripts/paraphrase-reviews.mjs [--dry-run] [--limit=N] [--concurrency=50]
 *
 * Requires .env.local with:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY
 */

import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

// ---------------------------------------------------------------------------
// ENV
// ---------------------------------------------------------------------------
const envRaw = readFileSync(".env.local", "utf-8");
const env = {};
for (const line of envRaw.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  const val = trimmed
    .slice(eqIdx + 1)
    .trim()
    .replace(/^"|"$/g, "")
    .replace(/\\n/g, "");
  env[key] = val;
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
const anthropicKey = env.ANTHROPIC_API_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
if (!anthropicKey) {
  console.error("Missing ANTHROPIC_API_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const anthropic = new Anthropic({ apiKey: anthropicKey });

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const limitArg = args.find((a) => a.startsWith("--limit="));
const concurrencyArg = args.find((a) => a.startsWith("--concurrency="));
const fetchLimit = limitArg ? parseInt(limitArg.split("=")[1]) : null;
const CONCURRENCY = concurrencyArg ? parseInt(concurrencyArg.split("=")[1]) : 5;
const RPM_LIMIT = 45; // Actual observed limit is 50 req/min
const MIN_INTERVAL_MS = (60 / RPM_LIMIT) * 1000;

// ---------------------------------------------------------------------------
// Paraphrase a single review
// ---------------------------------------------------------------------------
async function paraphrase(title, body) {
  const parts = [];
  if (title) parts.push(`Title: ${title}`);
  if (body) parts.push(`Review: ${body}`);
  const input = parts.join("\n\n");

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: input,
      },
    ],
    system: `You are a review rewriter. Rewrite the given review using different words while preserving:
- The exact same meaning, sentiment, and tone
- All specific details (names, addresses, unit numbers, dates, dollar amounts)
- The same approximate length
- Natural, authentic voice (it should still read like a real tenant review)

${title ? "Return the result as:\nTitle: <rewritten title>\nReview: <rewritten body>" : "Return ONLY the rewritten review text, nothing else."}

Do NOT add any preamble, explanation, or commentary.`,
  });

  const text = response.content[0].text.trim();

  if (title) {
    const titleMatch = text.match(/^Title:\s*(.+)/m);
    const bodyMatch = text.match(/^Review:\s*([\s\S]+)/m);
    return {
      title: titleMatch ? titleMatch[1].trim() : title,
      body: bodyMatch ? bodyMatch[1].trim() : text,
    };
  }

  return { title: null, body: text };
}

// ---------------------------------------------------------------------------
// Process a batch with concurrency control
// ---------------------------------------------------------------------------
// Serialized rate limiter — only one request dispatches at a time
const requestQueue = [];
let processing = false;
let lastRequestTime = 0;

function enqueueRequest() {
  return new Promise((resolve) => {
    requestQueue.push(resolve);
    drainQueue();
  });
}

async function drainQueue() {
  if (processing || requestQueue.length === 0) return;
  processing = true;
  while (requestQueue.length > 0) {
    const now = Date.now();
    const wait = MIN_INTERVAL_MS - (now - lastRequestTime);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequestTime = Date.now();
    const resolve = requestQueue.shift();
    resolve();
  }
  processing = false;
}

async function processBatch(reviews) {
  const results = [];
  const queue = [...reviews];
  const workers = [];

  for (let i = 0; i < Math.min(CONCURRENCY, queue.length); i++) {
    workers.push(
      (async () => {
        while (queue.length > 0) {
          const review = queue.shift();
          if (!review) break;
          await enqueueRequest();
          try {
            const rewritten = await paraphrase(review.title, review.body);
            results.push({ id: review.id, ...rewritten, success: true });
          } catch (err) {
            console.error(`  Failed review ${review.id}: ${err.message}`);
            if (err.status === 429) {
              const retryAfter = err.headers?.["retry-after"];
              const wait = (retryAfter ? parseInt(retryAfter) : 30) * 1000;
              console.log(`  Rate limited, waiting ${wait / 1000}s...`);
              await new Promise((r) => setTimeout(r, wait));
              try {
                const rewritten = await paraphrase(review.title, review.body);
                results.push({ id: review.id, ...rewritten, success: true });
              } catch (retryErr) {
                console.error(`  Retry failed ${review.id}: ${retryErr.message}`);
                results.push({ id: review.id, success: false });
              }
            } else {
              results.push({ id: review.id, success: false });
            }
          }
        }
      })()
    );
  }

  await Promise.all(workers);
  return results;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("Paraphrase scraped reviews");
  console.log(`  Concurrency: ${CONCURRENCY}`);
  console.log(`  Dry run: ${dryRun}`);
  if (fetchLimit) console.log(`  Limit: ${fetchLimit}`);

  // Count total work
  const { count: totalScraped } = await supabase
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .is("user_id", null)
    .eq("status", "published");

  console.log(`  Total scraped reviews: ${totalScraped}`);

  const PAGE_SIZE = 200;
  let offset = 0;
  let processed = 0;
  let failed = 0;
  const startTime = Date.now();

  while (true) {
    // Fetch next batch of scraped reviews
    const { data: batch, error: fetchErr } = await supabase
      .from("reviews")
      .select("id, title, body")
      .is("user_id", null)
      .eq("status", "published")
      .order("created_at", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (fetchErr) {
      console.error("Fetch error:", fetchErr.message);
      break;
    }

    if (!batch || batch.length === 0) {
      console.log("No more reviews to process.");
      break;
    }

    // Check which ones are already backed up (= already paraphrased)
    const ids = batch.map((r) => r.id);
    const { data: backedUp } = await supabase.rpc("get_backed_up_review_ids", {
      p_ids: ids,
    });

    const backedUpIds = new Set((backedUp || []).map((e) => e.review_id));
    const toProcess = batch.filter(
      (r) => !backedUpIds.has(r.id) && r.body && r.body.trim().length > 0
    );

    if (toProcess.length === 0) {
      offset += PAGE_SIZE;
      continue;
    }

    console.log(`\nBatch: ${toProcess.length} reviews (offset ${offset})`);

    if (dryRun) {
      console.log("  [dry-run] Would paraphrase:");
      toProcess.slice(0, 3).forEach((r) => {
        console.log(`    ${r.id}: ${(r.body || "").slice(0, 80)}...`);
      });
      offset += PAGE_SIZE;
      processed += toProcess.length;
      if (fetchLimit && processed >= fetchLimit) break;
      continue;
    }

    // Paraphrase the batch
    const results = await processBatch(toProcess);
    const succeeded = results.filter((r) => r.success);
    const failedBatch = results.filter((r) => !r.success);

    if (succeeded.length > 0) {
      // Backup originals via RPC (batch)
      const backupData = toProcess
        .filter((r) => succeeded.some((s) => s.id === r.id))
        .map((r) => ({
          review_id: r.id,
          original_title: r.title,
          original_body: r.body,
        }));

      const { error: backupErr } = await supabase.rpc("backup_reviews_batch", {
        p_data: backupData,
      });

      if (backupErr) {
        console.error("  Backup error:", backupErr.message);
        // Don't overwrite if backup failed — skip this batch
        offset += PAGE_SIZE;
        failed += succeeded.length;
        continue;
      }

      // Overwrite reviews with paraphrased text
      for (const result of succeeded) {
        const update = {};
        if (result.body !== null) update.body = result.body;
        if (result.title !== null) update.title = result.title;

        const { error: updateErr } = await supabase
          .from("reviews")
          .update(update)
          .eq("id", result.id);

        if (updateErr) {
          console.error(`  Update error for ${result.id}: ${updateErr.message}`);
          failed++;
        }
      }
    }

    processed += succeeded.length;
    failed += failedBatch.length;

    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    const rate = (processed / ((Date.now() - startTime) / 1000 / 60)).toFixed(0);
    console.log(
      `  Done: ${processed} processed, ${failed} failed | ${elapsed}min elapsed | ~${rate}/min`
    );

    offset += PAGE_SIZE;
    if (fetchLimit && processed >= fetchLimit) break;
  }

  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\nComplete: ${processed} paraphrased, ${failed} failed in ${totalTime} minutes.`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

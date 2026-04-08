/**
 * Generate static search index JSON files per metro.
 * Output: public/search/{metro}.json
 *
 * Each file is a sorted array of [address, slug, borough, score, reviews, violations] tuples.
 * Tuples instead of objects to minimize file size (~60% smaller).
 *
 * Usage: npx tsx scripts/generate-search-index.ts
 */
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "fs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const METROS = ["nyc", "los-angeles", "chicago", "miami", "houston"];
const BATCH_SIZE = 5000;

// Tuple format: [address, slug, borough, score, reviews, violations, name?]
type SearchTuple = [string, string, string, number | null, number, number, string?];

async function generateMetro(metro: string) {
  console.log(`[${metro}] Fetching...`);
  const buildings: SearchTuple[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("search_index")
      .select("full_address,slug,borough,overall_score,review_count,violation_count,name")
      .eq("metro", metro)
      .order("full_address", { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      console.error(`[${metro}] Error at ${offset}:`, error.message);
      // Retry once
      await new Promise(r => setTimeout(r, 2000));
      const retry = await supabase
        .from("search_index")
        .select("full_address,slug,borough,overall_score,review_count,violation_count,name")
        .eq("metro", metro)
        .order("full_address", { ascending: true })
        .range(offset, offset + BATCH_SIZE - 1);
      if (retry.error || !retry.data?.length) { offset += BATCH_SIZE; continue; }
      for (const b of retry.data) {
        const tuple: SearchTuple = [b.full_address, b.slug, b.borough, b.overall_score, b.review_count || 0, b.violation_count || 0];
        if (b.name) tuple.push(b.name);
        buildings.push(tuple);
      }
      offset += BATCH_SIZE;
      continue;
    }

    if (!data || data.length === 0) break;

    for (const b of data) {
      // Skip buildings with no data — nobody searches for empty entries
      // Keep all buildings that have reviews, violations, a name, or a score
      if (!b.review_count && !b.violation_count && !b.name && !b.overall_score) continue;
      const tuple: SearchTuple = [b.full_address, b.slug, b.borough, b.overall_score, b.review_count || 0, b.violation_count || 0];
      if (b.name) tuple.push(b.name);
      buildings.push(tuple);
    }

    offset += BATCH_SIZE;
    if (data.length < BATCH_SIZE) break;
    if (offset % 50000 === 0) console.log(`  [${metro}] ${offset} rows...`);
  }

  // Sort by address for binary search
  buildings.sort((a, b) => a[0].localeCompare(b[0]));

  const json = JSON.stringify(buildings);
  const path = `public/search/${metro}.json`;
  writeFileSync(path, json);

  const sizeMB = (json.length / 1024 / 1024).toFixed(1);
  console.log(`[${metro}] Done: ${buildings.length} buildings, ${sizeMB}MB`);
}

async function run() {
  mkdirSync("public/search", { recursive: true });

  // Run sequentially to avoid overloading Supabase
  for (const metro of METROS) {
    await generateMetro(metro);
  }
  console.log("All done!");
}

run().catch(console.error);

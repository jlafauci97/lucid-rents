/**
 * Populate Upstash Redis with search autocomplete data.
 *
 * Usage:
 *   npx tsx scripts/populate-search-redis.ts <metro> [offset]
 *   npx tsx scripts/populate-search-redis.ts nyc 480000
 *   npx tsx scripts/populate-search-redis.ts all          # all metros in parallel
 *
 * Stores top 5 results per (metro, address_prefix) in Redis.
 * Key format: ac:{metro}:{PREFIX} → JSON array of buildings
 */
import { createClient } from "@supabase/supabase-js";
import { Redis } from "@upstash/redis";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const redis = new Redis({
  url: (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL)!,
  token: (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN)!,
});

const ALL_METROS = ["nyc", "los-angeles", "chicago", "miami", "houston"];
const BATCH_SIZE = 5000;
const PIPE_SIZE = 500;

async function processMetro(metro: string, startOffset = 0) {
  console.log(`[${metro}] Starting from offset ${startOffset}...`);
  let offset = startOffset;
  let total = 0;
  const prefixMap = new Map<string, unknown[]>();

  while (true) {
    const { data, error } = await supabase
      .from("search_index")
      .select("id,full_address,borough,slug,name,zip_code,overall_score,review_count,violation_count,complaint_count,metro")
      .eq("metro", metro)
      .order("review_count", { ascending: false })
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      console.error(`[${metro}] Error at offset ${offset}:`, error.message);
      // Retry once after 2s
      await new Promise(r => setTimeout(r, 2000));
      const retry = await supabase
        .from("search_index")
        .select("id,full_address,borough,slug,name,zip_code,overall_score,review_count,violation_count,complaint_count,metro")
        .eq("metro", metro)
        .order("review_count", { ascending: false })
        .range(offset, offset + BATCH_SIZE - 1);
      if (retry.error || !retry.data?.length) {
        console.error(`[${metro}] Retry failed, skipping batch`);
        offset += BATCH_SIZE;
        continue;
      }
      // Use retry data
      for (const b of retry.data) processBuilding(b, metro, prefixMap);
      offset += BATCH_SIZE;
      total += retry.data.length;
      continue;
    }
    if (!data || data.length === 0) break;

    for (const b of data) processBuilding(b, metro, prefixMap);

    offset += BATCH_SIZE;
    total += data.length;

    // Flush to Redis every 50K buildings to avoid OOM
    if (prefixMap.size > 100000) {
      await flushToRedis(prefixMap, metro);
      prefixMap.clear();
    }

    if (data.length < BATCH_SIZE) break;
    if (total % 50000 === 0) console.log(`  [${metro}] ${total + startOffset} buildings, ${prefixMap.size} pending prefixes`);
  }

  // Final flush
  if (prefixMap.size > 0) {
    await flushToRedis(prefixMap, metro);
  }

  console.log(`[${metro}] Done! ${total} buildings processed from offset ${startOffset}`);
}

function processBuilding(b: Record<string, unknown>, metro: string, prefixMap: Map<string, unknown[]>) {
  const addr = b.full_address as string;
  if (!addr) return;
  // Only store prefixes 3-5 chars to save Redis space
  // Store compact objects (drop nulls and zeros)
  const compact: Record<string, unknown> = {
    id: b.id, full_address: b.full_address, borough: b.borough, slug: b.slug, metro: b.metro,
  };
  if (b.name) compact.name = b.name;
  if (b.zip_code) compact.zip_code = b.zip_code;
  if (b.overall_score) compact.overall_score = b.overall_score;
  if ((b.review_count as number) > 0) compact.review_count = b.review_count;
  if ((b.violation_count as number) > 0) compact.violation_count = b.violation_count;
  if ((b.complaint_count as number) > 0) compact.complaint_count = b.complaint_count;

  for (let len = 3; len <= Math.min(5, addr.length); len++) {
    const prefix = addr.substring(0, len);
    const key = `ac:${metro}:${prefix}`;
    if (!prefixMap.has(key)) prefixMap.set(key, []);
    const arr = prefixMap.get(key)!;
    if (arr.length < 5) arr.push(compact);
  }
}

async function flushToRedis(prefixMap: Map<string, unknown[]>, metro: string) {
  const entries = [...prefixMap.entries()];
  console.log(`  [${metro}] Flushing ${entries.length} keys to Redis...`);
  for (let i = 0; i < entries.length; i += PIPE_SIZE) {
    const batch = entries.slice(i, i + PIPE_SIZE);
    const pipeline = redis.pipeline();
    for (const [key, value] of batch) {
      pipeline.set(key, JSON.stringify(value), { ex: 86400 });
    }
    await pipeline.exec();
  }
}

async function run() {
  const arg = process.argv[2] || "all";
  const offsetArg = parseInt(process.argv[3] || "0", 10);

  if (arg === "all") {
    // Run all metros in parallel
    console.log("Running all metros in parallel...");
    await Promise.all(ALL_METROS.map(m => processMetro(m)));
  } else if (ALL_METROS.includes(arg)) {
    await processMetro(arg, offsetArg);
  } else {
    console.error(`Unknown metro: ${arg}. Use one of: ${ALL_METROS.join(", ")} or "all"`);
    process.exit(1);
  }

  console.log("All done!");
}

run().catch(console.error);

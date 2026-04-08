/**
 * Populate Upstash Redis with search autocomplete data.
 * Run after search_index is populated:
 *   npx tsx scripts/populate-search-redis.ts
 *
 * Stores top 5 results per (metro, address_prefix) in Redis.
 * Key format: ac:{metro}:{PREFIX} → JSON array of buildings
 * Each unique 5-char prefix gets its own key.
 */
import { createClient } from "@supabase/supabase-js";
import { Redis } from "@upstash/redis";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const METROS = ["nyc", "los-angeles", "chicago", "miami", "houston"];
const BATCH_SIZE = 1000;

async function run() {
  for (const metro of METROS) {
    console.log(`Processing ${metro}...`);
    let offset = 0;
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
        console.error(`Error fetching ${metro} at offset ${offset}:`, error.message);
        break;
      }
      if (!data || data.length === 0) break;

      for (const b of data) {
        if (!b.full_address) continue;
        // Generate prefixes of length 2-6 characters
        for (let len = 2; len <= Math.min(6, b.full_address.length); len++) {
          const prefix = b.full_address.substring(0, len);
          const key = `ac:${metro}:${prefix}`;
          if (!prefixMap.has(key)) prefixMap.set(key, []);
          const arr = prefixMap.get(key)!;
          if (arr.length < 5) arr.push(b); // Only keep top 5 per prefix
        }
      }

      offset += BATCH_SIZE;
      total += data.length;
      if (data.length < BATCH_SIZE) break;
      if (offset % 10000 === 0) console.log(`  ${metro}: ${offset} buildings processed, ${prefixMap.size} prefixes`);
    }

    console.log(`  ${metro}: ${total} buildings, ${prefixMap.size} unique prefixes`);

    // Write to Redis in pipeline batches
    const entries = [...prefixMap.entries()];
    const PIPE_SIZE = 100;
    for (let i = 0; i < entries.length; i += PIPE_SIZE) {
      const batch = entries.slice(i, i + PIPE_SIZE);
      const pipeline = redis.pipeline();
      for (const [key, value] of batch) {
        pipeline.set(key, JSON.stringify(value), { ex: 86400 }); // 24h TTL
      }
      await pipeline.exec();
    }
    console.log(`  ${metro}: ${entries.length} keys written to Redis`);
  }

  console.log("Done!");
}

run().catch(console.error);

import { Redis } from "@upstash/redis";

/**
 * Edge-compatible KV cache using existing Upstash Redis connection.
 * Falls back gracefully when Redis is unavailable — cache misses just hit Supabase.
 */

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  return redis;
}

/**
 * Get a cached value, or compute and cache it.
 * @param key - Cache key (e.g., "trending:nyc")
 * @param ttlSeconds - Time-to-live in seconds
 * @param compute - Async function to compute the value on cache miss
 */
export async function cached<T>(
  key: string | null,
  ttlSeconds: number,
  compute: () => Promise<T>
): Promise<T> {
  // Skip cache entirely when no key or no TTL
  if (!key || ttlSeconds <= 0) return compute();

  const r = getRedis();
  if (!r) return compute();

  try {
    const hit = await r.get<T>(key);
    if (hit !== null && hit !== undefined) {
      return hit;
    }
  } catch {
    // Redis down — fall through to compute
  }

  const value = await compute();

  // Don't cache error results
  const isError = value && typeof value === "object" && "error" in value;
  if (!isError) {
    try {
      await r.set(key, JSON.stringify(value), { ex: ttlSeconds });
    } catch {
      // Best-effort cache write
    }
  }

  return value;
}

/**
 * Invalidate a cache key.
 */
export async function invalidate(key: string): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    await r.del(key);
  } catch {
    // Best-effort
  }
}

/**
 * Invalidate all keys matching a pattern (e.g., "trending:*").
 */
export async function invalidatePattern(pattern: string): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    const keys = await r.keys(pattern);
    if (keys.length > 0) {
      await r.del(...keys);
    }
  } catch {
    // Best-effort
  }
}

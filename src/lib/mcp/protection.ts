import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Abuse protection for the public MCP endpoint.
 *
 * Two layers, both backed by the same Upstash Redis the app already uses
 * (Vercel KV env naming: KV_REST_API_URL / KV_REST_API_TOKEN — the older
 * UPSTASH_* names are accepted as a fallback):
 *
 *  1. Per-IP sliding window — 30 tool calls/min. An agent loop that fans out
 *     hard gets throttled without affecting other clients.
 *  2. Global daily circuit breaker — 50K tool calls/day across all IPs.
 *     A botnet-style distributed scrape can stay under any per-IP limit;
 *     this caps the total DB exposure per day.
 *
 * Both DEGRADE OPEN: if Redis is not configured or a Redis call throws, the
 * request is allowed and we console.warn once. A rate limiter must never be
 * the thing that takes the endpoint down.
 */

const RATE_LIMIT_PER_MINUTE = 30;
const DAILY_GLOBAL_LIMIT = 50_000;

let warnedNoRedis = false;

function createRedis(): Redis | null {
  const url =
    process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    if (!warnedNoRedis) {
      warnedNoRedis = true;
      console.warn(
        "[mcp] Redis env (KV_REST_API_URL/KV_REST_API_TOKEN) not configured — MCP rate limiting is DISABLED (degrading open)."
      );
    }
    return null;
  }
  return new Redis({ url, token });
}

let _redis: Redis | null | undefined;
function getRedis(): Redis | null {
  if (_redis === undefined) _redis = createRedis();
  return _redis;
}

let _ratelimit: Ratelimit | null | undefined;
function getRatelimit(): Ratelimit | null {
  if (_ratelimit === undefined) {
    const redis = getRedis();
    _ratelimit = redis
      ? new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(RATE_LIMIT_PER_MINUTE, "60 s"),
          analytics: false,
          prefix: "lr:mcp:rl",
        })
      : null;
  }
  return _ratelimit;
}

export type GuardResult =
  | { allowed: true }
  | { allowed: false; reason: string };

/**
 * Run both protection layers for one tool call. Never throws.
 */
export async function checkMcpGuards(ip: string): Promise<GuardResult> {
  // Layer 1: per-IP sliding window.
  try {
    const rl = getRatelimit();
    if (rl) {
      const { success, reset } = await rl.limit(ip);
      if (!success) {
        const retryS = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
        return {
          allowed: false,
          reason: `Rate limit exceeded: this endpoint allows ${RATE_LIMIT_PER_MINUTE} tool calls per minute per client. Retry in ~${retryS}s.`,
        };
      }
    }
  } catch (err) {
    console.warn("[mcp] rate-limit check failed (degrading open):", err);
  }

  // Layer 2: global daily circuit breaker.
  try {
    const redis = getRedis();
    if (redis) {
      const day = new Date().toISOString().slice(0, 10);
      const key = `lr:mcp:daily:${day}`;
      const count = await redis.incr(key);
      if (count === 1) {
        // Two days so the key survives timezone edges, then self-cleans.
        await redis.expire(key, 172_800);
      }
      if (count > DAILY_GLOBAL_LIMIT) {
        return {
          allowed: false,
          reason:
            "This MCP server has reached its global daily call budget and is paused until midnight UTC. The same data is available on lucidrents.com.",
        };
      }
    }
  } catch (err) {
    console.warn("[mcp] circuit-breaker check failed (degrading open):", err);
  }

  return { allowed: true };
}

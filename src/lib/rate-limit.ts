import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Rate limiter for public API routes.
 * Returns null when UPSTASH_REDIS_REST_URL is not configured,
 * allowing the app to run without Redis in dev/staging.
 */
function createRatelimit() {
  if (
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    return null;
  }
  return new Ratelimit({
    redis: Redis.fromEnv(),
    // 30 requests per 10 seconds per IP
    limiter: Ratelimit.slidingWindow(30, "10 s"),
    analytics: true,
    prefix: "lr:rl",
  });
}

let _ratelimit: Ratelimit | null | undefined;

function getRatelimit() {
  if (_ratelimit === undefined) {
    _ratelimit = createRatelimit();
  }
  return _ratelimit;
}

/**
 * Check rate limit for a given identifier (typically IP address).
 * Returns { limited: true, response } if the request should be blocked.
 * Returns { limited: false } if the request is allowed.
 * Always allows requests when Redis is not configured.
 */
export async function checkRateLimit(
  identifier: string
): Promise<
  | { limited: true; response: Response }
  | { limited: false }
> {
  const rl = getRatelimit();
  if (!rl) return { limited: false };

  const { success, limit, remaining, reset } = await rl.limit(identifier);

  if (!success) {
    return {
      limited: true,
      response: new Response(
        JSON.stringify({ error: "Too many requests" }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "X-RateLimit-Limit": String(limit),
            "X-RateLimit-Remaining": String(remaining),
            "X-RateLimit-Reset": String(reset),
            "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)),
          },
        }
      ),
    };
  }

  return { limited: false };
}

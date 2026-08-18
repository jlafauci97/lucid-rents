/**
 * fetch with ONE retry for transient failures (network error or 5xx),
 * returning the final Response either way — callers still check res.ok and
 * throw loudly (see the 2026-08-18 throw-on-error sweep: a failed query must
 * be a retryable 500, not a silently missing section).
 *
 * The single retry exists for build-time prerendering: 9 parallel workers
 * cold-fetching against the DB occasionally blip a request, and one blip
 * shouldn't fail the whole deploy. Deterministic errors (4xx — bad syntax,
 * missing columns) return immediately and still fail fast, which is how the
 * invalid-filter bugs of #353 should have surfaced on day one.
 */
export async function fetchWithRetry(url: string, init?: RequestInit): Promise<Response> {
  // Two retries with growing backoff: measured during the 2026-08-18 build
  // flakes, a single blip can outlast one 1.5s retry when the DB's disk IO
  // is degraded (e.g. after heavy index builds). 4xx still returns on the
  // first attempt — deterministic bugs stay loud and immediate.
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, attempt * 2500));
    try {
      const res = await fetch(url, init);
      if (res.status < 500) return res;
      if (attempt === 2) return res;
    } catch (e) {
      lastErr = e;
      if (attempt === 2) throw e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("fetchWithRetry: unreachable");
}

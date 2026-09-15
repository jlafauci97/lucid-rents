import { cache } from "react";

// ──────────────────────────────────────────────────────────────
// Long-tail renders: skip the per-entity data caches.
//
// ~3.5M building URLs and ~1.1M landlord URLs are in the sitemap, but only
// ~110K buildings and ~150K landlords have a record anyone revisits. The
// long tail is visited almost exclusively by crawlers, roughly once per ISR
// window — so each render's per-entity unstable_cache entries (~14 for a
// building, up to ~19 for a landlord) were paid ISR writes that expired
// unread. Vercel bills ISR writes in 8KB units of stored output, so this
// was a large share of the ISR-writes line on the bill.
//
// Policy: entities people actually revisit keep the tagged data caches.
// For everything else the loaders run their queries directly on the (rare)
// render — the page itself stays ISR.
//
// Why not render the long tail fully dynamically (zero page writes too)?
// `connection()` / `unstable_noStore()` inside a route with an explicit
// segment `revalidate` throws DYNAMIC_SERVER_USAGE at request time in
// Next 16 with no dynamic-render retry — a hard 500 (verified against
// next start, 16.2.1). Per-request dynamic inside an ISR route needs a
// route split, which needs a tier signal the proxy can afford; see the
// ISR-cost notes in the PR that added this file.
// ──────────────────────────────────────────────────────────────

/** Row signals only — callers already hold the building row. Keep the
 *  threshold aligned with the warm-buildings cron's ranking (review_count,
 *  then violations) so everything the cron warms stays in the cached tier. */
export function isLongTailBuilding(b: {
  review_count?: number | null;
  violation_count?: number | null;
  dob_violation_count?: number | null;
}): boolean {
  if ((b.review_count ?? 0) > 0) return false;
  return Math.max(b.violation_count ?? 0, b.dob_violation_count ?? 0) < 10;
}

/** Landlord tier from the landlord_stats row: sizable portfolios and heavy
 *  violation records are what the rankings/problem-landlords pages link and
 *  what people search — ~150K of ~1.1M landlords. */
export function isLongTailLandlord(s: {
  building_count?: number | null;
  total_violations?: number | null;
  total_dob_violations?: number | null;
}): boolean {
  if ((s.building_count ?? 0) >= 5) return false;
  return Math.max(s.total_violations ?? 0, s.total_dob_violations ?? 0) < 10;
}

// React cache() = one store per server request, shared across
// generateMetadata, the page body, and every streamed section in the same
// render. Outside a render pass (cron routes, MCP tools) each call gets a
// fresh { bypass: false }, so those callers keep the cached behavior.
const requestPolicy = cache(() => ({ bypass: false }));

/** Call before any per-entity loader runs (generateMetadata AND the page
 *  body each mark for themselves — no ordering dependency between them).
 *  Loaders decide at CALL time, so never run one in the same Promise.all as
 *  the fetch that determines the tier. */
export function bypassRenderDataCache(): void {
  requestPolicy().bypass = true;
}

export function renderDataCacheBypassed(): boolean {
  return requestPolicy().bypass;
}

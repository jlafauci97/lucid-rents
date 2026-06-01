/**
 * Page exclusion logic for AdSense.
 *
 * AdSense TOS prohibits ads on certain page types — violating gets your
 * account suspended. The exclusions below are intentionally conservative:
 *
 *  - Auth / login / signup    → user actively filling forms, no content
 *  - Logged-in dashboards     → behind-auth tools, low ad value + TOS risk
 *  - Profile / account        → same as above
 *  - 404 / error pages        → no real content
 *  - Embed routes             → these render inside iframes on other sites
 *  - API routes               → not pages, but match prefix defensively
 *  - Privacy / Terms          → low value, conservative exclusion
 *
 * Update this list rather than adding inline `pathname.startsWith()` checks
 * across the ad components.
 */

const EXCLUDED_PREFIXES = [
  "/login",
  "/signup",
  "/sign-in",
  "/sign-up",
  "/auth",
  "/mission-control",
  "/profile",
  "/embed",
  "/api",
  "/privacy",
  "/terms",
  "/mock",
  "/for-ai",
] as const;

export function shouldShowAdsForPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return !EXCLUDED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

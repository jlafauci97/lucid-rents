/**
 * Reads NEXT_PUBLIC_ENABLE_BUILDING_V2. When true, the production route
 * will eventually render the v2 experience. During Phase 0-5, the v2 route
 * is reachable at /[city]/building/[borough]/[slug]/v2 regardless of flag.
 */
export function isBuildingV2Enabled(): boolean {
  const v = process.env.NEXT_PUBLIC_ENABLE_BUILDING_V2;
  return v === "1" || v === "true";
}

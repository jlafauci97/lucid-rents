import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { MC_COOKIE, verifyCookieValue } from "@/lib/mission-control/auth";

/**
 * Shared auth for /api/marketing/* routes. The proxy matcher excludes /api,
 * so these routes must self-protect. Two callers are authorized:
 *
 * 1. The mission-control dashboard (browser) — authenticated via the
 *    password-gated MC_COOKIE (see src/lib/mission-control/auth.ts).
 * 2. A Supabase-authenticated user whose id is in MARKETING_ADMIN_IDS.
 *
 * Routes called by GitHub Actions / cron use CRON_SECRET bearer auth
 * instead (e.g. reddit/draft-batch, render-video) — not this helper.
 */

/** Marker returned when the caller authenticated via the mission-control cookie. */
export const MISSION_CONTROL_ACTOR = "mission-control";

/**
 * Returns the acting identity for attribution: the Supabase admin user id,
 * the "mission-control" marker, or null when unauthorized.
 */
export async function getMarketingActor(): Promise<string | null> {
  // Mission Control password cookie first — a local HMAC verify, no network.
  const store = await cookies();
  const cookieVal = store.get(MC_COOKIE)?.value;
  if (await verifyCookieValue(cookieVal)) {
    return MISSION_CONTROL_ACTOR;
  }

  // Otherwise require a Supabase session user in MARKETING_ADMIN_IDS.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const adminIds = (process.env.MARKETING_ADMIN_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return adminIds.includes(user.id) ? user.id : null;
}

/** True when the request is authorized to use the marketing API. */
export async function requireMarketingAuth(): Promise<boolean> {
  return (await getMarketingActor()) !== null;
}

import type { NextRequest } from "next/server";
import { MC_COOKIE, verifyCookieValue } from "@/lib/mission-control/auth";

/**
 * Auth gate for /api/marketing/* routes.
 *
 * These endpoints were unauthenticated. The proxy gates /mission-control
 * *pages* but not the API beneath them, so anything under /api/marketing was
 * reachable by anyone who knew the path — including a DELETE (clear-failed) and
 * three routes that spend AI Gateway and Kling credits per call.
 *
 * Accepts either the mission-control session cookie (the dashboard's own
 * fetches carry it automatically) or CRON_SECRET (scheduled jobs and CLI).
 */
export async function isMarketingAuthorized(req: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") === `Bearer ${secret}`) {
    return true;
  }
  return verifyCookieValue(req.cookies.get(MC_COOKIE)?.value);
}

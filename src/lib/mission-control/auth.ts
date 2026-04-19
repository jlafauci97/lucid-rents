import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Password-gated access for /mission-control/* and its server actions.
 *
 * Two env vars required:
 *   MISSION_CONTROL_PASSWORD  the shared password
 *   MISSION_CONTROL_SECRET    HMAC signing secret (32+ bytes random)
 *
 * Cookie "mc_auth" holds "<issuedAt>.<hmac>" signed with MISSION_CONTROL_SECRET.
 * Valid for 7 days. Middleware enforces on the page routes; this module is
 * also imported by server actions to re-check on every mutation.
 */

export const MC_COOKIE = "mc_auth";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

function secret(): string {
  const s = process.env.MISSION_CONTROL_SECRET;
  if (!s || s.length < 16) {
    throw new Error("MISSION_CONTROL_SECRET is not set or too short");
  }
  return s;
}

function sign(issuedAt: number): string {
  return createHmac("sha256", secret())
    .update(`mc-auth:${issuedAt}`)
    .digest("hex");
}

export function makeCookieValue(): string {
  const issuedAt = Math.floor(Date.now() / 1000);
  return `${issuedAt}.${sign(issuedAt)}`;
}

export function verifyCookieValue(value: string | undefined): boolean {
  if (!value) return false;
  const dot = value.indexOf(".");
  if (dot === -1) return false;
  const issuedAtStr = value.slice(0, dot);
  const provided = value.slice(dot + 1);
  const issuedAt = parseInt(issuedAtStr, 10);
  if (!Number.isFinite(issuedAt)) return false;

  // Expiry
  const nowSec = Math.floor(Date.now() / 1000);
  if (nowSec - issuedAt > MAX_AGE_SECONDS) return false;

  // HMAC match (constant-time)
  let expected: string;
  try {
    expected = sign(issuedAt);
  } catch {
    return false;
  }
  if (provided.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(provided, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

export function checkPassword(submitted: string): boolean {
  const expected = process.env.MISSION_CONTROL_PASSWORD;
  if (!expected || expected.length === 0) return false;
  const a = Buffer.from(submitted);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function requireMissionControl(): Promise<void> {
  const store = await cookies();
  const c = store.get(MC_COOKIE);
  if (!verifyCookieValue(c?.value)) {
    throw new Error("Mission Control auth required");
  }
}

export const MC_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE_SECONDS,
};

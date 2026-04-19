import { cookies } from "next/headers";

/**
 * Password-gated access for /mission-control/* and its server actions.
 *
 * Two env vars required:
 *   MISSION_CONTROL_PASSWORD  the shared password
 *   MISSION_CONTROL_SECRET    HMAC signing secret (32+ bytes random)
 *
 * Cookie "mc_auth" holds "<issuedAt>.<hmac>" signed with MISSION_CONTROL_SECRET.
 * Valid for 7 days.
 *
 * Uses Web Crypto (crypto.subtle) so this runs in both Node.js server-action
 * handlers and the Edge middleware without importing node:crypto.
 */

export const MC_COOKIE = "mc_auth";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days
const encoder = new TextEncoder();

function secret(): string {
  const s = process.env.MISSION_CONTROL_SECRET;
  if (!s || s.length < 16) {
    throw new Error("MISSION_CONTROL_SECRET is not set or too short");
  }
  return s;
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function bytesToHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    const v = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(v)) return null;
    out[i] = v;
  }
  return out;
}

async function sign(issuedAt: number): Promise<string> {
  const key = await hmacKey();
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(`mc-auth:${issuedAt}`));
  return bytesToHex(sig);
}

export async function makeCookieValue(): Promise<string> {
  const issuedAt = Math.floor(Date.now() / 1000);
  const hex = await sign(issuedAt);
  return `${issuedAt}.${hex}`;
}

export async function verifyCookieValue(value: string | undefined): Promise<boolean> {
  if (!value) return false;
  const dot = value.indexOf(".");
  if (dot === -1) return false;
  const issuedAtStr = value.slice(0, dot);
  const providedHex = value.slice(dot + 1);
  const issuedAt = parseInt(issuedAtStr, 10);
  if (!Number.isFinite(issuedAt)) return false;

  // Expiry
  const nowSec = Math.floor(Date.now() / 1000);
  if (nowSec - issuedAt > MAX_AGE_SECONDS) return false;
  if (issuedAt > nowSec + 60) return false; // reject future-dated cookies

  const providedBytes = hexToBytes(providedHex);
  if (!providedBytes) return false;

  let key: CryptoKey;
  try {
    key = await hmacKey();
  } catch {
    return false;
  }
  return crypto.subtle.verify(
    "HMAC",
    key,
    providedBytes as BufferSource,
    encoder.encode(`mc-auth:${issuedAt}`),
  );
}

/** Constant-time string comparison (avoids early-exit timing leak). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function checkPassword(submitted: string): boolean {
  const expected = process.env.MISSION_CONTROL_PASSWORD;
  if (!expected || expected.length === 0) return false;
  return safeEqual(submitted, expected);
}

export async function requireMissionControl(): Promise<void> {
  const store = await cookies();
  const c = store.get(MC_COOKIE);
  if (!(await verifyCookieValue(c?.value))) {
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

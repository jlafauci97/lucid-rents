import type { PlatformVariants, PublishResult } from "@/types/marketing";

/**
 * Post Bridge publishing for the marketing content pipeline.
 *
 * This was a parallel, broken reimplementation of what
 * `src/lib/news/post-bridge.ts` already did correctly. It pointed at
 * `api.postbridge.io` — a hostname with no DNS record — and POSTed one request
 * per platform to `/publish` and `/analytics`, neither of which exists. Every
 * attempt failed with `fetch failed`, and because nothing reached the publish
 * step until 2026-08-03 nobody found out.
 *
 * The real API takes ONE request containing an array of numeric social account
 * IDs. Accounts are resolved from the API rather than hardcoded so connecting
 * or disconnecting an account is picked up automatically — the old code assumed
 * nine platforms when only three have ever been connected.
 */

const API_BASE = "https://api.post-bridge.com/v1";
const TIMEOUT_MS = 20000;

/**
 * Prefers POST_BRIDGE_API_TOKEN — the variable the news client uses, and the
 * one that is actually valid in production. POST_BRIDGE_API_KEY has been dead
 * for months: it 401s, and its stored value has a literal "\n" appended, which
 * would corrupt the Authorization header even against a live key. Reading the
 * token first means marketing publishing works with no env change at all.
 *
 * Values are trimmed of whitespace and stray escaped newlines for the same
 * reason — a trailing newline in a secret is invisible in a dashboard and
 * produces an indistinguishable 401.
 */
function apiToken(): string {
  const raw = process.env.POST_BRIDGE_API_TOKEN || process.env.POST_BRIDGE_API_KEY;
  if (!raw) {
    throw new Error("Missing POST_BRIDGE_API_TOKEN (or POST_BRIDGE_API_KEY) env var");
  }
  return raw.replace(/\\n/g, "").trim();
}

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiToken()}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export interface SocialAccount {
  id: number;
  platform: string;
  username: string;
}

/** Accounts actually connected to the Post Bridge workspace. */
export async function listSocialAccounts(): Promise<SocialAccount[]> {
  const res = await apiFetch("/social-accounts");
  if (!res.ok) {
    throw new Error(
      `Post Bridge /social-accounts failed (HTTP ${res.status}): ${(await res.text()).slice(0, 200)}`
    );
  }
  const json = (await res.json()) as { data?: SocialAccount[] };
  return json.data ?? [];
}

/** Post Bridge calls it "twitter"; our variants call it "x". */
const PLATFORM_ALIASES: Record<string, string> = { x: "twitter", twitter: "twitter" };

function normalisePlatform(p: string): string {
  return PLATFORM_ALIASES[p.toLowerCase()] ?? p.toLowerCase();
}

/**
 * Platforms that cannot accept a text-only post.
 *
 * Post Bridge does not enforce this when a draft is created — a text-only post
 * including TikTok returns 201 — so the failure would only surface at publish
 * time, where it risks taking the rest of the batch down with it. Since video
 * generation now degrades to nothing rather than failing the run, a caption-only
 * post is a normal outcome, and these platforms simply get skipped.
 */
const MEDIA_REQUIRED_PLATFORMS = new Set(["tiktok", "youtube", "instagram", "pinterest"]);

/**
 * Publishes a draft to every connected platform we have copy for.
 *
 * Platforms with no connected account are reported as skipped rather than
 * silently dropped, so the draft record shows why nothing went to them.
 */
export async function publishToAllPlatforms(
  variants: PlatformVariants,
  mediaUrls: string[]
): Promise<PublishResult[]> {
  let accounts: SocialAccount[];
  try {
    accounts = await listSocialAccounts();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return (Object.keys(variants) as (keyof PlatformVariants)[]).map((platform) => ({
      platform,
      error: `Could not resolve social accounts: ${message}`,
    }));
  }

  const byPlatform = new Map<string, SocialAccount>();
  for (const a of accounts) byPlatform.set(normalisePlatform(a.platform), a);

  const results: PublishResult[] = [];
  const targets: {
    platform: keyof PlatformVariants;
    account: SocialAccount;
    variant: Record<string, unknown>;
  }[] = [];

  for (const [platform, variant] of Object.entries(variants) as [
    keyof PlatformVariants,
    Record<string, unknown> | undefined,
  ][]) {
    if (!variant) continue;
    const key = normalisePlatform(platform);
    const account = byPlatform.get(key);
    if (!account) {
      results.push({ platform, error: `No connected Post Bridge account for ${platform}` });
      continue;
    }
    if (mediaUrls.length === 0 && MEDIA_REQUIRED_PLATFORMS.has(key)) {
      results.push({ platform, error: `Skipped: ${platform} requires media and none was generated` });
      continue;
    }
    targets.push({ platform, account, variant });
  }

  if (targets.length === 0) return results;

  const captionOf = (v: Record<string, unknown>): string =>
    [v.caption as string | undefined, ((v.hashtags as string[] | undefined) ?? []).join(" ")]
      .filter(Boolean)
      .join("\n\n")
      .trim();

  const platformConfigurations: Record<string, unknown> = {};
  for (const t of targets) {
    const key = normalisePlatform(t.platform);
    if (key === "pinterest") {
      platformConfigurations.pinterest = {
        title: String(t.variant.title ?? "").slice(0, 100),
        link: "https://lucidrents.com",
      };
    } else if (t.variant.caption) {
      platformConfigurations[key] = { caption: captionOf(t.variant) };
    }
  }

  const body: Record<string, unknown> = {
    caption: captionOf(targets[0].variant),
    social_accounts: targets.map((t) => t.account.id),
  };
  if (mediaUrls.length > 0) body.media_urls = mediaUrls;
  if (Object.keys(platformConfigurations).length > 0) {
    body.platform_configurations = platformConfigurations;
  }

  try {
    const res = await apiFetch("/posts", { method: "POST", body: JSON.stringify(body) });
    const text = await res.text();

    if (!res.ok) {
      const detail = `HTTP ${res.status}: ${text.slice(0, 300)}`;
      for (const t of targets) results.push({ platform: t.platform, error: detail });
      return results;
    }

    const data = JSON.parse(text || "{}") as { id?: string };
    for (const t of targets) results.push({ platform: t.platform, post_id: data.id });
    return results;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    for (const t of targets) results.push({ platform: t.platform, error: detail });
    return results;
  }
}

/**
 * Analytics for previously published posts.
 *
 * The old `/analytics` endpoint never existed. Post Bridge exposes per-post
 * records at `/posts/{id}`; metrics it does not return are reported as absent
 * rather than fabricated as zeroes.
 */
export async function getPostAnalytics(
  postIds: Record<string, string>
): Promise<Record<string, { impressions: number; engagements: number; clicks: number }>> {
  const out: Record<string, { impressions: number; engagements: number; clicks: number }> = {};
  const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

  for (const [platform, id] of Object.entries(postIds)) {
    try {
      const res = await apiFetch(`/posts/${encodeURIComponent(id)}`);
      if (!res.ok) continue;
      const json = (await res.json()) as Record<string, unknown>;

      // Post Bridge reports raw per-network counters; marketing_analytics
      // stores the three aggregates it was built around.
      const metrics = {
        impressions: num(json.impressions) || num(json.views),
        engagements: num(json.likes) + num(json.comments) + num(json.shares),
        clicks: num(json.clicks),
      };

      // Skip posts the API returned nothing usable for, rather than writing a
      // row of zeroes that reads as "published and got no engagement".
      if (metrics.impressions || metrics.engagements || metrics.clicks) {
        out[platform] = metrics;
      }
    } catch {
      // A missing analytics record is not a publish failure — skip it.
    }
  }

  return out;
}

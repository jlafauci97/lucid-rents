/**
 * Cross-post a published news article to Twitter/X and Pinterest via Post Bridge.
 *
 * Env vars:
 *   POST_BRIDGE_API_TOKEN             Bearer token from post-bridge.com/dashboard/api-keys
 *   POST_BRIDGE_TWITTER_ACCOUNT_ID    Numeric social account ID for your X account
 *   POST_BRIDGE_PINTEREST_ACCOUNT_ID  Numeric social account ID for your Pinterest account
 *
 * If the token or BOTH account IDs are missing, this is a no-op — the publish flow
 * proceeds normally without cross-posting. Individual platform IDs missing will
 * silently skip that platform.
 *
 * Any API error from Post Bridge is logged but never thrown, so a social-post
 * failure never blocks an article from publishing.
 */

const POST_BRIDGE_ENDPOINT = "https://api.post-bridge.com/v1/posts";
const TIMEOUT_MS = 15000;

export interface PostBridgeInput {
  title: string;
  excerpt: string | null;
  link: string;
  imageUrl: string | null;
}

function buildCaption({ title, excerpt, link }: PostBridgeInput): string {
  const teaser = excerpt?.trim() || title.trim();
  return `${teaser}\n\n${link}`;
}

function parseAccountId(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function crossPostArticle(input: PostBridgeInput): Promise<
  | { ok: true; postId?: string; accounts: number[] }
  | { ok: false; reason: "no_config" | "no_accounts" | "api_error"; detail?: string }
> {
  const token = process.env.POST_BRIDGE_API_TOKEN;
  if (!token) return { ok: false, reason: "no_config", detail: "POST_BRIDGE_API_TOKEN not set" };

  const twitterId = parseAccountId(process.env.POST_BRIDGE_TWITTER_ACCOUNT_ID);
  const pinterestId = parseAccountId(process.env.POST_BRIDGE_PINTEREST_ACCOUNT_ID);
  const socialAccounts = [twitterId, pinterestId].filter((n): n is number => n !== null);
  if (socialAccounts.length === 0) {
    return { ok: false, reason: "no_accounts", detail: "No POST_BRIDGE_*_ACCOUNT_ID env vars set" };
  }

  const caption = buildCaption(input);
  const body: Record<string, unknown> = {
    caption,
    socialAccounts,
  };
  if (input.imageUrl) body.mediaUrls = [input.imageUrl];

  // Per-platform overrides: Pinterest needs the destination link + pin title.
  const platformConfigurations: Record<string, unknown> = {};
  if (pinterestId) {
    platformConfigurations.pinterest = {
      title: input.title.slice(0, 100),
      link: input.link,
    };
  }
  if (Object.keys(platformConfigurations).length > 0) {
    body.platformConfigurations = platformConfigurations;
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(POST_BRIDGE_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        reason: "api_error",
        detail: `HTTP ${res.status}: ${text.slice(0, 300)}`,
      };
    }
    const data = await res.json().catch(() => null);
    return {
      ok: true,
      postId: data?.id,
      accounts: socialAccounts,
    };
  } catch (e) {
    return {
      ok: false,
      reason: "api_error",
      detail: e instanceof Error ? e.message : String(e),
    };
  } finally {
    clearTimeout(timer);
  }
}

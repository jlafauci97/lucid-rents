/**
 * Google Search Console API — programmatic sitemap management.
 *
 * Uses the same service account as the Indexing API. The service account
 * must be added as a full user in Google Search Console for the site.
 *
 * Env vars: GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
 */

const GSC_API = "https://www.googleapis.com/webmasters/v3";
const SITE_URL = "https://lucidrents.com";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/webmasters";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!email || !rawKey) {
    throw new Error(
      "Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"
    );
  }

  const privateKey = rawKey.replace(/\\n/g, "\n");
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = { iss: email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 };

  const enc = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const signingInput = `${enc(header)}.${enc(payload)}`;

  const crypto = await import("crypto");
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(signingInput);
  const signature = sign.sign(privateKey, "base64url");

  const jwt = `${signingInput}.${signature}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    throw new Error(`GSC token exchange failed (${res.status}): ${await res.text()}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.token;
}

/**
 * Submit (or re-submit) a sitemap URL to Google Search Console.
 * This tells Google to re-crawl the sitemap immediately.
 */
export async function submitSitemap(
  sitemapUrl: string
): Promise<{ ok: boolean; status: number }> {
  const token = await getAccessToken();
  const encoded = encodeURIComponent(SITE_URL);

  const res = await fetch(
    `${GSC_API}/sites/${encoded}/sitemaps/${encodeURIComponent(sitemapUrl)}`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  return { ok: res.ok, status: res.status };
}

/**
 * Submit all sitemaps listed in robots.txt to GSC.
 * Useful after a sync job adds new buildings.
 */
export async function submitAllSitemaps(): Promise<{
  submitted: number;
  errors: string[];
}> {
  // Fetch current building count to determine sitemap count
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/buildings?select=id&limit=1&offset=0`,
    {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        Prefer: "count=exact",
      },
    }
  );

  const countHeader = res.headers.get("content-range");
  const totalBuildings = countHeader
    ? parseInt(countHeader.split("/")[1] || "0", 10)
    : 50000;

  const sitemapCount = 1 + Math.ceil(totalBuildings / 45000);
  const errors: string[] = [];
  let submitted = 0;

  for (let i = 0; i < sitemapCount; i++) {
    const url = `${SITE_URL}/sitemap/${i}.xml`;
    try {
      const result = await submitSitemap(url);
      if (result.ok) {
        submitted++;
      } else {
        errors.push(`Sitemap ${i}: HTTP ${result.status}`);
      }
    } catch (err) {
      errors.push(`Sitemap ${i}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { submitted, errors };
}

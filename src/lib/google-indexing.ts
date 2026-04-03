/**
 * Google Indexing API client.
 *
 * Requires a Google Cloud service account with the "Indexing API" enabled
 * and the service account email added as a delegated owner in Google Search Console.
 *
 * Environment variables:
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL – e.g. indexing@my-project.iam.gserviceaccount.com
 *   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY – PEM private key (with literal \n replaced by newlines)
 */

const GOOGLE_INDEXING_ENDPOINT =
  "https://indexing.googleapis.com/v3/urlNotifications:publish";
const GOOGLE_BATCH_ENDPOINT =
  "https://indexing.googleapis.com/batch";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/indexing";

// In-memory token cache
let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Create a JSON Web Token (JWT) and exchange it for a Google access token.
 */
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

  // Build JWT
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };

  const enc = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj))
      .toString("base64url");

  const signingInput = `${enc(header)}.${enc(payload)}`;

  // Import the PEM key and sign
  const crypto = await import("crypto");
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(signingInput);
  const signature = sign.sign(privateKey, "base64url");

  const jwt = `${signingInput}.${signature}`;

  // Exchange JWT for access token
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token exchange failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return cachedToken.token;
}

type UrlAction = "URL_UPDATED" | "URL_DELETED";

/**
 * Notify Google about a single URL update or deletion.
 */
export async function notifyGoogleIndexing(
  url: string,
  type: UrlAction = "URL_UPDATED"
): Promise<{ ok: boolean; status: number; body: string }> {
  const token = await getAccessToken();

  const res = await fetch(GOOGLE_INDEXING_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url, type }),
  });

  const body = await res.text();
  return { ok: res.ok, status: res.status, body };
}

/**
 * Batch-notify Google about multiple URL updates (up to 200 per day quota).
 * Uses the Google Batch API to send all requests in a single HTTP call.
 */
export async function batchNotifyGoogleIndexing(
  urls: string[],
  type: UrlAction = "URL_UPDATED"
): Promise<{ submitted: number; errors: string[] }> {
  if (urls.length === 0) return { submitted: 0, errors: [] };

  const token = await getAccessToken();
  const boundary = "lucid_rents_batch";
  const errors: string[] = [];

  // Google batch API accepts multipart/mixed
  const parts = urls.slice(0, 200).map((url, i) => {
    const body = JSON.stringify({ url, type });
    return [
      `--${boundary}`,
      "Content-Type: application/http",
      `Content-ID: <item${i}>`,
      "",
      `POST /v3/urlNotifications:publish HTTP/1.1`,
      "Content-Type: application/json",
      `Content-Length: ${Buffer.byteLength(body)}`,
      "",
      body,
    ].join("\r\n");
  });

  const batchBody = parts.join("\r\n") + `\r\n--${boundary}--`;

  try {
    const res = await fetch(GOOGLE_BATCH_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/mixed; boundary=${boundary}`,
      },
      body: batchBody,
    });

    if (!res.ok) {
      errors.push(`Batch request failed: ${res.status} ${await res.text()}`);
    }
  } catch (err) {
    errors.push(`Batch request error: ${err}`);
  }

  return { submitted: Math.min(urls.length, 200), errors };
}

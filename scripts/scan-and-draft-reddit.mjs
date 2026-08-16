#!/usr/bin/env node
// Scans target subreddits for rental-related threads and POSTs the candidates
// to the Vercel /api/marketing/reddit/draft-batch endpoint. Vercel then drafts
// replies via its existing AI Gateway auth (same path as the content workflow)
// and saves drafts to Supabase.
//
// AUTHENTICATION: reads go through Reddit's OAuth API, not the public
// www.reddit.com/*.json endpoints. Those now return HTTP 403 to unauthenticated
// clients regardless of where the request comes from — verified 2026-08-12 from
// a GitHub Actions runner, from a residential IP, and with a browser
// User-Agent; old.reddit.com/*.json answers 302. An earlier round of blocking
// was IP-based (datacenter ranges only, from ~2026-04-23), which is why this
// script was moved out of Vercel in the first place, but that is no longer the
// shape of the problem and moving it to yet another IP does not help.
//
// oauth.reddit.com with an app-only token works from anywhere, so this can run
// on any host. client_credentials is deliberate: it needs only the app's ID and
// secret, never the account password, and public listings are all this reads.
//
// Usage:
//   node scripts/scan-and-draft-reddit.mjs [--dry]
//
// Required env:
//   BASE_URL              (e.g. https://lucidrents.com)
//   CRON_SECRET           (shared with Vercel — gates the draft-batch endpoint)
//   REDDIT_CLIENT_ID      (reddit.com/prefs/apps -> create app -> type "script")
//   REDDIT_CLIENT_SECRET
//
// Optional:
//   REDDIT_LOOKBACK_HOURS    (default 6)
//   REDDIT_USERNAME          (only to build a compliant User-Agent)
//   REDDIT_FETCH_TIMEOUT_MS  (default 15000)

const DRY = process.argv.includes("--dry");
const LOOKBACK_HOURS = Number(process.env.REDDIT_LOOKBACK_HOURS ?? 6);
const FETCH_TIMEOUT_MS = Number(process.env.REDDIT_FETCH_TIMEOUT_MS ?? 15000);

// Reddit asks for platform:app-id:version (by /u/user). A generic UA is one of
// the documented reasons for being rate-limited harder than necessary.
const USER_AGENT = `macos:com.lucidrents.scanner:v1.0 (by /u/${
  process.env.REDDIT_USERNAME ?? "lucidrents"
})`;

function need(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing env ${name}`);
    process.exit(1);
  }
  return v;
}

const BASE_URL = need("BASE_URL").replace(/\/$/, "");
const CRON_SECRET = need("CRON_SECRET");

const TARGET_SUBREDDITS = [
  "NYCapartments",
  "AskNYC",
  "nycrentals",
  "NYCinfohub",
  "AskLosAngeles",
  "LosAngeles",
  "LArentals",
  "chicago",
  "chicagoapartments",
  "Miami",
  "askmiami",
  "FloridaRenters",
  "realestate",
  "FirstTimeHomeBuyer",
  "Tenant",
  "renters",
  "personalfinance",
];

const REDDIT_KEYWORDS = [
  "violations",
  "landlord",
  "lease",
  "HPD",
  "LAHD",
  "building complaints",
  "rent stabilized",
  "tenant rights",
  "311",
  "apartment search",
  "moving to nyc",
  "moving to la",
  "moving to chicago",
  "moving to miami",
  "flood zone",
  "40 year recertification",
  "condo inspection",
  "bad landlord",
  "slumlord",
  "mold",
  "bedbugs",
  "no heat",
  "no hot water",
  "building inspection",
  "housing court",
  "rent increase",
  "apartment hunting",
  "apartment advice",
  "renter tips",
].map((k) => k.toLowerCase());

function scoreRelevance(kwMatches, numComments) {
  const kwBoost = Math.min(kwMatches * 0.2, 0.6);
  const engageBoost = Math.min(Math.log10(numComments + 1) / 5, 0.3);
  const ageBoost = 0.1; // fresh by definition (within lookback)
  return Math.min(kwBoost + engageBoost + ageBoost, 1.0);
}

/**
 * App-only OAuth token (client_credentials). Null when the app credentials are
 * absent, which leaves the caller to fall back to the public endpoints — those
 * are currently blocked, so that path exists only so the script keeps working
 * if Reddit ever reopens them.
 */
async function getAccessToken() {
  const id = process.env.REDDIT_CLIENT_ID;
  const secret = process.env.REDDIT_CLIENT_SECRET;
  if (!id || !secret) return null;

  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(
      `token request failed: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`
    );
  }
  const json = await res.json();
  if (!json.access_token) throw new Error("token response contained no access_token");
  return json.access_token;
}

async function scanSubreddits(token) {
  const lookbackSeconds = Math.floor(Date.now() / 1000) - LOOKBACK_HOURS * 3600;
  const candidates = [];
  // Tracked so a run where every subreddit fails can exit non-zero. Without
  // this the script returned 0 candidates and exit 0 on a total outage, which
  // is exactly how the 403s went unnoticed from April to August.
  let reached = 0;
  let failed = 0;

  for (const sub of TARGET_SUBREDDITS) {
    try {
      // Every request is bounded. The unbounded fetch this replaces could hang
      // indefinitely on a stalled connection — observed hanging 12+ minutes —
      // which under launchd looks identical to "still working".
      const url = token
        ? `https://oauth.reddit.com/r/${sub}/new?limit=25`
        : `https://www.reddit.com/r/${sub}/new.json?limit=25`;
      const res = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          ...(token ? { Authorization: `bearer ${token}` } : {}),
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) {
        console.log(`[scan] r/${sub} -> HTTP ${res.status}`);
        failed++;
        continue;
      }
      reached++;
      const json = await res.json();
      const posts = json?.data?.children ?? [];
      let matchCount = 0;
      for (const p of posts) {
        const d = p.data;
        if (!d || d.created_utc < lookbackSeconds) continue;
        const combined = (
          (d.title ?? "") +
          " " +
          (d.selftext ?? "")
        ).toLowerCase();
        const matched = REDDIT_KEYWORDS.filter((kw) => combined.includes(kw));
        if (matched.length === 0) continue;
        matchCount++;
        candidates.push({
          threadId: d.name ?? `t3_${d.id}`,
          subreddit: sub,
          title: d.title ?? "",
          url: `https://www.reddit.com${d.permalink ?? ""}`,
          selftext: (d.selftext ?? "").slice(0, 2000),
          score: d.score ?? 0,
          numComments: d.num_comments ?? 0,
          relevanceScore: scoreRelevance(matched.length, d.num_comments ?? 0),
          keywordsMatched: matched,
        });
      }
      console.log(`[scan] r/${sub} -> ${posts.length} posts, ${matchCount} matches`);
      await new Promise((r) => setTimeout(r, 1500));
    } catch (err) {
      // A timeout arrives here as TimeoutError; count it as a failure so it
      // feeds the all-failed check rather than being swallowed as "no matches".
      console.log(`[scan] r/${sub} error: ${err.message}`);
      failed++;
    }
  }
  return { candidates, reached, failed };
}

async function postToDraftBatch(candidates) {
  // Rank + cap so Vercel doesn't have to process hundreds
  const top = candidates
    .slice()
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 10);
  if (DRY) {
    console.log(`[dry] would POST ${top.length} candidates to ${BASE_URL}/api/marketing/reddit/draft-batch`);
    for (const c of top) {
      console.log(`[dry]   r/${c.subreddit} [${c.keywordsMatched.join(",")}] ${c.title.slice(0, 70)}`);
    }
    return;
  }
  const res = await fetch(`${BASE_URL}/api/marketing/reddit/draft-batch`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CRON_SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ candidates: top }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`draft-batch returned ${res.status}: ${text.slice(0, 500)}`);
  }
  console.log(`[post] ${res.status} ${text.slice(0, 500)}`);
}

async function main() {
  console.log(`[start] lookback=${LOOKBACK_HOURS}h subs=${TARGET_SUBREDDITS.length} dry=${DRY}`);

  const token = await getAccessToken();
  if (token) {
    console.log("[auth] app-only OAuth token acquired, reading oauth.reddit.com");
  } else {
    console.warn(
      "[auth] WARNING: REDDIT_CLIENT_ID/REDDIT_CLIENT_SECRET not set — falling back to " +
        "the public endpoints, which Reddit currently blocks. Expect every subreddit to 403."
    );
  }

  const { candidates, reached, failed } = await scanSubreddits(token);
  console.log(
    `[scan] ${reached}/${TARGET_SUBREDDITS.length} subreddits reached, ${failed} failed, ` +
      `${candidates.length} keyword-matching candidates`
  );

  // Reaching nothing is an outage, not an empty result. Failing loudly here is
  // the whole point: the previous version exited 0 in this case, so four months
  // of total blockage rendered as a green check.
  if (reached === 0) {
    console.error(
      `fatal: every one of the ${TARGET_SUBREDDITS.length} subreddits failed — ` +
        "this is an outage (auth, network, or Reddit blocking), not a quiet scan"
    );
    process.exit(1);
  }

  if (candidates.length === 0) return;
  await postToDraftBatch(candidates);
  console.log("[done]");
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});

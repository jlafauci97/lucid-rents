#!/usr/bin/env node
// Scans target subreddits for rental-related threads and POSTs the candidates
// to the Vercel /api/marketing/reddit/draft-batch endpoint. Vercel then drafts
// replies via its existing AI Gateway auth (same path as the content workflow)
// and saves drafts to Supabase.
//
// This script lives outside Vercel because Reddit aggressively blocks
// datacenter IPs. GitHub Actions runners aren't blocked.
//
// Usage:
//   node scripts/scan-and-draft-reddit.mjs [--dry]
//
// Required env:
//   BASE_URL      (e.g. https://lucidrents.com)
//   CRON_SECRET   (shared with Vercel — gates the draft-batch endpoint)
//
// Optional:
//   REDDIT_LOOKBACK_HOURS (default 6)

const DRY = process.argv.includes("--dry");
const LOOKBACK_HOURS = Number(process.env.REDDIT_LOOKBACK_HOURS ?? 6);
const USER_AGENT = "LucidRents/1.0 (marketing-monitor; github-actions)";

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

async function scanSubreddits() {
  const lookbackSeconds = Math.floor(Date.now() / 1000) - LOOKBACK_HOURS * 3600;
  const candidates = [];
  for (const sub of TARGET_SUBREDDITS) {
    try {
      const res = await fetch(
        `https://www.reddit.com/r/${sub}/new.json?limit=25`,
        { headers: { "User-Agent": USER_AGENT } }
      );
      if (!res.ok) {
        console.log(`[scan] r/${sub} -> HTTP ${res.status}`);
        continue;
      }
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
      console.log(`[scan] r/${sub} error: ${err.message}`);
    }
  }
  return candidates;
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
  const candidates = await scanSubreddits();
  console.log(`[scan] total ${candidates.length} keyword-matching candidates`);
  if (candidates.length === 0) return;
  await postToDraftBatch(candidates);
  console.log("[done]");
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});

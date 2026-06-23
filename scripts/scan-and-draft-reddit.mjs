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

// City-specific subs we trust to be on-topic. The "general" subs (renters,
// Tenant, realestate, personalfinance) are gated separately — a post from
// r/renters must explicitly mention one of our metros, otherwise we drown
// in posts from MI, MO, GA, PA, CT, UT, OR, etc.
//
// Keep this in sync with TARGET_SUBREDDITS / GENERAL_SUBREDDITS in
// src/lib/marketing/brand-voice.ts.
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

const GENERAL_SUBREDDITS = new Set([
  "realestate",
  "FirstTimeHomeBuyer",
  "Tenant",
  "renters",
  "personalfinance",
]);

// State codes / city words that mean a post is about one of our markets.
// Keep in sync with SUPPORTED_GEO_TOKENS in src/lib/marketing/brand-voice.ts.
const SUPPORTED_GEO_TOKENS = [
  "ny",
  "nyc",
  "new york",
  "ca",
  "calif",
  "california",
  "los angeles",
  "il",
  "illinois",
  "chicago",
  "fl",
  "florida",
  "miami",
  "tx",
  "texas",
  "houston",
];

// State codes for the 45 states we DON'T cover. Used to hard-reject a post
// whose title is tagged like "[MI]" or "[OR] my landlord ...".
// Keep in sync with UNSUPPORTED_STATE_CODES in src/lib/marketing/brand-voice.ts.
const UNSUPPORTED_STATE_CODES = new Set([
  "AL","AK","AZ","AR","CO","CT","DE","DC","GA","HI","ID","IN","IA","KS","KY",
  "LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NC",
  "ND","OH","OK","OR","PA","RI","SC","SD","TN","UT","VT","VA","WA","WV","WI","WY",
]);

// Tighter keyword list. Bare "lease" / "landlord" / "mold" matches every
// job post, jury summons, and out-of-state rant in existence. Phrases that
// signal a real renter problem in our markets stay; one-word noise is gone.
//
// Keep in sync with REDDIT_KEYWORDS in src/lib/marketing/brand-voice.ts.
const REDDIT_KEYWORDS = [
  "hpd violation",
  "hpd complaint",
  "lahd",
  "rso violation",
  "rlto",
  "rent stabilized",
  "rent stabilization",
  "rent control",
  "tenant rights",
  "renters rights",
  "tenants rights",
  "311 complaint",
  "moving to nyc",
  "moving to la",
  "moving to los angeles",
  "moving to chicago",
  "moving to miami",
  "moving to houston",
  "flood zone",
  "40 year recertification",
  "40-year recertification",
  "condo recertification",
  "bad landlord",
  "slumlord",
  "no heat",
  "no hot water",
  "housing court",
  "eviction notice",
  "illegal eviction",
  "rent increase",
  "rent hike",
  "security deposit",
  "withhold rent",
  "warranty of habitability",
  "habitability",
  "uninhabitable",
  "broker fee",
  "apartment hunting nyc",
  "apartment hunting chicago",
  "apartment hunting la",
  "apartment hunting miami",
  "apartment hunting houston",
].map((k) => k.toLowerCase());

function hasUnsupportedStateTag(title, body) {
  const text = `${title} ${body}`;
  const matches = text.match(/\[([A-Z]{2})\]/g);
  if (!matches) return false;
  for (const m of matches) {
    const code = m.slice(1, 3);
    if (UNSUPPORTED_STATE_CODES.has(code)) return true;
  }
  return false;
}

function mentionsSupportedMetro(title, body) {
  const text = `${title} ${body}`.toLowerCase();
  return SUPPORTED_GEO_TOKENS.some((tok) => {
    const re = new RegExp(`\\b${tok.replace(/\./g, "\\.")}\\b`, "i");
    return re.test(text);
  });
}

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
        const titleRaw = d.title ?? "";
        const selftextRaw = d.selftext ?? "";
        const combined = (titleRaw + " " + selftextRaw).toLowerCase();
        const matched = REDDIT_KEYWORDS.filter((kw) => combined.includes(kw));
        if (matched.length === 0) continue;

        // Hard reject: explicit out-of-state bracket tag like "[MI]" or "[OR]".
        if (hasUnsupportedStateTag(titleRaw, selftextRaw)) continue;

        // Posts from national subs (renters / Tenant / realestate /
        // personalfinance / FirstTimeHomeBuyer) must explicitly mention one
        // of our 5 metros, otherwise we drown in out-of-state content.
        if (
          GENERAL_SUBREDDITS.has(sub) &&
          !mentionsSupportedMetro(titleRaw, selftextRaw)
        ) {
          continue;
        }

        matchCount++;
        candidates.push({
          threadId: d.name ?? `t3_${d.id}`,
          subreddit: sub,
          title: titleRaw,
          url: `https://www.reddit.com${d.permalink ?? ""}`,
          selftext: selftextRaw.slice(0, 2000),
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

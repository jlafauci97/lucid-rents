#!/usr/bin/env node
/**
 * Reddit candidate scanner.
 *
 * Runs OFF Vercel — on the Mac mini via launchd. Two reasons it cannot live in
 * a cron function:
 *   1. Reddit's JSON API (`/new.json`) returns 403 to datacenter IPs, and as of
 *      mid-2026 to unauthenticated clients generally, regardless of User-Agent.
 *      The Atom feed (`/new/.rss`) still serves 200, so that is what we read.
 *   2. The previous in-workflow scanner treated a total fetch failure as a
 *      retryable error, so when Reddit started refusing it the monitor simply
 *      died. It has produced nothing since 2026-05-24.
 *
 * This script only casts a cheap keyword net and forwards candidates. All the
 * decisions that matter — relevance scoring, the listing/ad filter, and the
 * requirement that we hold specific data about the thread — happen server-side
 * in /api/marketing/reddit/draft-batch, which does not trust anything here.
 *
 * Usage:
 *   node scripts/reddit-scanner.mjs            # scan and submit
 *   node scripts/reddit-scanner.mjs --dry-run  # scan and print, submit nothing
 */

import fs from "node:fs";
import path from "node:path";

const DRY_RUN = process.argv.includes("--dry-run");
const ROOT = path.resolve(import.meta.dirname, "..");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/**
 * Live metros only. Miami and Houston are hidden from the public site, so a
 * reply about them would link to pages that do not render.
 */
const SUBREDDITS = [
  // NYC
  "NYCapartments",
  "AskNYC",
  "nycrentals",
  "NYCinfohub",
  // Los Angeles
  "AskLosAngeles",
  "LosAngeles",
  "LArentals",
  // Chicago
  "chicago",
  "chicagoapartments",
  // National — the server requires these to name one of our metros explicitly
  "Tenant",
  "renters",
];

/**
 * Cheap prefilter only. Its job is to keep the volume (and the AI Gateway bill)
 * down, not to decide anything — the authoritative filter is the server gate.
 */
const KEYWORDS = [
  "hpd violation", "hpd complaint", "lahd", "rso violation", "rlto",
  "rent stabilized", "rent stabilization", "rent control",
  "tenant rights", "renters rights", "tenants rights", "311 complaint",
  "no heat", "no hot water", "without heat", "heat is out", "heating",
  "mold", "bed bugs", "bedbugs", "roaches", "infestation",
  "security deposit", "eviction", "evicted", "habitability", "warranty of habitability",
  "landlord won't", "landlord wont", "landlord refuses", "landlord is refusing",
  "won't repair", "wont repair", "refuses to repair", "withhold rent",
  "rent increase", "lease renewal", "broker fee", "retaliation", "harassment",
];

/** Bracketed state tags for states we don't cover, e.g. "[MI] my landlord ...". */
const UNSUPPORTED_STATE_CODES = new Set([
  "AL","AK","AZ","AR","CO","CT","DE","DC","GA","HI","ID","IN","IA","KS","KY",
  "LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NC",
  "ND","OH","OK","OR","PA","RI","SC","SD","TN","UT","VT","VA","WA","WV","WI","WY",
  "FL","TX",
]);

const LOOKBACK_HOURS = 6;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------

function loadEnv() {
  const envPath = path.join(ROOT, ".env.local");
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const value = m[2].replace(/^["']|["']$/g, "");
      if (!process.env[m[1]]) process.env[m[1]] = value;
    }
  }
}
loadEnv();

const BASE_URL = process.env.SCANNER_TARGET_URL || "https://lucidrents.com";
const CRON_SECRET = process.env.CRON_SECRET;

// ---------------------------------------------------------------------------
// Atom parsing
// ---------------------------------------------------------------------------

function decodeEntities(s) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#32;/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function stripTags(html) {
  return decodeEntities(
    decodeEntities(html)
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseAtom(xml, subreddit) {
  const entries = [];
  for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const e = m[1];
    const id = e.match(/<id>([^<]+)<\/id>/)?.[1] ?? "";
    const title = decodeEntities(e.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "").trim();
    const link = e.match(/<link[^>]*href="([^"]+)"/)?.[1] ?? "";
    const updated = e.match(/<updated>([^<]+)<\/updated>/)?.[1] ?? "";
    const contentRaw = e.match(/<content[^>]*>([\s\S]*?)<\/content>/)?.[1] ?? "";
    const author = e.match(/<name>([^<]+)<\/name>/)?.[1] ?? "";

    if (!id || !title) continue;

    let body = stripTags(contentRaw);
    // The feed appends "submitted by /u/x [link] [comments]" boilerplate.
    body = body.replace(/submitted by\s*\/u\/\S+\s*\[link\]\s*\[comments\]\s*$/i, "").trim();

    entries.push({
      threadId: id,
      subreddit,
      title,
      url: link,
      selftext: body,
      author,
      createdAt: updated ? new Date(updated).getTime() : 0,
      score: 0,
      numComments: 0,
    });
  }
  return entries;
}

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

function hasUnsupportedStateTag(text) {
  for (const m of text.match(/\[([A-Z]{2})\]/g) ?? []) {
    if (UNSUPPORTED_STATE_CODES.has(m.slice(1, 3))) return true;
  }
  return false;
}

/**
 * Word-boundary matching. Plain substring matching fires "heat" inside
 * "Theatre" and "repairs" inside longer words, which is how a marionette
 * theatre hiring post became a rental candidate.
 */
const KEYWORD_PATTERNS = KEYWORDS.map(
  (k) => new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i")
);

function matchesKeywords(text) {
  return KEYWORDS.filter((_, i) => KEYWORD_PATTERNS[i].test(text));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Reddit rate-limits the Atom feeds aggressively — a flat 2s gap produced 429s
 * on 9 of 11 subreddits. Back off and retry rather than losing the subreddit
 * for the whole run.
 */
async function fetchSubreddit(subreddit) {
  const url = `https://www.reddit.com/r/${subreddit}/new/.rss`;
  let lastStatus = 0;

  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (res.ok) return parseAtom(await res.text(), subreddit);

    lastStatus = res.status;
    if (res.status !== 429) throw new Error(`HTTP ${res.status}`);

    const retryAfter = Number(res.headers.get("retry-after"));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : 5000 * 2 ** (attempt - 1);
    console.error(`[scanner] r/${subreddit} 429, waiting ${Math.round(waitMs / 1000)}s (attempt ${attempt}/4)`);
    await sleep(waitMs);
  }

  throw new Error(`HTTP ${lastStatus} after retries`);
}

async function main() {
  const cutoff = Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000;
  const candidates = [];
  const stats = { scanned: 0, ok: 0, failed: 0 };

  for (const subreddit of SUBREDDITS) {
    try {
      const entries = await fetchSubreddit(subreddit);
      stats.ok++;
      stats.scanned += entries.length;

      for (const e of entries) {
        if (e.createdAt && e.createdAt < cutoff) continue;
        const text = `${e.title}\n${e.selftext}`;
        if (hasUnsupportedStateTag(text)) continue;
        const matched = matchesKeywords(text);
        if (matched.length === 0) continue;
        candidates.push({ ...e, keywordsMatched: matched });
      }
    } catch (err) {
      stats.failed++;
      console.error(`[scanner] r/${subreddit} failed: ${err.message}`);
    }
    // Reddit 429s these feeds aggressively: 2s lost 9 of 11 subreddits, 6s
    // still lost 5. The scanner runs every 30 minutes, so spending ~3 minutes
    // walking the list costs nothing.
    await sleep(15000);
  }

  console.log(
    `[scanner] subs ok=${stats.ok} failed=${stats.failed} | posts seen=${stats.scanned} | candidates=${candidates.length}`
  );

  if (candidates.length === 0) {
    // Every subreddit failing means Reddit changed something — worth shouting
    // about rather than silently reporting "no candidates" forever.
    if (stats.ok === 0) {
      console.error("[scanner] ERROR: every subreddit fetch failed — feed format or access may have changed");
      process.exit(1);
    }
    return;
  }

  if (DRY_RUN) {
    for (const c of candidates) {
      console.log(`\nr/${c.subreddit}  ${c.title}`);
      console.log(`  matched: ${c.keywordsMatched.slice(0, 5).join(", ")}`);
      console.log(`  body: ${c.selftext.slice(0, 160).replace(/\n/g, " ")}`);
    }
    console.log(`\n[scanner] dry run — ${candidates.length} candidates, nothing submitted`);
    return;
  }

  if (!CRON_SECRET) {
    console.error("[scanner] CRON_SECRET not set — cannot submit");
    process.exit(1);
  }

  const res = await fetch(`${BASE_URL}/api/marketing/reddit/draft-batch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CRON_SECRET}`,
    },
    body: JSON.stringify({
      candidates: candidates.map((c) => ({
        threadId: c.threadId,
        subreddit: c.subreddit,
        title: c.title,
        url: c.url,
        selftext: c.selftext,
        score: c.score,
        numComments: c.numComments,
        keywordsMatched: c.keywordsMatched,
      })),
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`[scanner] submit failed: HTTP ${res.status} ${JSON.stringify(json)}`);
    process.exit(1);
  }
  console.log(`[scanner] submitted: ${JSON.stringify(json)}`);
}

main().catch((err) => {
  console.error(`[scanner] fatal: ${err.stack || err.message}`);
  process.exit(1);
});

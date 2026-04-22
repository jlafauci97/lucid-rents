#!/usr/bin/env node
// Scans target subreddits for rental-related threads, drafts replies via
// Claude, and saves them to Supabase with status='draft_ready'.
//
// Runs out-of-band from Vercel (via GitHub Actions). Reddit blocks
// datacenter IPs served by Vercel, so this script runs on GitHub's runners
// where Reddit's public JSON endpoints work normally.
//
// Usage:
//   node scripts/scan-and-draft-reddit.mjs [--dry]
//
// Required env:
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   ANTHROPIC_API_KEY
//
// Optional:
//   REDDIT_LOOKBACK_HOURS (default 6 — should be >= cron cadence so
//                          nothing slips through between runs)

import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

const DRY = process.argv.includes("--dry");
const LOOKBACK_HOURS = Number(process.env.REDDIT_LOOKBACK_HOURS ?? 6);
const CLAUDE_MODEL = "claude-sonnet-4-6";
const USER_AGENT = "LucidRents/1.0 (marketing-monitor; github-actions)";

function need(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing env ${name}`);
    process.exit(1);
  }
  return v;
}

const supabase = createClient(
  need("NEXT_PUBLIC_SUPABASE_URL"),
  need("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false } }
);
const anthropic = new Anthropic({ apiKey: need("ANTHROPIC_API_KEY") });

// -----------------------------------------------------------------------
// Config — mirrors src/lib/marketing/brand-voice.ts
// -----------------------------------------------------------------------

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

const SYSTEM_PROMPT = `You are helping a Reddit user with a housing/rental question. You work for LucidRents, a rental intelligence platform.

RULES:
1. Lead with genuine help. Answer their question FIRST.
2. Include specific data when possible (e.g., "that building at 123 Main St has 47 open violations per HPD records")
3. Only mention LucidRents if it fits naturally. Acceptable: "you can check any building's violation history on lucidrents.com" as part of a longer helpful answer.
4. NEVER fake being a tenant. If asked, be transparent: "I built a tool that tracks this data."
5. Match the subreddit's communication style.
6. Max 2-3 paragraphs. Redditors don't read walls of text.
7. Never use marketing language. Sound like a knowledgeable person, not a company.`;

const SUBREDDIT_TONE = {
  NYCapartments: "Direct and experienced. NYC renters are battle-hardened. Skip pleasantries, get to the point.",
  AskNYC: "Blunt but helpful. This sub values concise, no-BS answers.",
  nycrentals: "Practical. Focus on actionable advice about the rental process.",
  AskLosAngeles: "Friendly but informative. LA culture is more laid-back than NYC.",
  LosAngeles: "Casual. Match the community vibe — informative but not stiff.",
  LArentals: "Practical and supportive. Many first-time renters here.",
  chicago: "Midwest-friendly. Helpful and straightforward.",
  chicagoapartments: "Practical housing advice. Reference RLTO when relevant.",
  realestate: "Professional and measured. Data-heavy responses do well here.",
  FirstTimeHomeBuyer: "Empathetic and educational. Many anxious first-timers here.",
  Tenant: "Supportive and advocacy-oriented. This community rallies around tenant rights.",
  renters: "Casual and supportive. Mix of experienced and new renters.",
  personalfinance: "Numbers-first. This sub respects data and financial analysis.",
  Miami: "Warm and helpful. Miami has a mix of transplants and locals — be welcoming.",
  askmiami: "Friendly and practical. Many newcomers asking about moving to Miami.",
  FloridaRenters: "Supportive. Florida tenant law is complex — be clear and specific.",
};

// -----------------------------------------------------------------------
// Steps
// -----------------------------------------------------------------------

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
        console.log(`[scan] r/${sub} -> ${res.status}`);
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

function scoreRelevance(candidate) {
  // Simple heuristic: more keyword matches + more engagement = higher score.
  // Caps at 1.0 for compat with existing schema (relevance_score numeric).
  const kwBoost = Math.min(candidate.keywordsMatched.length * 0.2, 0.6);
  const engageBoost = Math.min(
    Math.log10(candidate.numComments + 1) / 5,
    0.3
  );
  const ageBoost = 0.1; // fresh posts (already filtered by lookback)
  return Math.min(kwBoost + engageBoost + ageBoost, 1.0);
}

async function draftReply(candidate) {
  const tone =
    SUBREDDIT_TONE[candidate.subreddit] ??
    "Helpful and informative. Match the community's existing tone.";
  const msg = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 800,
    system: `${SYSTEM_PROMPT}\n\nSUBREDDIT TONE for r/${candidate.subreddit}: ${tone}`,
    messages: [
      {
        role: "user",
        content: `THREAD in r/${candidate.subreddit}:
Title: ${candidate.title}

Body: ${candidate.selftext || "(no body — title only)"}

Write a helpful reply. Lead with answering their question, include specific data where you can, and only mention LucidRents if it fits naturally. Output only the reply text — no preamble, no quotes.`,
      },
    ],
  });
  const text = msg.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  return text;
}

async function saveDraft(candidate, replyText, relevance) {
  if (DRY) {
    console.log(
      `[dry] would save r/${candidate.subreddit} thread ${candidate.threadId} score=${relevance.toFixed(2)}`
    );
    console.log(
      `[dry] reply preview: ${replyText.slice(0, 140).replace(/\n/g, " ")}...`
    );
    return true;
  }
  const { error } = await supabase.from("marketing_reddit_threads").upsert(
    {
      thread_id: candidate.threadId,
      subreddit: candidate.subreddit,
      title: candidate.title,
      url: candidate.url,
      relevance_score: relevance,
      keywords_matched: candidate.keywordsMatched,
      draft_reply: replyText,
      status: "draft_ready",
    },
    { onConflict: "thread_id", ignoreDuplicates: true }
  );
  if (error) {
    console.error(`[save] error ${candidate.threadId}: ${error.message}`);
    return false;
  }
  return true;
}

// -----------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------

async function main() {
  console.log(`[start] lookback=${LOOKBACK_HOURS}h subs=${TARGET_SUBREDDITS.length} dry=${DRY}`);

  const candidates = await scanSubreddits();
  console.log(`[scan] total ${candidates.length} keyword-matching candidates`);
  if (candidates.length === 0) return;

  // De-dupe existing threads so we don't pay for drafts we'll discard
  const { data: existing } = await supabase
    .from("marketing_reddit_threads")
    .select("thread_id")
    .in(
      "thread_id",
      candidates.map((c) => c.threadId)
    );
  const existingSet = new Set((existing ?? []).map((r) => r.thread_id));
  const fresh = candidates.filter((c) => !existingSet.has(c.threadId));
  console.log(`[dedup] ${fresh.length} fresh / ${candidates.length} total`);
  if (fresh.length === 0) return;

  // Rank + cap to keep LLM cost predictable
  const scored = fresh
    .map((c) => ({ c, score: scoreRelevance(c) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  let saved = 0;
  for (const { c, score } of scored) {
    try {
      const reply = await draftReply(c);
      if (!reply || reply.length < 40) {
        console.log(`[skip] ${c.threadId}: reply too short`);
        continue;
      }
      const ok = await saveDraft(c, reply, score);
      if (ok) saved++;
      console.log(`[draft] r/${c.subreddit} ${c.threadId} score=${score.toFixed(2)} saved=${ok}`);
    } catch (err) {
      console.error(`[draft] ${c.threadId} error: ${err.message}`);
    }
  }
  console.log(`[done] saved ${saved} new drafts`);
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});

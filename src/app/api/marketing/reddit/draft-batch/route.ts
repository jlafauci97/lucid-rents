// Accepts a batch of Reddit candidates (fetched from outside Vercel — Reddit
// blocks datacenter IPs), drafts replies using the same AI Gateway path as
// the content workflow, and saves them as `draft_ready`. Auth via CRON_SECRET.

import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { createAdminClient } from "@/lib/supabase/admin";
import { saveRedditThread } from "@/lib/marketing/supabase-queries";
import { evaluateThread } from "@/lib/marketing/reddit-gate";
import { scoreThread } from "@/lib/marketing/reddit-scoring";
import {
  REDDIT_SYSTEM_PROMPT,
  getSubredditTone,
} from "@/lib/marketing/brand-voice";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

interface Candidate {
  threadId: string;
  subreddit: string;
  title: string;
  url: string;
  selftext: string;
  score: number;
  numComments: number;
  /** Advisory only — the server rescores every candidate. */
  relevanceScore?: number;
  keywordsMatched?: string[];
}

interface Body {
  candidates: Candidate[];
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.candidates) || body.candidates.length === 0) {
    return NextResponse.json({ ok: true, drafted: 0, saved: 0 });
  }

  const supabase = createAdminClient();

  // Dedupe against existing thread_ids so we don't pay for re-drafts
  const { data: existing } = await supabase
    .from("marketing_reddit_threads")
    .select("thread_id")
    .in(
      "thread_id",
      body.candidates.map((c) => c.threadId)
    );
  const existingSet = new Set((existing ?? []).map((r) => r.thread_id));
  const fresh = body.candidates.filter((c) => !existingSet.has(c.threadId));

  const results: { threadId: string; ok: boolean; error?: string }[] = [];
  let saved = 0;
  let skipped = 0;

  for (const thread of fresh) {
    try {
      // Score here rather than trusting the caller. The scanner runs off-box
      // and previously supplied its own relevanceScore, which nothing checked.
      const scored = await scoreThread({
        subreddit: thread.subreddit,
        title: thread.title,
        selftext: thread.selftext ?? "",
        score: thread.score,
        numComments: thread.numComments,
      });

      const relevanceScore = scored?.relevanceScore ?? 0;
      const keywordsMatched = scored?.keywordsMatched ?? thread.keywordsMatched ?? [];

      const gate = await evaluateThread({
        title: thread.title,
        selftext: thread.selftext ?? "",
        subreddit: thread.subreddit,
        relevanceScore,
      });

      if (!gate.pass || !gate.hook) {
        // Record the skip so the filter's behaviour stays reviewable instead of
        // silently discarding candidates.
        await saveRedditThread({
          threadId: thread.threadId,
          subreddit: thread.subreddit,
          title: thread.title,
          url: thread.url,
          relevanceScore,
          keywordsMatched,
          draftReply: "",
          status: "skipped",
          selftext: thread.selftext,
          postScore: thread.score,
          numComments: thread.numComments,
        });
        skipped++;
        results.push({ threadId: thread.threadId, ok: false, error: gate.reason });
        continue;
      }

      const hook = gate.hook;

      const result = await generateText({
        model: "anthropic/claude-sonnet-4.6" as never,
        system:
          REDDIT_SYSTEM_PROMPT +
          `\n\nSUBREDDIT TONE for r/${thread.subreddit}: ${getSubredditTone(thread.subreddit)}`,
        prompt: `THREAD in r/${thread.subreddit}:
Title: ${thread.title}
Body: ${thread.selftext}
Thread score: ${thread.score} | Comments: ${thread.numComments}

THE ONE FACT THIS REPLY EXISTS TO SHARE (from LucidRents' own data):
  ${hook.kind}: ${hook.label} — ${hook.stat}
  Source page: ${hook.url}

Write a short, helpful Reddit reply that answers the person and works this
specific fact in naturally. Requirements:
- Cite the fact above. It is the reason we are replying; without it, say nothing.
- Link the source page once, inline, where it is genuinely useful.
- Do NOT give legal advice, and do NOT reference any jurisdiction other than
  ${hook.city}.
- No greeting, no sign-off, no marketing language. Sound like a person who
  happened to have the data, because that is what we are.

Reply:`,
        maxOutputTokens: 500,
      });

      const reply = result.text.trim();
      if (!reply || reply.length < 40) {
        results.push({ threadId: thread.threadId, ok: false, error: "reply too short" });
        continue;
      }

      // A reply that dropped the fact it was built around is not the reply we
      // approved the thread for.
      if (!reply.includes(hook.url)) {
        results.push({
          threadId: thread.threadId,
          ok: false,
          error: "generated reply omitted the source link",
        });
        continue;
      }

      const row = await saveRedditThread({
        threadId: thread.threadId,
        subreddit: thread.subreddit,
        title: thread.title,
        url: thread.url,
        relevanceScore,
        keywordsMatched,
        draftReply: reply,
        status: "draft_ready",
        selftext: thread.selftext,
        postScore: thread.score,
        numComments: thread.numComments,
      });
      if (row) saved++;
      results.push({ threadId: thread.threadId, ok: true });
    } catch (err) {
      results.push({
        threadId: thread.threadId,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  console.log(
    `[reddit/draft-batch] received=${body.candidates.length} fresh=${fresh.length} drafted=${saved} skipped=${skipped}`
  );

  return NextResponse.json({
    ok: true,
    received: body.candidates.length,
    fresh: fresh.length,
    saved,
    skipped,
    results,
  });
}

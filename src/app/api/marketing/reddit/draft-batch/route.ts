// Accepts a batch of Reddit candidates (fetched from outside Vercel — Reddit
// blocks datacenter IPs), drafts replies using the same AI Gateway path as
// the content workflow, and saves them as `draft_ready`. Auth via CRON_SECRET.

import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { createAdminClient } from "@/lib/supabase/admin";
import { saveRedditThread } from "@/lib/marketing/supabase-queries";
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
  relevanceScore: number;
  keywordsMatched: string[];
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

  for (const thread of fresh) {
    try {
      let buildingContext = "";
      const addressMatch = (thread.title + " " + thread.selftext).match(
        /\d+\s+[\w\s]+(?:st|street|ave|avenue|blvd|boulevard|rd|road|dr|drive|pl|place|way|ln|lane)\b/i
      );
      if (addressMatch) {
        const { data: buildings } = await supabase
          .from("buildings")
          .select("address, city, violation_count, owner_name")
          .ilike("address", `%${addressMatch[0].trim()}%`)
          .limit(3);
        if (buildings && buildings.length > 0) {
          buildingContext = `\n\nRELEVANT BUILDING DATA FROM LUCIDRENTS:\n${buildings
            .map(
              (b) =>
                `- ${b.address}, ${b.city}: ${b.violation_count ?? 0} violations, owner: ${b.owner_name ?? "unknown"}`
            )
            .join("\n")}`;
        }
      }

      const result = await generateText({
        model: "anthropic/claude-sonnet-4.6" as never,
        system:
          REDDIT_SYSTEM_PROMPT +
          `\n\nSUBREDDIT TONE for r/${thread.subreddit}: ${getSubredditTone(thread.subreddit)}`,
        prompt: `THREAD in r/${thread.subreddit}:
Title: ${thread.title}
Body: ${thread.selftext}
Thread score: ${thread.score} | Comments: ${thread.numComments}
${buildingContext}

Write a helpful Reddit reply. Lead with value. Be genuine. If there is relevant building data above, weave it in naturally. Only mention lucidrents.com if it fits as a natural next step.

Reply:`,
        maxOutputTokens: 800,
      });

      const reply = result.text.trim();

      // The drafter prompt instructs the model to return the literal token
      // "SKIP" when the thread isn't a housing/tenant/landlord question
      // (personal finance, transit, concert, neighbor disputes, etc.).
      // Persist the row as 'skipped' so we dedupe and don't re-scan it,
      // but don't surface it for human review.
      if (/^SKIP\b/i.test(reply)) {
        const row = await saveRedditThread({
          threadId: thread.threadId,
          subreddit: thread.subreddit,
          title: thread.title,
          url: thread.url,
          relevanceScore: thread.relevanceScore,
          keywordsMatched: thread.keywordsMatched,
          draftReply: "(model returned SKIP — off-topic)",
          status: "skipped",
        });
        if (row) {
          results.push({ threadId: thread.threadId, ok: true, error: "skipped (off-topic)" });
        } else {
          results.push({ threadId: thread.threadId, ok: false, error: "skipped + save failed" });
        }
        continue;
      }

      if (!reply || reply.length < 40) {
        results.push({ threadId: thread.threadId, ok: false, error: "reply too short" });
        continue;
      }

      const row = await saveRedditThread({
        threadId: thread.threadId,
        subreddit: thread.subreddit,
        title: thread.title,
        url: thread.url,
        relevanceScore: thread.relevanceScore,
        keywordsMatched: thread.keywordsMatched,
        draftReply: reply,
        status: "draft_ready",
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

  return NextResponse.json({
    ok: true,
    received: body.candidates.length,
    fresh: fresh.length,
    saved,
    results,
  });
}

// Accepts a batch of Reddit candidates (fetched from outside Vercel — Reddit
// blocks datacenter IPs), scores their relevance with Claude (geo kill +
// weighted threshold, same bar as the legacy workflow path), drafts replies
// for the qualified ones using the same AI Gateway path as the content
// workflow, and saves them as `draft_ready`. Auth via CRON_SECRET.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { saveRedditThread } from "@/lib/marketing/supabase-queries";
import {
  scoreThreadRelevance,
  lookupBuildingContext,
  draftRedditReply,
} from "@/lib/marketing/reddit-ai";

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

  const results: {
    threadId: string;
    ok: boolean;
    skipped?: string;
    score?: number;
    error?: string;
  }[] = [];
  let saved = 0;
  let scoredOut = 0;

  for (const thread of fresh) {
    try {
      // LLM relevance gate. The scanner's keyword match is just a pre-filter;
      // this is what keeps lease-takeover ads and out-of-market posts from
      // reaching the review queue.
      const relevance = await scoreThreadRelevance(thread);
      if (!relevance) {
        results.push({ threadId: thread.threadId, ok: false, error: "score parse error" });
        continue;
      }
      if (!relevance.qualified) {
        scoredOut++;
        results.push({
          threadId: thread.threadId,
          ok: false,
          skipped: relevance.geoMatch < 0.5 ? "geo_mismatch" : "below_threshold",
          score: relevance.weighted,
        });
        continue;
      }

      const buildingContext = await lookupBuildingContext(
        supabase,
        thread.title + " " + thread.selftext
      );

      const reply = await draftRedditReply(thread, buildingContext);
      if (!reply || reply.length < 40) {
        results.push({ threadId: thread.threadId, ok: false, error: "reply too short" });
        continue;
      }

      const row = await saveRedditThread({
        threadId: thread.threadId,
        subreddit: thread.subreddit,
        title: thread.title,
        url: thread.url,
        relevanceScore: relevance.weighted,
        keywordsMatched: thread.keywordsMatched,
        draftReply: reply,
        status: "draft_ready",
        selftext: thread.selftext,
        postScore: thread.score,
        numComments: thread.numComments,
      });
      if (row) saved++;
      results.push({ threadId: thread.threadId, ok: true, score: relevance.weighted });
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
    scoredOut,
    saved,
    results,
  });
}

// Work queue for the Chrome-driven poster on the Mac mini.
//
// The poster runs off-platform because Reddit posting happens through the
// user's logged-in browser, not an API token. Keeping the queue behind this
// endpoint means the mini needs only CRON_SECRET — the Supabase service key
// never leaves Vercel.
//
// GET  returns at most one item, already filtered by rate limits.
// PATCH records the outcome.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkAllLimits } from "@/lib/marketing/reddit";

export const dynamic = "force-dynamic";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && req.headers.get("authorization") === `Bearer ${secret}`;
}

export interface QueueItem {
  type: "reply" | "selfpost";
  id: string;
  /** Thread permalink for replies; null for self-posts. */
  url: string | null;
  subreddit: string | null;
  title: string | null;
  body: string;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Replies first — they are time-sensitive in a way a ranking post is not.
  const { data: replies } = await supabase
    .from("marketing_reddit_threads")
    .select("id, subreddit, title, url, draft_reply")
    .eq("status", "approved")
    .order("relevance_score", { ascending: false })
    .limit(5);

  for (const r of replies ?? []) {
    const limits = await checkAllLimits(r.subreddit as string);
    if (!limits.canPost) {
      // Rate limits are global-ish, so the first blocked reply blocks them all.
      return NextResponse.json({
        ok: true,
        item: null,
        reason: limits.reason,
        waitSeconds: limits.waitSeconds ?? null,
      });
    }
    if (!r.draft_reply) continue;

    return NextResponse.json({
      ok: true,
      item: {
        type: "reply",
        id: r.id,
        url: r.url,
        subreddit: r.subreddit,
        title: r.title,
        body: r.draft_reply,
      } satisfies QueueItem,
    });
  }

  // Then our own posts. These go to our profile, so subreddit rate limits do
  // not apply — but we still space them out, one per run.
  const { data: selfPosts } = await supabase
    .from("marketing_reddit_posts")
    .select("id, title, body")
    .eq("status", "draft")
    .order("created_at", { ascending: true })
    .limit(1);

  const sp = selfPosts?.[0];
  if (sp) {
    return NextResponse.json({
      ok: true,
      item: {
        type: "selfpost",
        id: sp.id as string,
        url: null,
        subreddit: null,
        title: sp.title as string,
        body: sp.body as string,
      } satisfies QueueItem,
    });
  }

  return NextResponse.json({ ok: true, item: null, reason: "queue empty" });
}

export async function PATCH(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { type?: string; id?: string; ok?: boolean; url?: string; error?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { type, id, ok, url, error } = body;
  if (!id || (type !== "reply" && type !== "selfpost")) {
    return NextResponse.json({ error: "type and id are required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  if (type === "reply") {
    // A failed post stays 'approved' so the next run retries it; the error is
    // recorded rather than silently swallowed.
    const patch = ok
      ? { status: "replied", replied_at: now }
      : { status: "approved" };
    const { error: dbError } = await supabase
      .from("marketing_reddit_threads")
      .update(patch)
      .eq("id", id);
    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }
  } else {
    const { error: dbError } = await supabase
      .from("marketing_reddit_posts")
      .update(
        ok
          ? { status: "posted", posted_at: now, posted_url: url ?? null }
          : { status: "draft" }
      )
      .eq("id", id);
    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }
  }

  console.log(
    `[reddit/queue] ${type} ${id} -> ${ok ? "posted" : `failed: ${error ?? "unknown"}`}`
  );
  return NextResponse.json({ ok: true });
}

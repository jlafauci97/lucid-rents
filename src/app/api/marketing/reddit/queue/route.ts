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
  // not apply — but they need their own spacing now that the poster polls
  // every few minutes instead of running on four fixed slots: without it a
  // backlog of drafts would all publish within the hour. Mirror the old
  // schedule's cadence: at least 3 hours apart, at most 3 in 24 hours.
  const { data: recentPosts } = await supabase
    .from("marketing_reddit_posts")
    .select("posted_at")
    .eq("status", "posted")
    .gte("posted_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order("posted_at", { ascending: false });

  const MIN_SELFPOST_GAP_MS = 3 * 60 * 60 * 1000;
  const MAX_SELFPOSTS_PER_DAY = 3;
  if ((recentPosts?.length ?? 0) >= MAX_SELFPOSTS_PER_DAY) {
    return NextResponse.json({
      ok: true,
      item: null,
      reason: `Self-post daily limit reached (${MAX_SELFPOSTS_PER_DAY}/24h)`,
    });
  }
  const lastPostedAt = recentPosts?.[0]?.posted_at
    ? new Date(recentPosts[0].posted_at as string).getTime()
    : 0;
  const selfPostWaitMs = lastPostedAt + MIN_SELFPOST_GAP_MS - Date.now();
  if (selfPostWaitMs > 0) {
    return NextResponse.json({
      ok: true,
      item: null,
      reason: "Self-post gap (3h) not elapsed",
      waitSeconds: Math.ceil(selfPostWaitMs / 1000),
    });
  }

  // Like replies, self-posts only publish after a human moved them
  // draft -> approved in mission control.
  const { data: selfPosts } = await supabase
    .from("marketing_reddit_posts")
    .select("id, title, body")
    .eq("status", "approved")
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

  let body: {
    type?: string;
    id?: string;
    ok?: boolean;
    url?: string;
    error?: string;
    /** The item can never succeed (thread deleted/removed/locked); retire it. */
    permanent?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { type, id, ok, url, error, permanent } = body;
  if (!id || (type !== "reply" && type !== "selfpost")) {
    return NextResponse.json({ error: "type and id are required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  if (type === "reply") {
    // A failed post stays 'approved' so the next run retries it; the error is
    // recorded rather than silently swallowed. A *permanent* failure — the
    // thread is gone, removed, locked or archived — is retired to 'skipped'
    // instead. Retrying it would be pointless, and because approved replies
    // are always served ahead of self-posts, one dead thread left in
    // 'approved' starves the entire queue behind it indefinitely.
    const patch = ok
      ? { status: "replied", replied_at: now }
      : permanent
        ? { status: "skipped" }
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
          : permanent
            ? { status: "rejected" }
            : // Stays approved so the next run retries it — bouncing back to
              // 'draft' would silently demand a second human approval for a
              // transient browser failure.
              { status: "approved" }
      )
      .eq("id", id);
    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }
  }

  console.log(
    `[reddit/queue] ${type} ${id} -> ${
      ok
        ? "posted"
        : `${permanent ? "retired" : "failed"}: ${error ?? "unknown"}`
    }`
  );
  return NextResponse.json({ ok: true });
}

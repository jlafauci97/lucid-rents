// Regenerate the AI draft for a pending Reddit thread, optionally steered by
// reviewer guidance ("shorter", "skip the site mention", ...). Updates the
// stored draft and returns the new text so the dashboard can show it
// immediately.

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { MC_COOKIE, verifyCookieValue } from "@/lib/mission-control/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getRedditThread,
  updateRedditThread,
} from "@/lib/marketing/supabase-queries";
import {
  lookupBuildingContext,
  draftRedditReply,
} from "@/lib/marketing/reddit-ai";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  // Same gate as /api/marketing/approve-reddit — Mission Control's password
  // cookie, not Supabase auth.
  const store = await cookies();
  const cookieVal = store.get(MC_COOKIE)?.value;
  if (!(await verifyCookieValue(cookieVal))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { threadId?: string; guidance?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.threadId) {
    return NextResponse.json(
      { error: "Missing required field: threadId" },
      { status: 400 }
    );
  }

  try {
    const thread = await getRedditThread(body.threadId);
    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }
    if (thread.status !== "draft_ready") {
      return NextResponse.json(
        { error: `Thread is '${thread.status}', only draft_ready can be regenerated` },
        { status: 409 }
      );
    }

    const supabase = createAdminClient();
    const title = thread.title ?? "";
    const selftext = thread.selftext ?? "";

    const buildingContext = await lookupBuildingContext(
      supabase,
      title + " " + selftext
    );

    const reply = await draftRedditReply(
      {
        subreddit: thread.subreddit,
        title,
        selftext,
        score: thread.post_score ?? 0,
        numComments: thread.num_comments ?? 0,
      },
      buildingContext,
      body.guidance?.trim() || undefined
    );

    if (!reply || reply.length < 40) {
      return NextResponse.json(
        { error: "Model returned an unusable draft, try again" },
        { status: 502 }
      );
    }

    await updateRedditThread(body.threadId, { draftReply: reply });
    return NextResponse.json({ ok: true, reply });
  } catch (err) {
    console.error("Regenerate Reddit draft error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

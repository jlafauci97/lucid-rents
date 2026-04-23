import { NextRequest, NextResponse } from "next/server";
import { resumeHook } from "workflow/api";
import { cookies } from "next/headers";
import { MC_COOKIE, verifyCookieValue } from "@/lib/mission-control/auth";
import {
  getRedditThread,
  updateRedditThread,
} from "@/lib/marketing/supabase-queries";
import type { ApproveRedditRequest } from "@/types/marketing";

export async function POST(req: NextRequest) {
  // Mission Control is gated by a password cookie (MC_COOKIE), not Supabase
  // auth. Anyone who can reach /mission-control/reddit has already cleared
  // the proxy gate — reuse the same cookie here instead of requiring a
  // separate Supabase login.
  const store = await cookies();
  const cookieVal = store.get(MC_COOKIE)?.value;
  if (!(await verifyCookieValue(cookieVal))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: ApproveRedditRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { threadId, action, editedReply } = body;
  if (!threadId || !action) {
    return NextResponse.json(
      { error: "Missing required fields: threadId, action" },
      { status: 400 }
    );
  }

  try {
    const thread = await getRedditThread(threadId);
    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    // Drafts produced by the scheduled task (scripts/scan-and-draft-reddit + draft-batch endpoint)
    // have no hook_token because they bypass Vercel Workflow entirely. Only drafts from the legacy
    // workflow path have one, and in that case we still need to resume the hook so the workflow
    // completes. Both paths update the DB status the same way.
    const hookToken = thread.hook_token;

    if (action === "approve") {
      await updateRedditThread(threadId, {
        status: "approved",
        ...(editedReply ? { draftReply: editedReply } : {}),
      });
      if (hookToken) {
        await resumeHook(hookToken, { approved: true, editedReply });
      }
    } else {
      await updateRedditThread(threadId, { status: "skipped" });
      if (hookToken) {
        await resumeHook(hookToken, { approved: false });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Approve Reddit thread error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { resumeHook } from "workflow/api";
import { createClient } from "@/lib/supabase/server";
import {
  getRedditThread,
  updateRedditThread,
} from "@/lib/marketing/supabase-queries";
import type { ApproveRedditRequest } from "@/types/marketing";

async function checkAdmin(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const adminIds = (process.env.MARKETING_ADMIN_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return adminIds.includes(user.id) ? user.id : null;
}

export async function POST(req: NextRequest) {
  const adminId = await checkAdmin();
  if (!adminId) {
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

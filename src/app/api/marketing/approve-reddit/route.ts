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

    const hookToken = thread.hook_token;
    if (!hookToken) {
      return NextResponse.json(
        { error: "Thread has no pending approval hook" },
        { status: 409 }
      );
    }

    if (action === "approve") {
      await updateRedditThread(threadId, { status: "approved" });
      await resumeHook(hookToken, {
        approved: true,
        editedReply,
      });
    } else {
      // skip
      await updateRedditThread(threadId, { status: "skipped" });
      await resumeHook(hookToken, { approved: false });
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

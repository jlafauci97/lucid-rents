import { NextRequest, NextResponse } from "next/server";
import { resumeHook } from "workflow/api";
import { createClient } from "@/lib/supabase/server";
import { getDraft, updateDraft } from "@/lib/marketing/supabase-queries";
import type { ApproveRequest } from "@/types/marketing";

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

  let body: ApproveRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { draftId, action, editedContent } = body;
  if (!draftId || !action) {
    return NextResponse.json(
      { error: "Missing required fields: draftId, action" },
      { status: 400 }
    );
  }

  try {
    const draft = await getDraft(draftId);
    if (!draft) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }

    const hookToken = draft.hook_token;
    if (!hookToken) {
      return NextResponse.json(
        { error: "Draft has no pending approval hook" },
        { status: 409 }
      );
    }

    if (action === "approve") {
      await updateDraft(draftId, { status: "approved" });
      await resumeHook(hookToken, {
        approved: true,
        editedContent,
      });
    } else {
      // reject
      await updateDraft(draftId, { status: "rejected" });
      await resumeHook(hookToken, { approved: false });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Approve draft error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

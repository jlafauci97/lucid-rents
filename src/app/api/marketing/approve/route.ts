import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDraft, updateDraft } from "@/lib/marketing/supabase-queries";
import { publishDraft } from "@/lib/marketing/publish-draft";
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

    if (draft.status === "published") {
      return NextResponse.json(
        { error: "Draft is already published" },
        { status: 409 }
      );
    }

    if (action !== "approve") {
      await updateDraft(draftId, { status: "rejected" });
      return NextResponse.json({ ok: true, status: "rejected" });
    }

    // The content workflow publishes on its own now, so approving is no longer
    // resuming a suspended hook — it publishes directly. This route exists for
    // drafts the auto-publish sanity gate held back for a human to look at.
    await updateDraft(draftId, { status: "approved" });
    const results = await publishDraft(draftId, editedContent);

    return NextResponse.json({ ok: true, status: "published", results });
  } catch (err) {
    console.error("Approve draft error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

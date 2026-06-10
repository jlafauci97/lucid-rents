import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { resumeHook } from "workflow/api";
import { getMarketingActor } from "@/lib/marketing/auth";
import { getDraft, updateDraft } from "@/lib/marketing/supabase-queries";
import type { ApproveBatchRequest } from "@/types/marketing";

export async function POST(req: NextRequest) {
  // Admin user id or "mission-control" — kept for attribution.
  const actor = await getMarketingActor();
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: ApproveBatchRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { draftIds } = body;
  if (!Array.isArray(draftIds) || draftIds.length === 0) {
    return NextResponse.json(
      { error: "draftIds must be a non-empty array" },
      { status: 400 }
    );
  }

  waitUntil(
    (async () => {
      for (const id of draftIds) {
        const draft = await getDraft(id);
        if (!draft?.hook_token) continue;
        await updateDraft(id, { status: "approved" });
        await resumeHook(draft.hook_token, { approved: true });
        // Wait 2 minutes between publishes (except last)
        if (id !== draftIds[draftIds.length - 1]) {
          await new Promise((r) => setTimeout(r, 120_000));
        }
      }
    })()
  );

  return NextResponse.json({ ok: true, count: draftIds.length });
}

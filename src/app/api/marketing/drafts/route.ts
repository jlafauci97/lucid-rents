import { NextRequest, NextResponse } from "next/server";
import { requireMarketingAuth } from "@/lib/marketing/auth";
import { listDrafts } from "@/lib/marketing/supabase-queries";
import type { MarketingDraftStatus } from "@/types/marketing";

export async function GET(req: NextRequest) {
  if (!(await requireMarketingAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status") as MarketingDraftStatus | null;
  const limitParam = searchParams.get("limit");
  const offsetParam = searchParams.get("offset");

  const limit = limitParam ? parseInt(limitParam, 10) : undefined;
  const offset = offsetParam ? parseInt(offsetParam, 10) : undefined;

  if (limitParam && (isNaN(limit!) || limit! < 1)) {
    return NextResponse.json({ error: "Invalid limit parameter" }, { status: 400 });
  }
  if (offsetParam && (isNaN(offset!) || offset! < 0)) {
    return NextResponse.json({ error: "Invalid offset parameter" }, { status: 400 });
  }

  try {
    let drafts = await listDrafts(status ?? undefined, limit);
    const total = drafts.length;

    // Apply offset manually (listDrafts doesn't support offset natively)
    if (offset && offset > 0) {
      drafts = drafts.slice(offset);
    }

    return NextResponse.json({ drafts, count: total });
  } catch (err) {
    console.error("List drafts error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

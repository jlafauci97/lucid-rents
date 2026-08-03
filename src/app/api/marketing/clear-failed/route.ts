import { NextRequest, NextResponse } from "next/server";
import { isMarketingAuthorized } from "@/lib/marketing/api-auth";
import { clearFailedDrafts } from "@/lib/marketing/supabase-queries";

export async function POST(req: NextRequest) {
  if (!(await isMarketingAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }  try {
    const count = await clearFailedDrafts();
    return NextResponse.json({ ok: true, deleted: count });
  } catch (err) {
    console.error("Clear failed drafts error:", err);
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { requireMarketingAuth } from "@/lib/marketing/auth";
import { clearFailedDrafts } from "@/lib/marketing/supabase-queries";

export async function POST() {
  if (!(await requireMarketingAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
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

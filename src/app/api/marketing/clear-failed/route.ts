import { NextResponse } from "next/server";
import { clearFailedDrafts } from "@/lib/marketing/supabase-queries";

export async function POST() {
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

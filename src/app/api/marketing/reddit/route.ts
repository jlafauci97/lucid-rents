import { NextRequest, NextResponse } from "next/server";
import { listRedditThreads } from "@/lib/marketing/supabase-queries";
import type { MarketingRedditStatus } from "@/types/marketing";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status") as MarketingRedditStatus | null;

  try {
    const threads = await listRedditThreads(status ?? undefined);
    return NextResponse.json({ threads, count: threads.length });
  } catch (err) {
    console.error("List Reddit threads error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

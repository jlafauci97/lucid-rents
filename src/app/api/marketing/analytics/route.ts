import { NextRequest, NextResponse } from "next/server";
import { getAnalytics } from "@/lib/marketing/supabase-queries";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const startDate = searchParams.get("startDate") ?? undefined;
  const endDate = searchParams.get("endDate") ?? undefined;

  try {
    const analytics = await getAnalytics({ startDate, endDate });
    return NextResponse.json({ analytics, count: analytics.length });
  } catch (err) {
    console.error("Get analytics error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

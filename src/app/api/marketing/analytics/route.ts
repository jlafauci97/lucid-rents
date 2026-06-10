import { NextRequest, NextResponse } from "next/server";
import { requireMarketingAuth } from "@/lib/marketing/auth";
import { getAnalytics } from "@/lib/marketing/supabase-queries";

export async function GET(req: NextRequest) {
  if (!(await requireMarketingAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

import { NextResponse } from "next/server";
import { requireMarketingAuth } from "@/lib/marketing/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MarketingRedditStatus } from "@/types/marketing";

const STATUSES: MarketingRedditStatus[] = [
  "detected",
  "draft_ready",
  "approved",
  "replied",
  "skipped",
];

export async function GET() {
  if (!(await requireMarketingAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const results = await Promise.all(
      STATUSES.map(async (status) => {
        const { count, error } = await supabase
          .from("marketing_reddit_threads")
          .select("id", { count: "exact", head: true })
          .eq("status", status);
        if (error) throw error;
        return [status, count ?? 0] as const;
      })
    );

    const byStatus = Object.fromEntries(results) as Record<
      MarketingRedditStatus,
      number
    >;
    const total = Object.values(byStatus).reduce((s, n) => s + n, 0);

    return NextResponse.json({ byStatus, total });
  } catch (err) {
    console.error("Reddit counts error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

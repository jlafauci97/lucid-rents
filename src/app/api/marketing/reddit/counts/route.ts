import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRedditDailyCount } from "@/lib/marketing/supabase-queries";
import { MAX_DAILY_REPLIES } from "@/lib/marketing/reddit";
import type { MarketingRedditStatus } from "@/types/marketing";

const STATUSES: MarketingRedditStatus[] = [
  "detected",
  "draft_ready",
  "approved",
  "replied",
  "skipped",
];

export async function GET() {
  try {
    const supabase = createAdminClient();
    const [results, repliedToday] = await Promise.all([
      Promise.all(
        STATUSES.map(async (status) => {
          const { count, error } = await supabase
            .from("marketing_reddit_threads")
            .select("id", { count: "exact", head: true })
            .eq("status", status);
          if (error) throw error;
          return [status, count ?? 0] as const;
        })
      ),
      getRedditDailyCount(),
    ]);

    const byStatus = Object.fromEntries(results) as Record<
      MarketingRedditStatus,
      number
    >;
    const total = Object.values(byStatus).reduce((s, n) => s + n, 0);

    return NextResponse.json({
      byStatus,
      total,
      quota: { repliedToday, maxDaily: MAX_DAILY_REPLIES },
    });
  } catch (err) {
    console.error("Reddit counts error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

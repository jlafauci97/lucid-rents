import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// Refreshes the performance-cache materialized views nightly.
// Both views use CONCURRENTLY so reads keep working during refresh.
// - mv_city_avg_score      → backs city_avg_score() RPC (~2.3M calls/month)
// - mv_crime_zip_summary   → backs crime_zip_summary() RPC (~548K calls/month)

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes — crime matview takes a couple minutes

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const startedAt = Date.now();

  const { data, error } = await supabase.rpc("refresh_perf_matviews" as never);

  if (error) {
    console.error("[refresh-matviews] failed", error);
    return NextResponse.json(
      { ok: false, error: error.message, took_ms: Date.now() - startedAt },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    result: data,
    took_ms: Date.now() - startedAt,
  });
}

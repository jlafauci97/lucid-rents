import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// Weekly reset of pg_stat_statements so the top-slow-queries view reflects
// the last 7 days of traffic, not stale months-old data.
// Without this, query patterns we already fixed in earlier perf rounds keep
// dominating the top of the list forever and we can't see what's slow NOW.

export const dynamic = "force-dynamic";

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

  const { error } = await supabase.rpc("reset_pg_stat_statements" as never);

  if (error) {
    console.error("[reset-perf-stats] failed", error);
    return NextResponse.json(
      { ok: false, error: error.message, took_ms: Date.now() - startedAt },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    reset_at: new Date().toISOString(),
    took_ms: Date.now() - startedAt,
  });
}

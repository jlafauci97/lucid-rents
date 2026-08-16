import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { buildingUrl } from "@/lib/seo";
import type { City } from "@/lib/cities";

export const maxDuration = 300;

/**
 * Warm the ISR cache for the most-visited building pages.
 *
 * Building pages are `revalidate = 604800` with no generateStaticParams, and
 * every deploy resets the ISR cache — so the first visitor to any building
 * after a deploy pays the cold build (~1-2s since the Aug 2026 render-cost
 * fixes; 9-23s before them). This cron self-fetches the top pages per metro
 * so a machine pays that cost instead of a person — or Googlebot, whose
 * experienced latency directly sets the crawl rate it grants us.
 *
 * Buildings are ranked by review_count (a proxy for traffic — reviewed
 * buildings are the ones people search for), then violation_count as a
 * tiebreaker to cover the "worst buildings" lists that rankings pages link.
 */

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

// 500/metro (was 150): renders are ~10x cheaper since the Aug 2026 fixes and
// the 7-day data caches mean repeat warms mostly skip the DB entirely, so the
// same 300s window covers far more of the crawl surface. Sized to finish
// inside maxDuration at ~1-2s/page cold, well under it once caches are warm.
const PER_METRO = 500;
// Modest parallelism: enough to warm ~1500 pages inside maxDuration without
// stampeding the database that's also serving live traffic.
const CONCURRENCY = 8;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  // .trim() guards against the env value's trailing newline (breaks fetch URLs)
  const origin = (process.env.NEXT_PUBLIC_APP_URL || "https://lucidrents.com").trim();
  const startTime = Date.now();
  const metros: City[] = ["nyc", "los-angeles", "chicago"];

  const urls: string[] = [];
  const errors: string[] = [];

  for (const metro of metros) {
    const { data, error } = await supabase
      .from("buildings")
      .select("borough, slug")
      .eq("metro", metro)
      .not("slug", "is", null)
      .not("borough", "is", null)
      .order("review_count", { ascending: false })
      .order("violation_count", { ascending: false })
      .limit(PER_METRO);
    if (error) {
      errors.push(`${metro} query: ${error.message}`);
      continue;
    }
    for (const b of data ?? []) {
      urls.push(origin + buildingUrl(b, metro));
    }
  }

  let warmed = 0;
  let failed = 0;

  // Chunked fan-out; a HEAD-like GET is enough to populate the ISR cache.
  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    // Stop with headroom so the function returns cleanly instead of being
    // killed mid-flight at maxDuration.
    if (Date.now() - startTime > (maxDuration - 30) * 1000) {
      errors.push(`time budget exhausted after ${warmed + failed}/${urls.length}`);
      break;
    }
    const chunk = urls.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      chunk.map((u) =>
        fetch(u, {
          headers: { "user-agent": "lucidrents-cache-warmer" },
          signal: AbortSignal.timeout(60_000),
        }),
      ),
    );
    for (const r of results) {
      if (r.status === "fulfilled" && r.value.ok) warmed++;
      else failed++;
    }
  }

  return NextResponse.json({
    warmed,
    failed,
    total: urls.length,
    durationMs: Date.now() - startTime,
    errors: errors.length ? errors : undefined,
  });
}

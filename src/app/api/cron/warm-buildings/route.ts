import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { buildingUrl } from "@/lib/seo";
import type { City } from "@/lib/cities";

export const maxDuration = 300;

/**
 * Warm the ISR cache for the most-visited building pages.
 *
 * Building pages are `revalidate = 86400` with no generateStaticParams, and
 * every deploy resets the ISR cache — so the first visitor to any building
 * after a deploy (or after 24h) pays the full cold build: 9-23s measured in
 * production. This cron self-fetches the top pages per metro so a machine
 * pays that cost instead of a person.
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

const PER_METRO = 150;
// Modest parallelism: enough to warm ~450 pages inside maxDuration without
// stampeding the database that's also serving live traffic.
const CONCURRENCY = 6;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const origin = process.env.NEXT_PUBLIC_APP_URL || "https://lucidrents.com";
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

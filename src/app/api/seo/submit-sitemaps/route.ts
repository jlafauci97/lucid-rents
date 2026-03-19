import { NextRequest, NextResponse } from "next/server";
import { submitAllSitemaps } from "@/lib/google-search-console";

/**
 * POST /api/seo/submit-sitemaps
 *
 * Re-submit all sitemaps to Google Search Console. Call this after data syncs
 * (e.g., new buildings added) to prompt Google to re-crawl.
 * Protected by CRON_SECRET.
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await submitAllSitemaps();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

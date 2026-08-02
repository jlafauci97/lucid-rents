// Scans recent news for landlords we track and drafts a press kit for each
// match. Draft-only — these name real companies alongside real coverage, so
// nothing here is published or sent without a human reading it first.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findPressKits } from "@/lib/marketing/press-kit";

export const maxDuration = 300;
export const revalidate = 0;

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sinceHours = Number(req.nextUrl.searchParams.get("sinceHours") ?? 48);
  const dryRun = req.nextUrl.searchParams.get("dryRun") === "true";

  if (!Number.isFinite(sinceHours) || sinceHours <= 0 || sinceHours > 24 * 30) {
    return NextResponse.json({ error: "sinceHours must be 1..720" }, { status: 400 });
  }

  try {
    const kits = await findPressKits({ sinceHours });

    if (dryRun) {
      return NextResponse.json({ ok: true, dryRun: true, found: kits.length, kits });
    }

    const supabase = createAdminClient();
    const created: string[] = [];
    const skipped: { owner: string; reason: string }[] = [];

    for (const kit of kits) {
      const { error } = await supabase.from("marketing_press_kits").insert({
        article_id: kit.articleId,
        article_title: kit.articleTitle,
        article_url: kit.articleUrl,
        source_name: kit.sourceName,
        city: kit.city,
        owner_name: kit.ownerName,
        matched_on: kit.matchedOn,
        confidence: kit.confidence,
        stats: kit.stats,
        body: kit.body,
      });

      // The unique index makes a repeat run a no-op rather than duplicate
      // outreach about the same story.
      if (error) {
        skipped.push({
          owner: kit.ownerName,
          reason: error.code === "23505" ? "already drafted for this article" : error.message,
        });
        continue;
      }
      created.push(`${kit.ownerName} → ${kit.articleTitle.slice(0, 60)}`);
    }

    console.log(
      `[cron/press-kit] scanned=${sinceHours}h matches=${kits.length} created=${created.length} skipped=${skipped.length}`
    );

    return NextResponse.json({ ok: true, found: kits.length, created, skipped });
  } catch (err) {
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    console.error("[cron/press-kit] failed:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

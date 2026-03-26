import { NextRequest, NextResponse } from "next/server";
import { start } from "workflow/api";
import { contentWorkflow } from "../../../../../workflows/marketing-content";
import { redditMonitorWorkflow } from "../../../../../workflows/marketing-reddit";
import { listDrafts, upsertAnalytics } from "@/lib/marketing/supabase-queries";
import { getPostAnalytics } from "@/lib/marketing/post-bridge";

export const maxDuration = 300;
export const revalidate = 0;

export async function GET(req: NextRequest) {
  // Auth: check CRON_SECRET
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hour = new Date().getUTCHours();
  const minute = new Date().getUTCMinutes();
  const started: string[] = [];

  try {
    // Always: Reddit monitoring
    await start(redditMonitorWorkflow, []);
    started.push("reddit-monitor");

    // At content hours: content generation
    if ([0, 6, 12, 18].includes(hour) && minute < 30) {
      await start(contentWorkflow, []);
      started.push("content-generation");
    }

    // At midnight: analytics pull
    if (hour === 0 && minute < 30) {
      await pullAnalytics();
      started.push("analytics-pull");
    }

    return NextResponse.json({ ok: true, started, hour, minute });
  } catch (err) {
    console.error("Marketing cron error:", err);
    return NextResponse.json({ ok: false, error: String(err), started }, { status: 500 });
  }
}

async function pullAnalytics() {
  // Get all published drafts with publish_results
  const published = await listDrafts("published");
  for (const draft of published) {
    if (!draft.publish_results) continue;
    const postIds: Record<string, string> = {};
    for (const r of draft.publish_results) {
      if (r.post_id) postIds[r.platform] = r.post_id;
    }
    if (Object.keys(postIds).length === 0) continue;
    try {
      const analytics = await getPostAnalytics(postIds);
      for (const [platform, data] of Object.entries(analytics)) {
        await upsertAnalytics(draft.id, platform, data);
      }
    } catch (e) {
      console.error(`Analytics pull failed for draft ${draft.id}:`, e);
    }
  }
}

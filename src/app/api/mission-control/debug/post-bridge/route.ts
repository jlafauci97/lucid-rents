import { NextResponse } from "next/server";
import { requireMissionControl } from "@/lib/mission-control/auth";
import { crossPostArticle } from "@/lib/news/post-bridge";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET() {
  try {
    await requireMissionControl();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const envReport = {
    hasToken: !!process.env.POST_BRIDGE_API_TOKEN,
    tokenLen: (process.env.POST_BRIDGE_API_TOKEN ?? "").length,
    twitterId: process.env.POST_BRIDGE_TWITTER_ACCOUNT_ID ?? null,
    pinterestId: process.env.POST_BRIDGE_PINTEREST_ACCOUNT_ID ?? null,
  };

  const result = await crossPostArticle({
    title: "Diagnostic: ignore me",
    excerpt: "This is a test from the debug endpoint — should never be visible on socials.",
    link: "https://lucidrents.com",
    imageUrl: null,
  });

  return NextResponse.json({ envReport, result }, {
    headers: { "Cache-Control": "no-store" },
  });
}

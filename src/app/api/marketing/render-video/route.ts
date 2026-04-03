import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300;

/**
 * POST /api/marketing/render-video
 * Remotion video rendering — disabled until @remotion/renderer is installed.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(
    { error: "Remotion rendering is not configured. Install @remotion/renderer to enable." },
    { status: 501 }
  );
}

import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";

export const maxDuration = 300;

const VALID_COMPOSITIONS = [
  "ViolationTimeline",
  "RentTrend",
  "LandlordPortfolio",
  "StatCounter",
  "NeighborhoodCompare",
] as const;

type CompositionId = (typeof VALID_COMPOSITIONS)[number];

/**
 * POST /api/marketing/render-video
 * Renders a Remotion composition to MP4 and uploads to Vercel Blob.
 * Called from WDK workflow step (durable, retryable).
 *
 * Body: { compositionId: string, inputProps: Record<string, unknown> }
 *
 * Uses @remotion/renderer for local/serverless rendering.
 * For production scale, swap to @remotion/lambda when deployed.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    compositionId: string;
    inputProps: Record<string, unknown>;
  };

  const { compositionId, inputProps } = body;

  if (!VALID_COMPOSITIONS.includes(compositionId as CompositionId)) {
    return NextResponse.json(
      { error: `Invalid compositionId. Valid: ${VALID_COMPOSITIONS.join(", ")}` },
      { status: 400 }
    );
  }

  const serveUrl = process.env.REMOTION_SERVE_URL;
  if (!serveUrl) {
    return NextResponse.json(
      { error: "Missing REMOTION_SERVE_URL env var" },
      { status: 500 }
    );
  }

  try {
    // Dynamic import to avoid bundling Remotion in all routes
    const { renderMedia, selectComposition } = await import("@remotion/renderer");
    const path = await import("path");
    const fs = await import("fs");
    const os = await import("os");

    const outputDir = os.tmpdir();
    const outputPath = path.join(outputDir, `${compositionId}-${Date.now()}.mp4`);

    const composition = await selectComposition({
      serveUrl,
      id: compositionId,
      inputProps,
    });

    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation: outputPath,
      inputProps,
    });

    // Upload rendered video to Vercel Blob
    const videoBuffer = fs.readFileSync(outputPath);
    const blob = await put(
      `marketing/videos/${compositionId}-${Date.now()}.mp4`,
      videoBuffer,
      { access: "public", contentType: "video/mp4" }
    );

    // Clean up temp file
    fs.unlinkSync(outputPath);

    return NextResponse.json({ ok: true, url: blob.url, compositionId });
  } catch (err) {
    console.error("Remotion render error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

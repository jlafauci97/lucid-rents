import { NextResponse } from "next/server";
import { head } from "@vercel/blob";

import { BLOB_PREFIX, isValidChunkName } from "@/lib/sitemap/generator";

export const runtime = "nodejs";
// Dynamic so each chunk request reads the current Blob version. The cron
// regenerates chunks (and the index) daily, and checkpointIndex() can rewrite
// index.xml multiple times during a single run — caching the route response
// for 24h would hide those mid-run updates and stale state on partial runs.
// We rely on the Cache-Control below for edge caching with a much shorter
// freshness window than the Blob's own cache.
export const dynamic = "force-dynamic";

// 1h fresh + 24h SWR. Worst-case staleness after a nightly cron run: 1h.
// Crawlers (Google) still get instant responses thanks to the SWR window.
const CACHE_CONTROL = "public, s-maxage=3600, stale-while-revalidate=86400";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ chunk: string }> },
) {
  const { chunk } = await params;

  if (!isValidChunkName(chunk)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const pathname = `${BLOB_PREFIX}/${chunk}`;

  try {
    // `head` returns the public Blob URL; we fetch from that URL to stream
    // the body back. Two-hop is unavoidable because @vercel/blob doesn't
    // expose a direct read stream — but the second hop is to Vercel's CDN
    // which is fast and locally cached after the first request.
    const meta = await head(pathname);
    const upstream = await fetch(meta.url);
    if (!upstream.ok || !upstream.body) {
      return new NextResponse("Not found", { status: 404 });
    }
    return new NextResponse(upstream.body, {
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": CACHE_CONTROL,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (
      message.includes("not found") ||
      message.toLowerCase().includes("not_found") ||
      message.includes("404")
    ) {
      return new NextResponse("Not found", { status: 404 });
    }
    console.error(`[sitemap-v2/${chunk}] error:`, err);
    return new NextResponse("Error", { status: 500 });
  }
}

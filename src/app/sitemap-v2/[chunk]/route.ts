import { NextResponse } from "next/server";
import { head } from "@vercel/blob";

import { BLOB_PREFIX, isValidChunkName } from "@/lib/sitemap/generator";

export const runtime = "nodejs";
export const dynamic = "force-static";
export const revalidate = 86400;

const CACHE_CONTROL = "public, s-maxage=86400, stale-while-revalidate=604800";

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

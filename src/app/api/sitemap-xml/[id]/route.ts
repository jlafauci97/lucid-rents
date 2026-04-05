import { NextResponse } from "next/server";

/**
 * Child sitemap — proxies the static XML file through a Vercel Function.
 * Google's sitemap crawler can't fetch Vercel static files directly.
 * The ?raw=1 param bypasses the rewrite to avoid infinite loops.
 */

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(req.url);

  try {
    const res = await fetch(`${url.origin}/sitemap/${id}.xml?raw=1`);
    if (!res.ok) {
      return new NextResponse("Not found", { status: 404 });
    }
    const xml = await res.text();
    return new NextResponse(xml, {
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}

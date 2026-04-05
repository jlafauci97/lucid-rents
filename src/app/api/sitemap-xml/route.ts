import { NextResponse } from "next/server";

/**
 * Sitemap index — proxies the static index XML through a Vercel Function.
 */

export async function GET(req: Request) {
  const url = new URL(req.url);

  try {
    const res = await fetch(`${url.origin}/sitemap.xml?raw=1`);
    if (!res.ok) throw new Error("fetch failed");
    const xml = await res.text();
    return new NextResponse(xml, {
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600",
      },
    });
  } catch {
    return new NextResponse("Error", { status: 500 });
  }
}

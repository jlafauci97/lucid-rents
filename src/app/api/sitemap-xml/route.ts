import { NextResponse } from "next/server";

/**
 * Sitemap index — proxies from Supabase Storage.
 */

const STORAGE_BASE =
  "https://okjehevpqvymuayyqkek.supabase.co/storage/v1/object/public/sitemaps";

export async function GET() {
  try {
    const res = await fetch(`${STORAGE_BASE}/index.xml`, {
      next: { revalidate: 86400 },
    });
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

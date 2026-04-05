import { NextResponse } from "next/server";

/**
 * Child sitemap — proxies from Supabase Storage.
 * Google's sitemap crawler can't reach Vercel static files, so we
 * fetch from Supabase Storage and serve through this Vercel Function.
 */

const STORAGE_BASE =
  "https://okjehevpqvymuayyqkek.supabase.co/storage/v1/object/public/sitemaps";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const res = await fetch(`${STORAGE_BASE}/${id}.xml`, {
      next: { revalidate: 86400 },
    });
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
    return new NextResponse("Error", { status: 500 });
  }
}

import { NextResponse } from "next/server";

const STORAGE_BASE =
  "https://okjehevpqvymuayyqkek.supabase.co/storage/v1/object/public/sitemaps";

const LANDLORD_LOC_RE = /\/sitemap\/l-\d+\.xml</;

export async function GET() {
  try {
    const res = await fetch(`${STORAGE_BASE}/index.xml`, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) throw new Error("fetch failed");
    const xml = await res.text();

    const blocks = xml.match(/<sitemap>[\s\S]*?<\/sitemap>/g) ?? [];
    const landlordBlocks = blocks.filter((b) => LANDLORD_LOC_RE.test(b));

    const body =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      landlordBlocks.map((b) => "  " + b).join("\n") +
      "\n</sitemapindex>\n";

    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control":
          "public, s-maxage=86400, stale-while-revalidate=3600",
      },
    });
  } catch {
    return new NextResponse("Error", { status: 500 });
  }
}

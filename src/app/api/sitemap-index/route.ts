import { NextResponse } from "next/server";

const BASE_URL = "https://lucidrents.com";
const BUILDINGS_PER_SITEMAP = 25000;

/**
 * Sitemap index: /sitemap.xml
 * Returns an XML sitemap index pointing to all sub-sitemaps.
 * Sitemap 0 = static pages, sitemaps 1+ = buildings in batches.
 */
export async function GET() {
  let totalBuildings = 750000;

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/buildings?select=id&limit=1&offset=0`,
      {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          Prefer: "count=exact",
        },
        next: { revalidate: 21600 },
      }
    );
    const countHeader = res.headers.get("content-range");
    if (countHeader) {
      totalBuildings = parseInt(countHeader.split("/")[1] || "750000", 10);
    }
  } catch {
    // Fall back to estimate
  }

  const buildingSitemapCount = Math.ceil(totalBuildings / BUILDINGS_PER_SITEMAP);
  const totalSitemaps = 1 + buildingSitemapCount; // 0 = static, 1+ = buildings

  const now = new Date().toISOString();
  const sitemapEntries = Array.from({ length: totalSitemaps }, (_, i) =>
    `  <sitemap>
    <loc>${BASE_URL}/sitemap/${i}.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>`
  ).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries}
</sitemapindex>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=3600",
    },
  });
}

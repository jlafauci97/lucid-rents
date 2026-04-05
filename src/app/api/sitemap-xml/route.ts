import { NextResponse } from "next/server";

/**
 * Sitemap index — lists all child sitemaps.
 * Served at /sitemap.xml via rewrite in next.config.ts.
 */

// 80 building sitemaps + 20 landlord sitemaps + 1 static = 101
const BUILDING_SITEMAPS = 80;
const LANDLORD_SITEMAPS = 20;
const TOTAL = 1 + BUILDING_SITEMAPS + LANDLORD_SITEMAPS;

export async function GET() {
  const now = new Date().toISOString();
  const entries = Array.from({ length: TOTAL }, (_, i) =>
    `  <sitemap>\n    <loc>https://lucidrents.com/sitemap/${i}.xml</loc>\n    <lastmod>${now}</lastmod>\n  </sitemap>`
  ).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</sitemapindex>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600",
    },
  });
}

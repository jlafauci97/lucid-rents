import { NextResponse } from "next/server";

const BASE_URL = "https://lucidrents.com";
const ITEMS_PER_SITEMAP = 10000;

/**
 * Sitemap index: /sitemap.xml
 * Returns an XML sitemap index pointing to all sub-sitemaps.
 * Sitemap 0 = static pages (neighborhoods, crime, transit, news)
 * Sitemaps 1..L = landlords in batches of 10,000
 * Sitemaps L+1..L+B = buildings in batches of 10,000
 */
export async function GET() {
  let totalLandlords = 0;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  let buildingIdRange = 0;

  try {
    // Fetch building min/max id and landlord count in parallel.
    // Building sitemaps use id-range batching (not row count) because OFFSET
    // queries time out on Supabase for large tables.
    const [buildingMinRes, buildingMaxRes, landlordRes] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/buildings?select=id&order=id.asc&limit=1`, {
        headers: { apikey: supabaseKey },
        next: { revalidate: 21600 },
      }),
      fetch(`${supabaseUrl}/rest/v1/buildings?select=id&order=id.desc&limit=1`, {
        headers: { apikey: supabaseKey },
        next: { revalidate: 21600 },
      }),
      fetch(`${supabaseUrl}/rest/v1/landlord_stats?select=name&limit=1&offset=0`, {
        headers: { apikey: supabaseKey, Prefer: "count=estimated" },
        next: { revalidate: 21600 },
      }),
    ]);

    const [minRows, maxRows] = await Promise.all([
      buildingMinRes.json() as Promise<{ id: string }[]>,
      buildingMaxRes.json() as Promise<{ id: string }[]>,
    ]);
    if (minRows?.[0] && maxRows?.[0]) {
      const minId = parseInt(minRows[0].id, 10);
      const maxId = parseInt(maxRows[0].id, 10);
      buildingIdRange = maxId - minId + 1;
    }

    const lCount = landlordRes.headers.get("content-range");
    if (lCount) totalLandlords = parseInt(lCount.split("/")[1] || "0", 10);
  } catch {
    // If DB is unreachable, only emit the static sitemap (id=0)
  }

  const landlordSitemapCount = Math.ceil(totalLandlords / ITEMS_PER_SITEMAP);
  const buildingSitemapCount = Math.ceil(buildingIdRange / ITEMS_PER_SITEMAP);
  const totalSitemaps = 1 + landlordSitemapCount + buildingSitemapCount;

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

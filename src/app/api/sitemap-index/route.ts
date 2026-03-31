import { NextResponse } from "next/server";

const BASE_URL = "https://lucidrents.com";
const ITEMS_PER_SITEMAP = 10000;

/**
 * Sitemap index: /sitemap.xml
 *
 * Layout:
 *   /sitemap/0.xml         → static pages
 *   /sitemap/l-0.xml       → landlord batch 0 (first 10K)
 *   /sitemap/l-1.xml       → landlord batch 1
 *   ...
 *   /sitemap/b-0.xml       → building batch 0
 *   /sitemap/b-1.xml       → building batch 1
 *   ...
 *
 * The l- / b- prefix tells the child handler whether to query
 * landlords or buildings, eliminating the need for a count query
 * that can return different values per request.
 */
export async function GET() {
  let totalBuildings = 0;
  let totalLandlords = 0;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  try {
    const [buildingRes, landlordRes] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/buildings?select=id&limit=1&offset=0`, {
        headers: { apikey: supabaseKey, Prefer: "count=estimated" },
        cache: "no-store",
      }),
      fetch(`${supabaseUrl}/rest/v1/landlord_stats?select=name&limit=1&offset=0`, {
        headers: { apikey: supabaseKey, Prefer: "count=estimated" },
        cache: "no-store",
      }),
    ]);

    const bCount = buildingRes.headers.get("content-range");
    if (bCount) totalBuildings = parseInt(bCount.split("/")[1] || "0", 10);

    const lCount = landlordRes.headers.get("content-range");
    if (lCount) totalLandlords = parseInt(lCount.split("/")[1] || "0", 10);
  } catch {
    // If DB is unreachable, only emit the static sitemap
  }

  const landlordSitemapCount = Math.ceil(totalLandlords / ITEMS_PER_SITEMAP);
  const buildingSitemapCount = Math.ceil(totalBuildings / ITEMS_PER_SITEMAP);

  const now = new Date().toISOString();
  const entries: string[] = [];

  // Static sitemap
  entries.push(`  <sitemap>
    <loc>${BASE_URL}/sitemap/0.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>`);

  // Landlord sitemaps: l-0, l-1, ...
  for (let i = 0; i < landlordSitemapCount; i++) {
    entries.push(`  <sitemap>
    <loc>${BASE_URL}/sitemap/l-${i}.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>`);
  }

  // Building sitemaps: b-0, b-1, ...
  for (let i = 0; i < buildingSitemapCount; i++) {
    entries.push(`  <sitemap>
    <loc>${BASE_URL}/sitemap/b-${i}.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</sitemapindex>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=3600",
    },
  });
}

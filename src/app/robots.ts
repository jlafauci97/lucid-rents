import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

const BUILDINGS_PER_SITEMAP = 45000;

export default async function robots(): Promise<MetadataRoute.Robots> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/buildings?select=id&limit=1&offset=0`,
    {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        Prefer: "count=exact",
      },
    }
  );

  const countHeader = res.headers.get("content-range");
  const totalBuildings = countHeader
    ? parseInt(countHeader.split("/")[1] || "0", 10)
    : 50000;

  const sitemapCount = 1 + Math.ceil(totalBuildings / BUILDINGS_PER_SITEMAP);

  const sitemaps: string[] = [];
  for (let i = 0; i < sitemapCount; i++) {
    sitemaps.push(`https://lucidrents.com/sitemap/${i}.xml`);
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/dashboard/", "/review/new"],
    },
    sitemap: sitemaps,
  };
}

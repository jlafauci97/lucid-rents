import type { MetadataRoute } from "next";

// Keep this in sync with generateSitemaps() in sitemap.ts.
// Estimated: 1 static + ceil(buildings / 45000) building sitemaps.
const SITEMAP_COUNT = 16;

export default function robots(): MetadataRoute.Robots {
  const sitemaps: string[] = [];
  for (let i = 0; i < SITEMAP_COUNT; i++) {
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

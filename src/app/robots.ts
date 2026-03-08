import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  // List individual sitemaps since the auto-generated index at /sitemap.xml
  // isn't working reliably in this Next.js version
  const sitemaps: string[] = [];
  for (let i = 0; i <= 15; i++) {
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

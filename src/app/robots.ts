import type { MetadataRoute } from "next";


export default function robots(): MetadataRoute.Robots {
  // VERCEL_ENV is "production" | "preview" | "development" on Vercel deployments.
  // Locally it's unset, so we allow crawling (harmless — middleware adds noindex on non-prod hosts).
  const vercelEnv = process.env.VERCEL_ENV;
  const isProduction = !vercelEnv || vercelEnv === "production";

  // Block all crawlers on preview / development deployments
  if (!isProduction) {
    return {
      rules: { userAgent: "*", disallow: "/" },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/profile/",
        "/review/new",      // legacy non-prefixed path
        "/*/review/new",    // city-prefixed review pages (e.g. /nyc/review/new?building=...)
        "/_next/static/media/",
        "/*?ids=",          // compare pages with building IDs
        "/compare",         // non-city-prefixed compare (redirects)
        "/building/",       // non-city-prefixed building pages (redirects)
      ],
    },
    sitemap: "https://lucidrents.com/sitemap.xml",
  };
}

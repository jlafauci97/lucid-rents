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

  const sharedDisallow = [
    "/api/",             // all API endpoints (sitemap API is accessed via /sitemap/*.xml rewrites)
    "/_next/",          // static JS/CSS chunks
    "/profile/",
    "/review/new",      // legacy non-prefixed path
    "/*/review/new",    // city-prefixed review pages (e.g. /nyc/review/new?building=...)
    "/*?ids=",          // compare pages with building IDs
    "/compare",         // non-city-prefixed compare (redirects)
  ];

  return {
    rules: [
      // Default rule for all crawlers
      {
        userAgent: "*",
        allow: "/",
        disallow: sharedDisallow,
      },
      // Explicitly welcome AI crawlers for LLM search / recommendations
      ...([
        "GPTBot",
        "ChatGPT-User",
        "Google-Extended",
        "GoogleOther",
        "PerplexityBot",
        "ClaudeBot",
        "Claude-Web",
        "Applebot-Extended",
        "cohere-ai",
        "Bytespider",
        "CCBot",
        "anthropic-ai",
        "OAI-SearchBot",
      ] as const).map((bot) => ({
        userAgent: bot,
        allow: ["/", "/llms.txt", "/llms-full.txt", "/for-ai"],
        disallow: sharedDisallow,
      })),
    ],
    sitemap: "https://lucidrents.com/sitemap.xml",
  };
}

// Note: llms.txt files are served at:
// - https://lucidrents.com/llms.txt (concise overview for AI systems)
// - https://lucidrents.com/llms-full.txt (detailed reference for AI systems)

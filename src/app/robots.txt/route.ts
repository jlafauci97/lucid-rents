import { NextResponse } from "next/server";

export const revalidate = 86400;

/**
 * Custom robots.txt route (replaces the typed src/app/robots.ts metadata
 * file): Next's MetadataRoute.Robots can't emit Content-Signal lines, which
 * Cloudflare's Agent Readiness "Content Signals" check looks for.
 *
 * Content-Signal (contentsignals.org): machine-readable usage preferences.
 *   search=yes    — index and link to us (the whole point of the site)
 *   ai-input=yes  — AI assistants may ground answers in our content and cite
 *                   us; AI answer traffic is real (3K retrievals/day measured
 *                   in Cloudflare AI Crawl Control, Aug 2026) and citations
 *                   are the discovery channel we optimize for.
 *   ai-train      — deliberately unstated: no preference expressed either
 *                   way. Set explicitly if a policy decision is made.
 */
const PRODUCTION_BODY = `# Content signals for automated systems (contentsignals.org)
Content-Signal: search=yes, ai-input=yes

User-Agent: *
Allow: /
Disallow: /api/
Disallow: /_next/
Disallow: /profile/
Disallow: /review/new
Disallow: /*/review/new
Disallow: /*?ids=
Disallow: /compare
Disallow: /*?sort=
Disallow: /mission-control/
Disallow: /mock/

Sitemap: https://lucidrents.com/sitemap.xml
Sitemap: https://lucidrents.com/buildings-sitemap.xml
Sitemap: https://lucidrents.com/sitemap-landlords.xml

# AI-readable site overviews:
# https://lucidrents.com/llms.txt
# https://lucidrents.com/llms-full.txt
`;

const NON_PRODUCTION_BODY = `User-Agent: *
Disallow: /
`;

export function GET() {
  // VERCEL_ENV is "production" | "preview" | "development" on Vercel
  // deployments. Locally it's unset, so we allow crawling (harmless —
  // the proxy adds noindex on non-prod hosts).
  const vercelEnv = process.env.VERCEL_ENV;
  const isProduction = !vercelEnv || vercelEnv === "production";
  return new NextResponse(isProduction ? PRODUCTION_BODY : NON_PRODUCTION_BODY, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

import { NextResponse } from "next/server";

import { BUILDING_PAGE_VERSION_AT } from "@/lib/sitemap/generator";
import manifest from "@/lib/sitemap/chunk-manifest.json";

/**
 * Dedicated building sitemap index — the buildings counterpart to
 * /sitemap-landlords.xml. Enumerates the static `b-N.xml` chunk files in
 * `public/sitemap/` so Google has a clean, self-contained index for the
 * ~2.5M building pages. The two routes are intentionally identical.
 *
 * Chunk count comes from a build-time manifest, not a live DB COUNT. A
 * COUNT over the ~2.68M-row buildings table (`slug IS NOT NULL AND borough
 * IS NOT NULL`) has no supporting index and times out, which would surface
 * as "Sitemap could not be read / HTTP 500" in Search Console. The chunk
 * files are produced at build time by scripts/generate-sitemaps.mjs, which
 * already knows exactly how many it wrote — so it records the count in
 * chunk-manifest.json and we read that constant here. No runtime DB query,
 * no filesystem readdir (which once bundled the entire 635 MB public/sitemap
 * dir into the function), and the count is always exactly the number of
 * files that exist (zero trailing-404 drift). The landlord index uses this
 * same manifest.
 *
 * lastmod: every chunk entry is stamped with BUILDING_PAGE_VERSION_AT — the
 * same template-version floor the chunk generator applies to every building
 * URL. Bumping that constant (on a site-wide building-page change) bumps the
 * index lastmod too, signalling Google to re-crawl.
 */

const BASE_URL = "https://lucidrents.com";

export const revalidate = 86400; // 24h — output only depends on a build-time constant

export function GET() {
  const chunkCount = manifest.buildingChunks;

  const blocks: string[] = [];
  for (let i = 0; i < chunkCount; i++) {
    blocks.push(
      `  <sitemap>\n    <loc>${BASE_URL}/sitemap/b-${i}.xml</loc>\n    <lastmod>${BUILDING_PAGE_VERSION_AT}</lastmod>\n  </sitemap>`,
    );
  }

  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    blocks.join("\n") +
    "\n</sitemapindex>\n";

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600",
    },
  });
}

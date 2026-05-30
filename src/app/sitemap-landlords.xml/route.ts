import { NextResponse } from "next/server";

import { LANDLORD_PAGE_VERSION_AT } from "@/lib/sitemap/generator";
import manifest from "@/lib/sitemap/chunk-manifest.json";

/**
 * Dedicated landlord sitemap index — the landlords counterpart to
 * /sitemap-buildings.xml. Enumerates the static `l-N.xml` chunk files in
 * `public/sitemap/`. The two routes are intentionally identical.
 *
 * Chunk count comes from the build-time manifest (written by
 * scripts/generate-sitemaps.mjs, which knows exactly how many files it wrote)
 * rather than a live DB COUNT. This makes the count exactly match the files
 * that exist (no trailing-404 drift), removes the runtime DB dependency, and
 * keeps this in lockstep with the building index.
 *
 * History: a previous version ran `SELECT COUNT(*) FROM landlord_stats WHERE
 * building_count > 0` (kept fast only by a dedicated partial index) plus a
 * `landlord_sitemap_chunk_lastmods` RPC for per-chunk lastmods. Both are now
 * unused by this route — the partial index (idx_landlord_stats_with_buildings)
 * and the RPC can be dropped.
 *
 * lastmod: every chunk entry is stamped with LANDLORD_PAGE_VERSION_AT — the
 * landlord counterpart to BUILDING_PAGE_VERSION_AT. (The master /sitemap.xml
 * already used a single shared date for l-N.xml entries, so this is no real
 * loss of granularity.)
 */

const BASE_URL = "https://lucidrents.com";

export const revalidate = 86400; // 24h — output only depends on a build-time constant

export function GET() {
  const chunkCount = manifest.landlordChunks;

  const blocks: string[] = [];
  for (let i = 0; i < chunkCount; i++) {
    blocks.push(
      `  <sitemap>\n    <loc>${BASE_URL}/sitemap/l-${i}.xml</loc>\n    <lastmod>${LANDLORD_PAGE_VERSION_AT}</lastmod>\n  </sitemap>`,
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

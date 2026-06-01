import { NextResponse } from "next/server";

import {
  BASE_URL,
  buildSitemapXml,
  generateStaticSitemap,
  generateHubsSitemap,
} from "@/lib/sitemap/generator";

/**
 * Dynamic hubs sitemap. Served at /sitemap/hubs.xml via a next.config rewrite
 * (`/sitemap/hubs.xml` → `/sitemap-hubs.xml`), which the master sitemap index
 * already lists.
 *
 * Why dynamic: the building/landlord chunks are huge and stable, so they stay
 * static. But the hubs sitemap also carries our published news articles, which
 * change frequently. Generating it on an hourly ISR window means every newly
 * published article (auto_generated=true, status=published) appears in the
 * sitemap within the hour — automatically — without a full sitemap regen or a
 * cron. generateStaticSitemap() already filters to our own published articles
 * and city-prefixes each by its metro.
 */

export const runtime = "nodejs";
export const revalidate = 3600; // 1h — new published articles appear within the hour

export async function GET() {
  try {
    const [staticEntries, hubsEntries] = await Promise.all([
      generateStaticSitemap(),
      generateHubsSitemap(),
    ]);
    const xml = buildSitemapXml([...staticEntries, ...hubsEntries]);
    return new NextResponse(xml, {
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    // Never hard-fail this sitemap chunk. ISR will serve the last good copy on
    // revalidation errors; on a cold miss, return a minimal valid sitemap.
    console.error("[sitemap-hubs] generation failed:", err);
    const fallback = buildSitemapXml([
      { url: `${BASE_URL}/`, changefreq: "daily", priority: 1.0 },
    ]);
    return new NextResponse(fallback, {
      status: 200,
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
      },
    });
  }
}

import { NextResponse } from "next/server";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

/**
 * Landlord sitemap index. Reads the landlord chunk files directly from the
 * deployed `public/sitemap/` directory rather than the legacy index.xml in
 * Supabase storage — that index was getting stale (last refresh April 2)
 * and was hiding ~32 landlord chunks (~320K URLs) from Google because the
 * upload step never happened. The chunk files themselves are deployed via
 * Vercel as static assets, so we list whatever's actually deployed.
 */

const SITEMAP_DIR = join(process.cwd(), "public", "sitemap");
const BASE_URL = "https://lucidrents.com";

export const revalidate = 86400; // 24h ISR

export async function GET() {
  try {
    const files = await readdir(SITEMAP_DIR);
    const landlordFiles = files
      .filter((f) => /^l-\d+\.xml$/.test(f))
      .sort((a, b) => {
        const na = parseInt(a.match(/\d+/)?.[0] ?? "0", 10);
        const nb = parseInt(b.match(/\d+/)?.[0] ?? "0", 10);
        return na - nb;
      });

    const blocks = await Promise.all(
      landlordFiles.map(async (f) => {
        let lastmod = new Date().toISOString();
        try {
          const s = await stat(join(SITEMAP_DIR, f));
          lastmod = s.mtime.toISOString();
        } catch {
          // ignore — fall back to current time
        }
        return `  <sitemap>\n    <loc>${BASE_URL}/sitemap/${f}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </sitemap>`;
      })
    );

    const body =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      blocks.join("\n") +
      "\n</sitemapindex>\n";

    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control":
          "public, s-maxage=86400, stale-while-revalidate=3600",
      },
    });
  } catch {
    return new NextResponse("Error", { status: 500 });
  }
}

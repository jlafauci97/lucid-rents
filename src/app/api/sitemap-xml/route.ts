import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Sitemap index — reads the static index and serves it.
 * Served at /sitemap.xml via rewrite in next.config.ts.
 * The index references /sitemap/0.xml, /sitemap/l-0.xml, /sitemap/b-0.xml, etc.
 */

export async function GET() {
  const indexPath = join(process.cwd(), "public", "sitemap", "index.xml");
  let xml: string;
  try {
    xml = readFileSync(indexPath, "utf-8");
  } catch {
    // Fallback: read public/sitemap.xml if index.xml doesn't exist
    xml = readFileSync(join(process.cwd(), "public", "sitemap.xml"), "utf-8");
  }

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600",
    },
  });
}

import { NextResponse } from "next/server";
import { join } from "path";

/**
 * Sitemap index — reads the static index XML and serves it via API route.
 * Uses dynamic require to avoid Vercel file tracing bundling 627MB of XML.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require("fs") as typeof import("fs");

export async function GET() {
  const indexPath = join(process.cwd(), "public", "sitemap", "index.xml");
  let xml: string;
  try {
    xml = fs.readFileSync(indexPath, "utf-8");
  } catch {
    xml = fs.readFileSync(join(process.cwd(), "public", "sitemap.xml"), "utf-8");
  }

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600",
    },
  });
}

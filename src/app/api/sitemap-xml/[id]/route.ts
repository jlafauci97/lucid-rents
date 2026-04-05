import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Child sitemap — reads the static XML file and serves it via API route.
 * Served at /sitemap/:id.xml via rewrite in next.config.ts.
 * This bypasses Vercel's static file serving which Google can't reach.
 */

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const filePath = join(process.cwd(), "public", "sitemap", `${id}.xml`);

  try {
    const xml = readFileSync(filePath, "utf-8");
    return new NextResponse(xml, {
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}

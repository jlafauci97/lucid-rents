import { NextResponse } from "next/server";
import { join } from "path";

/**
 * Child sitemap — reads the static XML file and serves it via API route.
 * Uses dynamic require to avoid Vercel file tracing bundling 627MB of XML.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require("fs") as typeof import("fs");

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const filePath = join(process.cwd(), "public", "sitemap", `${id}.xml`);

  try {
    const xml = fs.readFileSync(filePath, "utf-8");
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

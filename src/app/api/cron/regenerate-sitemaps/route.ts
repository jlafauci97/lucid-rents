import { NextResponse, type NextRequest } from "next/server";

import { regenerateAllToBlob } from "@/lib/sitemap/generator";

// Sitemap regeneration paginates through every building (~600K rows) and
// every landlord with at least one building. Pin Node runtime + max function
// duration to the Vercel cron ceiling. Idempotent: each chunk is written
// with `allowOverwrite: true`, so running this twice in a row is safe.
export const runtime = "nodejs";
export const maxDuration = 800;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await regenerateAllToBlob();
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (err) {
    console.error("[cron/regenerate-sitemaps] failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

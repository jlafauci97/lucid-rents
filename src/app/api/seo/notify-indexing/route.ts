import { NextRequest, NextResponse } from "next/server";
import { notifyGoogleIndexing, batchNotifyGoogleIndexing } from "@/lib/google-indexing";
import { notifyIndexNow } from "@/lib/indexnow";

/**
 * POST /api/seo/notify-indexing
 *
 * Notify Google (Indexing API) and Bing/Yandex (IndexNow) about new or updated URLs.
 * Protected by a shared secret (CRON_SECRET).
 *
 * Body: { urls: string[], type?: "URL_UPDATED" | "URL_DELETED" }
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    urls?: string[];
    type?: "URL_UPDATED" | "URL_DELETED";
  };

  const urls = body.urls ?? [];
  const type = body.type ?? "URL_UPDATED";

  if (urls.length === 0) {
    return NextResponse.json({ error: "No URLs provided" }, { status: 400 });
  }

  const results: Record<string, unknown> = {};

  // Google Indexing API (batch for multiple, single for one)
  try {
    if (urls.length === 1) {
      const res = await notifyGoogleIndexing(urls[0], type);
      results.google = { submitted: 1, ok: res.ok, status: res.status };
    } else {
      results.google = await batchNotifyGoogleIndexing(urls, type);
    }
  } catch (err) {
    results.google = {
      error: err instanceof Error ? err.message : String(err),
    };
  }

  // IndexNow (Bing, Yandex, Naver) — only for updates, not deletions
  if (type === "URL_UPDATED") {
    try {
      await notifyIndexNow(urls);
      results.indexNow = { submitted: Math.min(urls.length, 10000) };
    } catch (err) {
      results.indexNow = {
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return NextResponse.json({ ok: true, urls: urls.length, results });
}

"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { CITY_META, isValidCity, type City } from "@/lib/cities";
import { requireMissionControl } from "@/lib/mission-control/auth";
import { crossPostArticle } from "@/lib/news/post-bridge";

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function approveDraft(id: string) {
  await requireMissionControl();
  const db = adminDb();

  const { data: draft, error: fetchErr } = await db
    .from("news_articles")
    .select("metro, title, excerpt, slug, image_url, signal_metadata")
    .eq("id", id)
    .single();
  if (fetchErr || !draft) throw new Error(`Draft not found: ${id}`);

  const { error } = await db
    .from("news_articles")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/mission-control/news-drafts");
  if (draft.metro && isValidCity(draft.metro)) {
    const prefix = CITY_META[draft.metro as City].urlPrefix;
    revalidatePath(`/${prefix}`);
    revalidatePath(`/${prefix}/news`);

    // Fire Post Bridge after the response is sent — avoids blocking the UI.
    const link = `https://lucidrents.com/${prefix}/news/${draft.slug}`;
    const meta = draft.signal_metadata as { hashtags?: unknown } | null;
    const hashtags = Array.isArray(meta?.hashtags)
      ? (meta!.hashtags as unknown[]).filter((t): t is string => typeof t === "string")
      : [];
    after(async () => {
      const result = await crossPostArticle({
        title: draft.title,
        excerpt: draft.excerpt,
        link,
        imageUrl: draft.image_url,
        hashtags,
      });
      if (!result.ok && result.reason === "api_error") {
        console.error("[post-bridge] cross-post failed:", result.detail);
      }
    });
  }

  redirect("/mission-control/news-drafts?tab=approved");
}

export async function rejectDraft(id: string) {
  await requireMissionControl();
  const db = adminDb();
  const { error } = await db
    .from("news_articles")
    .update({ status: "rejected" })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/mission-control/news-drafts");
  redirect("/mission-control/news-drafts?tab=rejected");
}

export async function editDraftBody(id: string, body: string) {
  await requireMissionControl();
  const db = adminDb();
  const { error } = await db
    .from("news_articles")
    .update({ body })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/mission-control/news-drafts");
}

const MAX_BULK = 20;

export async function approveDrafts(
  ids: string[]
): Promise<{ approved: number; skipped: number }> {
  await requireMissionControl();
  if (ids.length === 0) return { approved: 0, skipped: 0 };
  if (ids.length > MAX_BULK) {
    throw new Error(`Too many drafts (${ids.length}); max ${MAX_BULK} per batch.`);
  }
  const db = adminDb();

  const { data: drafts, error: fetchErr } = await db
    .from("news_articles")
    .select("id, metro, title, excerpt, slug, image_url, signal_metadata")
    .in("id", ids)
    .eq("status", "draft")
    .eq("auto_generated", true);
  if (fetchErr) throw new Error(fetchErr.message);
  if (!drafts || drafts.length === 0) return { approved: 0, skipped: ids.length };

  const foundIds = drafts.map((d) => d.id as string);
  const publishedAt = new Date().toISOString();
  const { error } = await db
    .from("news_articles")
    .update({ status: "published", published_at: publishedAt })
    .in("id", foundIds);
  if (error) throw new Error(error.message);

  revalidatePath("/mission-control/news-drafts");
  const metros = new Set<string>();
  for (const d of drafts) {
    if (d.metro && isValidCity(d.metro)) metros.add(d.metro);
  }
  for (const m of metros) {
    const prefix = CITY_META[m as City].urlPrefix;
    revalidatePath(`/${prefix}`);
    revalidatePath(`/${prefix}/news`);
  }

  after(async () => {
    for (const draft of drafts) {
      if (!draft.metro || !isValidCity(draft.metro)) continue;
      const prefix = CITY_META[draft.metro as City].urlPrefix;
      const link = `https://lucidrents.com/${prefix}/news/${draft.slug}`;
      const meta = draft.signal_metadata as { hashtags?: unknown } | null;
      const hashtags = Array.isArray(meta?.hashtags)
        ? (meta!.hashtags as unknown[]).filter(
            (t): t is string => typeof t === "string"
          )
        : [];
      const result = await crossPostArticle({
        title: draft.title,
        excerpt: draft.excerpt,
        link,
        imageUrl: draft.image_url,
        hashtags,
      });
      if (!result.ok && result.reason === "api_error") {
        console.error("[post-bridge] cross-post failed:", result.detail);
      }
    }
  });

  return { approved: foundIds.length, skipped: ids.length - foundIds.length };
}

export async function rejectDrafts(
  ids: string[]
): Promise<{ rejected: number }> {
  await requireMissionControl();
  if (ids.length === 0) return { rejected: 0 };
  if (ids.length > MAX_BULK) {
    throw new Error(`Too many drafts (${ids.length}); max ${MAX_BULK} per batch.`);
  }
  const db = adminDb();
  const { data, error } = await db
    .from("news_articles")
    .update({ status: "rejected" })
    .in("id", ids)
    .eq("status", "draft")
    .eq("auto_generated", true)
    .select("id");
  if (error) throw new Error(error.message);
  revalidatePath("/mission-control/news-drafts");
  return { rejected: data?.length ?? 0 };
}

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
    .select("metro, title, excerpt, slug, image_url")
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
    after(async () => {
      const result = await crossPostArticle({
        title: draft.title,
        excerpt: draft.excerpt,
        link,
        imageUrl: draft.image_url,
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

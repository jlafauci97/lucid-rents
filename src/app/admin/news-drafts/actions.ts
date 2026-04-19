"use server";

import { revalidatePath } from "next/cache";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { CITY_META, isValidCity, type City } from "@/lib/cities";

async function assertAdmin() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const allowed = process.env.ADMIN_EMAIL;
  if (allowed && user.email?.toLowerCase() !== allowed.toLowerCase()) {
    throw new Error("Forbidden");
  }
  return user;
}

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function approveDraft(id: string) {
  await assertAdmin();
  const db = adminDb();

  const { data: draft, error: fetchErr } = await db
    .from("news_articles")
    .select("metro")
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

  revalidatePath("/admin/news-drafts");
  if (draft.metro && isValidCity(draft.metro)) {
    const prefix = CITY_META[draft.metro as City].urlPrefix;
    revalidatePath(`/${prefix}`);
    revalidatePath(`/${prefix}/news`);
  }
}

export async function rejectDraft(id: string) {
  await assertAdmin();
  const db = adminDb();
  const { error } = await db.from("news_articles").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/news-drafts");
}

export async function editDraftBody(id: string, body: string) {
  await assertAdmin();
  const db = adminDb();
  const { error } = await db
    .from("news_articles")
    .update({ body })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/news-drafts");
}

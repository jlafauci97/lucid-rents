import { createClient } from "@supabase/supabase-js";

export interface HubStats {
  newsDraftsPending: number;
  reviewsLast24h: number;
  reviewsFlagged: number;
  usersTotal: number;
  usersNewLast7d: number;
  marketingDraftsPending: number;
}

const ISO_7D_AGO = () => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
const ISO_24H_AGO = () => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

export async function getHubStats(): Promise<HubStats> {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const [
    newsDrafts,
    reviewsRecent,
    reviewsFlagged,
    usersTotal,
    usersNew,
    marketingDrafts,
  ] = await Promise.all([
    admin
      .from("news_articles")
      .select("id", { count: "exact", head: true })
      .eq("status", "draft")
      .eq("auto_generated", true),
    admin
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .gte("created_at", ISO_24H_AGO()),
    admin
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("status", "flagged"),
    admin
      .from("user_profiles")
      .select("user_id", { count: "exact", head: true })
      .is("deleted_at", null),
    admin
      .from("user_profiles")
      .select("user_id", { count: "exact", head: true })
      .is("deleted_at", null)
      .gte("created_at", ISO_7D_AGO()),
    admin
      .from("marketing_drafts")
      .select("id", { count: "exact", head: true })
      .in("status", ["draft", "generating"]),
  ]);

  return {
    newsDraftsPending: newsDrafts.count ?? 0,
    reviewsLast24h: reviewsRecent.count ?? 0,
    reviewsFlagged: reviewsFlagged.count ?? 0,
    usersTotal: usersTotal.count ?? 0,
    usersNewLast7d: usersNew.count ?? 0,
    marketingDraftsPending: marketingDrafts.count ?? 0,
  };
}

import { createAdminClient } from "@/lib/supabase/admin";
import type {
  MarketingDraft,
  MarketingDraftStatus,
  MarketingContentType,
  MarketingVideoType,
  MarketingRedditThread,
  MarketingRedditStatus,
  PlatformVariants,
  PublishResult,
} from "@/types/marketing";

// ===== DRAFTS =====

/** Insert a new draft with status='generating'. Called at workflow start. */
export async function createDraft(data: {
  workflowRunId: string;
  contentType: MarketingContentType;
  videoType?: MarketingVideoType;
}): Promise<MarketingDraft> {
  const supabase = createAdminClient();
  const { data: row, error } = await supabase
    .from("marketing_drafts")
    .insert({
      workflow_run_id: data.workflowRunId,
      content_type: data.contentType,
      video_type: data.videoType ?? "none",
      status: "generating",
    })
    .select()
    .single();

  if (error) throw error;
  return row as MarketingDraft;
}

/** Partial update on a draft row. */
export async function updateDraft(
  id: string,
  data: {
    status?: MarketingDraftStatus;
    hookToken?: string;
    caption?: string;
    platformVariants?: PlatformVariants;
    mediaUrls?: string[];
    videoType?: MarketingVideoType;
    sourceData?: Record<string, unknown>;
    errorMessage?: string;
    publishedAt?: string;
    publishResults?: PublishResult[];
  }
): Promise<void> {
  const supabase = createAdminClient();

  const patch: Record<string, unknown> = {};
  if (data.status !== undefined) patch.status = data.status;
  if (data.hookToken !== undefined) patch.hook_token = data.hookToken;
  if (data.caption !== undefined) patch.caption = data.caption;
  if (data.platformVariants !== undefined) patch.platform_variants = data.platformVariants;
  if (data.mediaUrls !== undefined) patch.media_urls = data.mediaUrls;
  if (data.videoType !== undefined) patch.video_type = data.videoType;
  if (data.sourceData !== undefined) patch.source_data = data.sourceData;
  if (data.errorMessage !== undefined) patch.error_message = data.errorMessage;
  if (data.publishedAt !== undefined) patch.published_at = data.publishedAt;
  if (data.publishResults !== undefined) patch.publish_results = data.publishResults;

  const { error } = await supabase
    .from("marketing_drafts")
    .update(patch)
    .eq("id", id);

  if (error) throw error;
}

/** Delete all drafts with status='failed'. */
export async function clearFailedDrafts(): Promise<number> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("marketing_drafts")
    .delete()
    .eq("status", "failed")
    .select("id");

  if (error) throw error;
  return data?.length ?? 0;
}

/** Get a single draft by ID. */
export async function getDraft(id: string): Promise<MarketingDraft | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("marketing_drafts")
    .select()
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // row not found
    throw error;
  }
  return data as MarketingDraft;
}

/** List drafts, optionally filtered by status. Ordered by created_at desc. */
export async function listDrafts(
  status?: MarketingDraftStatus,
  limit?: number
): Promise<MarketingDraft[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("marketing_drafts")
    .select()
    .order("created_at", { ascending: false });

  if (status !== undefined) {
    query = query.eq("status", status);
  }
  if (limit !== undefined) {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as MarketingDraft[];
}

/** Get content types used in the last N days (for rotation logic). */
export async function getRecentContentTypes(
  days: number
): Promise<MarketingContentType[]> {
  const supabase = createAdminClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("marketing_drafts")
    .select("content_type")
    .gte("created_at", since);

  if (error) throw error;
  return (data ?? []).map((r) => r.content_type as MarketingContentType);
}

/** Count Pinterest pins generated today (for 2/day throttle). */
export async function getPinterestCountToday(): Promise<number> {
  const supabase = createAdminClient();
  const today = new Date().toISOString().split("T")[0];

  const { count, error } = await supabase
    .from("marketing_drafts")
    .select("id", { count: "exact", head: true })
    .gte("created_at", `${today}T00:00:00.000Z`)
    .not("platform_variants->pinterest", "is", null);

  if (error) throw error;
  return count ?? 0;
}

// ===== REDDIT =====

/** Insert a Reddit thread. Uses ON CONFLICT DO NOTHING to skip duplicates. */
export async function saveRedditThread(data: {
  threadId: string;
  subreddit: string;
  title: string;
  url: string;
  relevanceScore: number;
  keywordsMatched: string[];
  draftReply: string;
  hookToken?: string;
  status?: MarketingRedditStatus;
}): Promise<MarketingRedditThread | null> {
  const supabase = createAdminClient();

  const { data: row, error } = await supabase
    .from("marketing_reddit_threads")
    .upsert(
      {
        thread_id: data.threadId,
        subreddit: data.subreddit,
        title: data.title,
        url: data.url,
        relevance_score: data.relevanceScore,
        keywords_matched: data.keywordsMatched,
        draft_reply: data.draftReply,
        hook_token: data.hookToken ?? null,
        status: data.status ?? "detected",
      },
      { onConflict: "thread_id", ignoreDuplicates: true }
    )
    .select()
    .single();

  if (error) {
    // ignoreDuplicates means no row is returned on conflict — treat as null
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return row as MarketingRedditThread;
}

/** Get a single Reddit thread by ID (uuid, not thread_id). */
export async function getRedditThread(
  id: string
): Promise<MarketingRedditThread | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("marketing_reddit_threads")
    .select()
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data as MarketingRedditThread;
}

/** List Reddit threads by status. */
export async function listRedditThreads(
  status?: MarketingRedditStatus
): Promise<MarketingRedditThread[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("marketing_reddit_threads")
    .select()
    .order("created_at", { ascending: false });

  if (status !== undefined) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as MarketingRedditThread[];
}

/** Count replies posted today (replied_at >= start of today UTC). */
export async function getRedditDailyCount(): Promise<number> {
  const supabase = createAdminClient();
  const today = new Date().toISOString().split("T")[0];

  const { count, error } = await supabase
    .from("marketing_reddit_threads")
    .select("id", { count: "exact", head: true })
    .eq("status", "replied")
    .gte("replied_at", `${today}T00:00:00.000Z`);

  if (error) throw error;
  return count ?? 0;
}

/** Count replies posted today for a specific subreddit. */
export async function getRedditSubredditCount(
  subreddit: string
): Promise<number> {
  const supabase = createAdminClient();
  const today = new Date().toISOString().split("T")[0];

  const { count, error } = await supabase
    .from("marketing_reddit_threads")
    .select("id", { count: "exact", head: true })
    .eq("status", "replied")
    .eq("subreddit", subreddit)
    .gte("replied_at", `${today}T00:00:00.000Z`);

  if (error) throw error;
  return count ?? 0;
}

/** Get the most recent reply timestamp. Returns null if no replies today. */
export async function getLastReplyTimestamp(): Promise<Date | null> {
  const supabase = createAdminClient();
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("marketing_reddit_threads")
    .select("replied_at")
    .eq("status", "replied")
    .gte("replied_at", `${today}T00:00:00.000Z`)
    .order("replied_at", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // no rows
    throw error;
  }
  return data?.replied_at ? new Date(data.replied_at) : null;
}

/** Update a Reddit thread (e.g., status change, edited reply). */
export async function updateRedditThread(
  id: string,
  data: {
    status?: MarketingRedditStatus;
    draftReply?: string;
    repliedAt?: string;
    hookToken?: string;
  }
): Promise<void> {
  const supabase = createAdminClient();

  const patch: Record<string, unknown> = {};
  if (data.status !== undefined) patch.status = data.status;
  if (data.draftReply !== undefined) patch.draft_reply = data.draftReply;
  if (data.repliedAt !== undefined) patch.replied_at = data.repliedAt;
  if (data.hookToken !== undefined) patch.hook_token = data.hookToken;

  const { error } = await supabase
    .from("marketing_reddit_threads")
    .update(patch)
    .eq("id", id);

  if (error) throw error;
}

// ===== TRENDS =====

/** Upsert trend data by platform. */
export async function upsertTrend(
  platform: string,
  trendData: Record<string, unknown>
): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase.from("marketing_trends").upsert(
    {
      platform,
      trend_data: trendData,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: "platform" }
  );

  if (error) throw error;
}

/** Get all trends. Returns only non-stale data (fetched within last 5 hours). */
export async function getTrends(): Promise<
  Array<{ platform: string; trend_data: Record<string, unknown> }>
> {
  const supabase = createAdminClient();
  const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from("marketing_trends")
    .select("platform, trend_data")
    .gte("fetched_at", fiveHoursAgo.toISOString());

  if (error) throw error;
  return (data ?? []) as Array<{
    platform: string;
    trend_data: Record<string, unknown>;
  }>;
}

// ===== ANALYTICS =====

/** Upsert analytics for a draft+platform on today's date. */
export async function upsertAnalytics(
  draftId: string,
  platform: string,
  data: {
    impressions: number;
    engagements: number;
    clicks: number;
  }
): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase.from("marketing_analytics").upsert(
    {
      draft_id: draftId,
      platform,
      impressions: data.impressions,
      engagements: data.engagements,
      clicks: data.clicks,
      fetched_at: new Date().toISOString().split("T")[0], // date only
    },
    { onConflict: "draft_id,platform,fetched_at" }
  );

  if (error) throw error;
}

/** Get analytics for all published drafts, optionally filtered by date range. */
export async function getAnalytics(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<
  Array<{
    draft_id: string;
    platform: string;
    impressions: number;
    engagements: number;
    clicks: number;
    fetched_at: string;
  }>
> {
  const supabase = createAdminClient();
  let query = supabase
    .from("marketing_analytics")
    .select("draft_id, platform, impressions, engagements, clicks, fetched_at")
    .order("fetched_at", { ascending: false });

  if (params?.startDate) {
    query = query.gte("fetched_at", params.startDate);
  }
  if (params?.endDate) {
    query = query.lte("fetched_at", params.endDate);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Array<{
    draft_id: string;
    platform: string;
    impressions: number;
    engagements: number;
    clicks: number;
    fetched_at: string;
  }>;
}

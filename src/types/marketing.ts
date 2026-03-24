export type MarketingContentType =
  | "landlord_expose"
  | "building_horror"
  | "neighborhood_trend"
  | "tenant_rights"
  | "news_reaction"
  | "viral_humor";

export type MarketingDraftStatus =
  | "generating"
  | "draft"
  | "approved"
  | "published"
  | "rejected"
  | "failed";

export type MarketingVideoType = "avatar" | "data_viz" | "viral_character" | "none";

export type MarketingRedditStatus =
  | "detected"
  | "draft_ready"
  | "approved"
  | "replied"
  | "skipped";

export interface PlatformVariant {
  caption: string;
  hashtags?: string[];
}

export interface PinterestVariant {
  title: string;
  description: string;
  board: string;
  image_url?: string;
}

export interface PlatformVariants {
  instagram?: PlatformVariant;
  tiktok?: PlatformVariant;
  youtube?: PlatformVariant & { title: string; tags?: string[] };
  x?: PlatformVariant;
  linkedin?: PlatformVariant;
  facebook?: PlatformVariant;
  pinterest?: PinterestVariant;
  threads?: PlatformVariant;
  bluesky?: PlatformVariant;
}

export interface PublishResult {
  platform: string;
  post_id?: string;
  url?: string;
  error?: string;
}

export interface MarketingDraft {
  id: string;
  workflow_run_id: string | null;
  hook_token: string | null;
  content_type: MarketingContentType;
  status: MarketingDraftStatus;
  error_message: string | null;
  source_data: Record<string, unknown> | null;
  caption: string | null;
  platform_variants: PlatformVariants | null;
  media_urls: string[] | null;
  video_type: MarketingVideoType;
  published_at: string | null;
  publish_results: PublishResult[] | null;
  created_at: string;
  updated_at: string;
}

export interface MarketingRedditThread {
  id: string;
  thread_id: string;
  subreddit: string;
  title: string | null;
  url: string | null;
  hook_token: string | null;
  relevance_score: number | null;
  keywords_matched: string[] | null;
  draft_reply: string | null;
  status: MarketingRedditStatus;
  replied_at: string | null;
  created_at: string;
}

export interface MarketingTrend {
  id: string;
  platform: string;
  trend_data: Record<string, unknown> | null;
  fetched_at: string;
}

export interface MarketingAnalyticsRow {
  id: string;
  draft_id: string;
  platform: string;
  impressions: number;
  engagements: number;
  clicks: number;
  fetched_at: string;
}

// Workflow event types (emitted via getWritable)
export type MarketingWorkflowEvent =
  | { type: "content_type_selected"; contentType: MarketingContentType; reasoning: string }
  | { type: "source_data_gathered"; summary: string }
  | { type: "content_generated"; captionPreview: string; platformCount: number }
  | { type: "pinterest_image_generated"; imageUrl: string }
  | { type: "video_generating"; videoType: MarketingVideoType; tool: string }
  | { type: "video_complete"; mediaUrl: string; durationMs: number }
  | { type: "draft_saved"; draftId: string }
  | { type: "awaiting_approval"; hookToken: string; draftId: string }
  | { type: "published"; results: PublishResult[] }
  | { type: "step_failed"; step: string; error: string; retryCount: number };

// API request/response types
export interface ApproveRequest {
  draftId: string;
  action: "approve" | "reject";
  editedContent?: {
    caption?: string;
    platform_variants?: PlatformVariants;
  };
}

export interface ApproveRedditRequest {
  threadId: string;
  action: "approve" | "skip";
  editedReply?: string;
}

export interface ApproveBatchRequest {
  draftIds: string[];
}

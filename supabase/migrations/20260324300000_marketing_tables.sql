-- Marketing drafts — central content queue
CREATE TYPE marketing_content_type AS ENUM (
  'landlord_expose', 'building_horror', 'neighborhood_trend',
  'tenant_rights', 'news_reaction', 'viral_humor'
);

CREATE TYPE marketing_draft_status AS ENUM (
  'generating', 'draft', 'approved', 'published', 'rejected', 'failed'
);

CREATE TYPE marketing_video_type AS ENUM (
  'avatar', 'data_viz', 'viral_character', 'none'
);

CREATE TABLE marketing_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_run_id text,
  hook_token text,
  content_type marketing_content_type NOT NULL,
  status marketing_draft_status NOT NULL DEFAULT 'generating',
  error_message text,
  source_data jsonb,
  caption text,
  platform_variants jsonb,
  media_urls text[],
  video_type marketing_video_type NOT NULL DEFAULT 'none',
  published_at timestamptz,
  publish_results jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_marketing_drafts_status ON marketing_drafts (status);
CREATE INDEX idx_marketing_drafts_created ON marketing_drafts (created_at DESC);

-- Reddit threads
CREATE TYPE marketing_reddit_status AS ENUM (
  'detected', 'draft_ready', 'approved', 'replied', 'skipped'
);

CREATE TABLE marketing_reddit_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id text UNIQUE NOT NULL,
  subreddit text NOT NULL,
  title text,
  url text,
  hook_token text,
  relevance_score float,
  keywords_matched text[],
  draft_reply text,
  status marketing_reddit_status NOT NULL DEFAULT 'detected',
  replied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reddit_threads_status ON marketing_reddit_threads (status);
CREATE INDEX idx_reddit_threads_replied ON marketing_reddit_threads (replied_at)
  WHERE replied_at IS NOT NULL;

-- Trend cache
CREATE TABLE marketing_trends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text UNIQUE NOT NULL,
  trend_data jsonb,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

-- Analytics snapshots
CREATE TABLE marketing_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid NOT NULL REFERENCES marketing_drafts(id) ON DELETE CASCADE,
  platform text NOT NULL,
  impressions int DEFAULT 0,
  engagements int DEFAULT 0,
  clicks int DEFAULT 0,
  fetched_at date NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE(draft_id, platform, fetched_at)
);

CREATE INDEX idx_marketing_analytics_draft ON marketing_analytics (draft_id);

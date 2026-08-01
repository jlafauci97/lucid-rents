-- Original Reddit posts generated from LucidRents data.
--
-- Distinct from marketing_reddit_threads, which tracks replies to other
-- people's threads. These are standalone posts published to our own profile,
-- so they have no parent thread, no subreddit rules to satisfy, and no
-- relevance score — only a data story and the links backing it.

CREATE TABLE IF NOT EXISTS public.marketing_reddit_posts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind          text NOT NULL,
  city          text NOT NULL,
  title         text NOT NULL,
  body          text NOT NULL,
  links         jsonb NOT NULL DEFAULT '[]'::jsonb,
  status        text NOT NULL DEFAULT 'draft',
  posted_url    text,
  posted_at     timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT marketing_reddit_posts_status_check
    CHECK (status IN ('draft', 'posted', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_reddit_posts_status
  ON public.marketing_reddit_posts (status, created_at DESC);

-- One post per kind+city per day, so a re-run or a retry cannot produce a
-- duplicate ranking of the same data.
--
-- Cast through UTC explicitly: created_at::date on a timestamptz depends on the
-- session TimeZone, which makes it STABLE rather than IMMUTABLE, and Postgres
-- refuses to index it.
CREATE UNIQUE INDEX IF NOT EXISTS idx_reddit_posts_daily_unique
  ON public.marketing_reddit_posts (kind, city, ((created_at AT TIME ZONE 'UTC')::date));

ALTER TABLE public.marketing_reddit_posts ENABLE ROW LEVEL SECURITY;

-- Service role only; there is no public read path for drafts.
CREATE POLICY marketing_reddit_posts_service_role
  ON public.marketing_reddit_posts
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Extend news_articles for Lucid-authored editorial alongside existing RSS sync.
-- The `metro` column (added in 20260321_multi_city_foundation.sql) already
-- scopes articles by city, so we just add the editorial-specific columns.
--
-- Adds:
--   body             full article markdown (null for RSS articles)
--   source_type      'rss' (external) | 'lucid-rents' (auto-drafted) | 'scraped'
--   status           'draft' | 'published'
--   signal_type      'rent-trend' | 'violation-spike' | ... null for RSS
--   signal_metadata  jsonb context used to draft the article
--   auto_generated   true for Lucid-drafted rows

ALTER TABLE news_articles
  ADD COLUMN IF NOT EXISTS body            text,
  ADD COLUMN IF NOT EXISTS source_type     text NOT NULL DEFAULT 'rss',
  ADD COLUMN IF NOT EXISTS status          text NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS signal_type     text,
  ADD COLUMN IF NOT EXISTS signal_metadata jsonb,
  ADD COLUMN IF NOT EXISTS auto_generated  boolean NOT NULL DEFAULT false;

-- Drop the now-too-restrictive NOT NULL on `url` for auto-generated drafts
-- that only have a canonical in-site path, not a third-party URL.
ALTER TABLE news_articles ALTER COLUMN url DROP NOT NULL;

-- Indexes for the read path (homepage + admin).
CREATE INDEX IF NOT EXISTS idx_news_metro_status_published
  ON news_articles (metro, status, published_at DESC)
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_news_metro_draft
  ON news_articles (metro, created_at DESC)
  WHERE status = 'draft';

CREATE INDEX IF NOT EXISTS idx_news_signal_type
  ON news_articles (signal_type, published_at DESC)
  WHERE signal_type IS NOT NULL;

-- Keep public SELECT on published rows, but not on drafts.
DROP POLICY IF EXISTS "anon_read_news" ON news_articles;
CREATE POLICY "anon_read_published_news"
  ON news_articles FOR SELECT
  USING (status = 'published');

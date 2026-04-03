-- Create news_articles table for NYC housing news aggregation
CREATE TABLE news_articles (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  guid          text NOT NULL UNIQUE,
  slug          text NOT NULL UNIQUE,
  title         text NOT NULL,
  excerpt       text,
  url           text NOT NULL,
  source_name   text NOT NULL,
  source_slug   text NOT NULL,
  category      text NOT NULL DEFAULT 'general',
  image_url     text,
  author        text,
  published_at  timestamptz NOT NULL,
  fetched_at    timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX idx_news_category_published ON news_articles (category, published_at DESC);
CREATE INDEX idx_news_source_published ON news_articles (source_slug, published_at DESC);
CREATE INDEX idx_news_slug ON news_articles (slug);
CREATE INDEX idx_news_published ON news_articles (published_at DESC);

-- Enable RLS with public read access
ALTER TABLE news_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_news" ON news_articles FOR SELECT USING (true);

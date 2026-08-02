-- Press kits generated when a landlord we track appears in the news.
--
-- Draft-only by design. These name real companies next to real news coverage,
-- so a false match is a claim we would have to retract — nothing here is ever
-- auto-published. A human reads the kit and decides whether to send it.

CREATE TABLE IF NOT EXISTS public.marketing_press_kits (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The article that triggered the kit.
  article_id     uuid NOT NULL REFERENCES public.news_articles(id) ON DELETE CASCADE,
  article_title  text NOT NULL,
  article_url    text,
  source_name    text,
  city           text NOT NULL,

  -- The entity we matched and why we believe the match.
  owner_name     text NOT NULL,
  matched_on     text NOT NULL,
  confidence     numeric NOT NULL,

  -- Our data on that entity at generation time, plus the assembled kit.
  stats          jsonb NOT NULL,
  body           text NOT NULL,

  status         text NOT NULL DEFAULT 'draft',
  created_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT marketing_press_kits_status_check
    CHECK (status IN ('draft', 'sent', 'rejected')),
  CONSTRAINT marketing_press_kits_confidence_check
    CHECK (confidence >= 0 AND confidence <= 1)
);

-- One kit per landlord per article; a re-run must not duplicate outreach.
CREATE UNIQUE INDEX IF NOT EXISTS idx_press_kits_article_owner
  ON public.marketing_press_kits (article_id, owner_name);

CREATE INDEX IF NOT EXISTS idx_press_kits_status
  ON public.marketing_press_kits (status, created_at DESC);

ALTER TABLE public.marketing_press_kits ENABLE ROW LEVEL SECURITY;

-- Service role only. There is no public read path — these are internal drafts.
CREATE POLICY marketing_press_kits_service_role
  ON public.marketing_press_kits
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

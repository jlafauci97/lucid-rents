-- Frozen monthly ranking snapshots.
--
-- /[city]/rankings shows live data and changes every day, which makes it
-- uncitable: a journalist who writes "LucidRents ranked X worst in August"
-- needs a URL that still says that in November. These rows are written once a
-- month and never recomputed, so /[city]/rankings/2026-08 is stable forever.

CREATE TABLE IF NOT EXISTS public.marketing_ranking_snapshots (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- YYYY-MM, matches the URL segment.
  period      text NOT NULL,
  city        text NOT NULL,
  kind        text NOT NULL,
  -- The ranked rows exactly as rendered, so the page never re-queries and the
  -- published numbers cannot drift from what was cited.
  rows        jsonb NOT NULL,
  meta        jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT marketing_ranking_snapshots_period_check
    CHECK (period ~ '^\d{4}-\d{2}$'),
  CONSTRAINT marketing_ranking_snapshots_kind_check
    CHECK (kind IN ('worst_buildings', 'worst_landlords', 'worst_neighborhoods'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ranking_snapshots_unique
  ON public.marketing_ranking_snapshots (period, city, kind);

CREATE INDEX IF NOT EXISTS idx_ranking_snapshots_lookup
  ON public.marketing_ranking_snapshots (city, period);

ALTER TABLE public.marketing_ranking_snapshots ENABLE ROW LEVEL SECURITY;

-- Public read: these back a public page. Writes are service-role only.
CREATE POLICY marketing_ranking_snapshots_public_read
  ON public.marketing_ranking_snapshots
  FOR SELECT
  USING (true);

CREATE POLICY marketing_ranking_snapshots_service_write
  ON public.marketing_ranking_snapshots
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Borough-filtered sort indexes for /api/building-rankings (the rankings
-- directory's client-side filter buttons). Applied to prod 2026-08-17 via
-- one-shot pg_cron CREATE INDEX CONCURRENTLY; IF NOT EXISTS makes this file
-- a no-op there.
--
-- The API orders by a count column and optionally filters borough. Only
-- violation_count had a (metro, borough, count) index; the other sorts fell
-- back to the (metro, count) partial index and walked count-ordered rows
-- filtering for the borough — for small boroughs on high-cardinality
-- columns that walk blew anon's 8s statement_timeout (Staten Island +
-- complaints measured 8.3s -> HTTP 500, which the directory swallowed and
-- rendered as a dead button). These mirror
-- idx_buildings_metro_borough_violations for the remaining sort columns.
CREATE INDEX IF NOT EXISTS idx_buildings_metro_borough_complaints
  ON public.buildings (metro, borough, complaint_count DESC NULLS LAST)
  WHERE complaint_count > 0;

CREATE INDEX IF NOT EXISTS idx_buildings_metro_borough_evictions
  ON public.buildings (metro, borough, eviction_count DESC NULLS LAST)
  WHERE eviction_count > 0;

CREATE INDEX IF NOT EXISTS idx_buildings_metro_borough_lawsuits
  ON public.buildings (metro, borough, litigation_count DESC NULLS LAST)
  WHERE litigation_count > 0;

CREATE INDEX IF NOT EXISTS idx_buildings_metro_borough_bedbug
  ON public.buildings (metro, borough, bedbug_report_count DESC NULLS LAST)
  WHERE bedbug_report_count > 0;

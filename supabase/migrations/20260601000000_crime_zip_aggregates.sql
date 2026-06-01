-- Per-zip crime aggregates for NYC / Chicago / LA / Houston.
--
-- Why: the building page aggregated crime by fetching up to 1,000 raw rows from
-- nypd_complaints (4.8M rows, 3.4 GB) and counting them in JS. For a high-volume
-- zip that query is an index scan that heap-fetches ~1,000 rows and takes ~12s,
-- blowing the anon role's statement_timeout. The crime sub-query then errored,
-- the safe() wrapper returned total12mo=0, and the Crime section rendered nothing
-- despite real data (e.g. zip 11208 has 4,107 incidents in the last 12 months).
--
-- This table holds one pre-aggregated row per (zip, metro), refreshed in batch by
-- scripts/load-crime-aggregates.mjs (a single seq-scan GROUP BY). The page then
-- does an instant primary-key lookup. Mirrors the existing miami_crime_aggregates
-- pattern; Miami keeps its own table (population-apportioned, not incident-level).

CREATE TABLE IF NOT EXISTS public.crime_zip_aggregates (
  zip          text        NOT NULL,
  metro        text        NOT NULL,
  total_12mo   integer     NOT NULL DEFAULT 0,
  violent      integer     NOT NULL DEFAULT 0,
  property     integer     NOT NULL DEFAULT 0,
  qol          integer     NOT NULL DEFAULT 0,
  top_precinct text,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (zip, metro)
);

-- Public read, consistent with buildings / nypd_complaints / transit_stops.
ALTER TABLE public.crime_zip_aggregates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crime_zip_aggregates_select_public ON public.crime_zip_aggregates;
CREATE POLICY crime_zip_aggregates_select_public
  ON public.crime_zip_aggregates FOR SELECT
  USING (true);

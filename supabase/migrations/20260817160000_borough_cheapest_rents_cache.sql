-- Per-borough "cheapest 500 buildings with tracked rent" cache,
-- zip_tracked_rents-style. Applied to prod 2026-08-17 via MCP (DDL by
-- execute_sql, initial population via one-shot pg_cron); IF NOT EXISTS /
-- OR REPLACE make this file a no-op there.
--
-- The borough listing's page-1 "Best Apartments" tiers ran a live
-- building_rents (~8M rows) x buildings join sorted by median_rent. That
-- plans as a parallel seq scan + hash join + full sort — measured 8.5s+ and
-- cancelled by anon's 8s statement_timeout on EVERY cold render (the section
-- silently rendered nothing), while still blocking the ISR render for the
-- full 8s. Together with the directory's OFFSET pagination it made borough
-- listing URLs the site's slowest crawl responses in Search Console.
--
-- ~500 rows per (metro, borough) pair; the app reads the top of the list and
-- buckets into price tiers.

CREATE TABLE IF NOT EXISTS public.borough_cheapest_rents (
  metro text NOT NULL,
  borough text NOT NULL,
  building_id uuid NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  median_rent numeric NOT NULL,
  rank integer NOT NULL,
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (metro, borough, rank)
);
ALTER TABLE public.borough_cheapest_rents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read" ON public.borough_cheapest_rents;
CREATE POLICY "public read" ON public.borough_cheapest_rents
  FOR SELECT TO anon, authenticated USING (true);

-- Full rebuild: one pass over building_rents, cheapest rent per building,
-- ranked per (metro, borough), top 500 kept. Delete-then-insert (not upsert)
-- because ranks shift wholesale between refreshes. SECURITY DEFINER with a
-- 10-minute timeout so the pg_cron/postgres role's default statement_timeout
-- can't cancel it.
CREATE OR REPLACE FUNCTION public.refresh_borough_cheapest_rents()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
SET statement_timeout TO '600s'
AS $$
  DELETE FROM borough_cheapest_rents;
  INSERT INTO borough_cheapest_rents (metro, borough, building_id, median_rent, rank, refreshed_at)
  SELECT metro, borough, building_id, median_rent, rn, now()
  FROM (
    SELECT b.metro, b.borough, br.building_id,
           MIN(br.median_rent) AS median_rent,
           ROW_NUMBER() OVER (
             PARTITION BY b.metro, b.borough
             ORDER BY MIN(br.median_rent) ASC
           ) AS rn
    FROM building_rents br
    JOIN buildings b ON b.id = br.building_id
    WHERE br.median_rent > 0
      AND b.metro IS NOT NULL
      AND b.borough IS NOT NULL
    GROUP BY b.metro, b.borough, br.building_id
  ) t
  WHERE t.rn <= 500;
$$;
REVOKE EXECUTE ON FUNCTION public.refresh_borough_cheapest_rents() FROM public, anon, authenticated;

-- Nightly rebuild at 07:25 UTC, right after refresh-zip-tracked-rents (07:20),
-- before the morning crawl wave.
SELECT cron.schedule('refresh-borough-cheapest-rents', '25 7 * * *', 'SELECT public.refresh_borough_cheapest_rents()');

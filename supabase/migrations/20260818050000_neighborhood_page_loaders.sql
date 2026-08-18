-- Neighborhood report-card page loaders (2026-08-18). Applied to prod via
-- MCP (index via one-shot pg_cron CREATE INDEX CONCURRENTLY); IF NOT EXISTS /
-- OR REPLACE make this file a no-op there.
--
-- The /[city]/neighborhood/[slug] cold render took ~9-10s and two of its
-- sections had never rendered at all:
-- 1. getTopBuildings (zip ORDER BY violation_count LIMIT 5) had no matching
--    index — dense zips sorted thousands of cold rows past the anon 8s
--    statement_timeout.
-- 2. getTopLandlords fetched EVERY building row in the zip to aggregate in
--    JS (8s+ on dense zips) — and used invalid PostgREST syntax anyway.
-- 3. getBestApartments referenced a nonexistent buildings.median_rent column
--    (plus invalid syntax): permanently silent 400.

CREATE INDEX IF NOT EXISTS idx_buildings_zip_violations
  ON public.buildings (zip_code, violation_count DESC NULLS LAST)
  WHERE zip_code IS NOT NULL;

-- Server-side owner aggregate: index-only scan on idx_buildings_zip_stats_cover
-- (~0.2s on the densest zips). Zip alone is filter enough — metro zip ranges
-- are disjoint across the five cities.
CREATE OR REPLACE FUNCTION public.neighborhood_top_landlords(target_zip text, max_rows integer DEFAULT 5)
RETURNS TABLE (owner_name text, building_count bigint, total_violations bigint)
LANGUAGE sql STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT (b.owner_name)::text, count(*), coalesce(sum(b.violation_count), 0)
  FROM buildings b
  WHERE b.zip_code = target_zip AND b.owner_name IS NOT NULL
  GROUP BY b.owner_name
  ORDER BY coalesce(sum(b.violation_count), 0) DESC
  LIMIT max_rows;
$$;

-- Per-zip "20 cheapest rent-tracked buildings" cache, same pattern as
-- borough_cheapest_rents (see 20260817160000): the live building_rents x
-- buildings join blows the anon 8s timeout on dense zips.
CREATE TABLE IF NOT EXISTS public.zip_cheapest_rents (
  metro text NOT NULL,
  zip text NOT NULL,
  building_id uuid NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  median_rent numeric NOT NULL,
  rank integer NOT NULL,
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (metro, zip, rank)
);
ALTER TABLE public.zip_cheapest_rents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read" ON public.zip_cheapest_rents;
CREATE POLICY "public read" ON public.zip_cheapest_rents
  FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.refresh_zip_cheapest_rents()
RETURNS void LANGUAGE sql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
SET statement_timeout TO '600s'
AS $$
  DELETE FROM zip_cheapest_rents;
  INSERT INTO zip_cheapest_rents (metro, zip, building_id, median_rent, rank, refreshed_at)
  SELECT metro, zip, building_id, median_rent, rn, now()
  FROM (
    SELECT b.metro, b.zip_code AS zip, br.building_id,
           MIN(br.median_rent) AS median_rent,
           ROW_NUMBER() OVER (PARTITION BY b.metro, b.zip_code ORDER BY MIN(br.median_rent) ASC) AS rn
    FROM building_rents br
    JOIN buildings b ON b.id = br.building_id
    WHERE br.median_rent > 0 AND b.metro IS NOT NULL AND b.zip_code IS NOT NULL
    GROUP BY b.metro, b.zip_code, br.building_id
  ) t WHERE t.rn <= 20;
$$;
REVOKE EXECUTE ON FUNCTION public.refresh_zip_cheapest_rents() FROM public, anon, authenticated;

-- Nightly rebuild at 07:30 UTC, after the zip (07:20) and borough (07:25)
-- rent caches.
SELECT cron.schedule('refresh-zip-cheapest-rents', '30 7 * * *', 'SELECT public.refresh_zip_cheapest_rents()');

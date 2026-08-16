-- Applied to prod 2026-08-16 via MCP; this file mirrors the recorded
-- migration (version 20260816174553) so `db push` sees it as applied.
--
-- Per-zip "buildings with tracked rents" cache, crime_zip_aggregates-style.
-- The live count_neighborhood_tracked_rents join (building_rents x buildings
-- by zip) nested-loops ~10K index probes for dense zips (74s measured on
-- zip 11420) and hit the anon 8s statement_timeout on every uncached call —
-- the second query gating cold building-page TTFB at ~8.7s (see PR #330 for
-- the first: the same component's same-era count). Because the RPC failed on
-- every uncached zip, trackedCount was always 0 and the "Comparable rentals"
-- related link never rendered — the query was pure 8s cost with no output.
-- The RPC keeps its exact signature and now reads this table, so no app
-- change is needed. p_exclude_id is accepted but ignored: the app has only
-- ever passed the zero uuid.

CREATE TABLE IF NOT EXISTS public.zip_tracked_rents (
  metro text NOT NULL,
  zip text NOT NULL,
  tracked_count integer NOT NULL,
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (metro, zip)
);
ALTER TABLE public.zip_tracked_rents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read" ON public.zip_tracked_rents;
CREATE POLICY "public read" ON public.zip_tracked_rents
  FOR SELECT TO anon, authenticated USING (true);

-- Full rebuild: one hash-join pass over building_rents (~7M rows), then prune
-- zips that vanished. SECURITY DEFINER with a 10-minute timeout so the
-- pg_cron/postgres role's default statement_timeout can't cancel it.
CREATE OR REPLACE FUNCTION public.refresh_zip_tracked_rents()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
SET statement_timeout TO '600s'
AS $$
  INSERT INTO zip_tracked_rents (metro, zip, tracked_count, refreshed_at)
  SELECT b.metro, b.zip_code, COUNT(DISTINCT br.building_id)::int, now()
  FROM building_rents br
  JOIN buildings b ON b.id = br.building_id
  WHERE br.median_rent IS NOT NULL
    AND b.zip_code IS NOT NULL
    AND b.metro IS NOT NULL
  GROUP BY b.metro, b.zip_code
  ON CONFLICT (metro, zip) DO UPDATE
    SET tracked_count = EXCLUDED.tracked_count,
        refreshed_at = EXCLUDED.refreshed_at;
  DELETE FROM zip_tracked_rents WHERE refreshed_at < now() - interval '2 days';
$$;
REVOKE EXECUTE ON FUNCTION public.refresh_zip_tracked_rents() FROM public, anon, authenticated;

-- Same signature as before — now a single-row primary-key lookup.
CREATE OR REPLACE FUNCTION public.count_neighborhood_tracked_rents(p_zip text, p_metro text, p_exclude_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $$
  SELECT COALESCE(
    (SELECT tracked_count FROM zip_tracked_rents WHERE metro = p_metro AND zip = p_zip),
    0
  );
$$;

-- Nightly rebuild at 07:20 UTC (~2:20am ET, before the morning crawl wave).
SELECT cron.schedule('refresh-zip-tracked-rents', '20 7 * * *', 'SELECT public.refresh_zip_tracked_rents()');

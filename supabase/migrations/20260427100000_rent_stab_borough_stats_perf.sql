-- ============================================================================
-- Performance: rent_stab_borough_stats RPC was timing out on NYC.
--
-- Why the previous version was slow:
--   - GROUPed BY borough across all metro buildings (~924K for NYC) just to
--     compute total_buildings.
--   - SUM(stabilized_units) forced ~47K random heap reads even with the
--     existing partial index `idx_buildings_metro_stabilized` because that
--     index does not cover stabilized_units.
--   - The page calls the RPC via the anon REST role which has an 8s
--     statement_timeout in this Supabase project — so any query taking
--     longer than 8s returns nothing and the page renders empty.
--
-- Fix:
--   - Pre-aggregate per (metro, borough) into a small cache table.
--   - Rewrite the RPC to read from that cache (sub-ms response).
--   - Provide a refresh function to repopulate after data changes; this
--     migration also performs the initial backfill.
--
-- The cache columns intentionally mirror what the page consumes:
--   - stabilized_buildings, total_stabilized_units (used)
--   - total_buildings is set to stabilized_buildings — the field is in the
--     RPC return type for back-compat but is never displayed by the page.
-- ============================================================================

CREATE TABLE IF NOT EXISTS rent_stab_borough_stats_cache (
    metro                  text   NOT NULL,
    borough                text   NOT NULL,
    stabilized_buildings   bigint NOT NULL,
    total_stabilized_units bigint NOT NULL,
    refreshed_at           timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (metro, borough)
);

GRANT SELECT ON rent_stab_borough_stats_cache TO anon, authenticated, service_role;

DROP FUNCTION IF EXISTS public.rent_stab_borough_stats(text);
DROP FUNCTION IF EXISTS public.rent_stab_borough_stats();

-- SECURITY DEFINER so the function bypasses RLS on the cache table when
-- called by the anon role from PostgREST.
CREATE OR REPLACE FUNCTION public.rent_stab_borough_stats(p_metro text DEFAULT 'nyc')
RETURNS TABLE(
    borough character varying,
    total_buildings bigint,
    stabilized_buildings bigint,
    total_stabilized_units bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
    SELECT
        borough::character varying,
        stabilized_buildings AS total_buildings,
        stabilized_buildings,
        total_stabilized_units
    FROM rent_stab_borough_stats_cache
    WHERE metro = p_metro
    ORDER BY total_stabilized_units DESC NULLS LAST, stabilized_buildings DESC;
$$;

GRANT EXECUTE ON FUNCTION public.rent_stab_borough_stats(text) TO anon, authenticated, service_role;

-- Repopulate the cache from the buildings table. Runs as service_role
-- (300s statement_timeout) so the heavy GROUP BY + SUM has time to finish.
-- Call manually after data syncs or schedule via cron / pg_cron.
CREATE OR REPLACE FUNCTION public.refresh_rent_stab_borough_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
    INSERT INTO rent_stab_borough_stats_cache (metro, borough, stabilized_buildings, total_stabilized_units, refreshed_at)
    SELECT metro, borough, COUNT(*)::bigint, COALESCE(SUM(stabilized_units), 0)::bigint, now()
    FROM buildings
    WHERE is_rent_stabilized = true
      AND borough IS NOT NULL
      AND metro IS NOT NULL
    GROUP BY metro, borough
    ON CONFLICT (metro, borough) DO UPDATE SET
        stabilized_buildings   = EXCLUDED.stabilized_buildings,
        total_stabilized_units = EXCLUDED.total_stabilized_units,
        refreshed_at           = EXCLUDED.refreshed_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_rent_stab_borough_stats() TO service_role;

-- Initial backfill — best-effort; in busy production environments this may
-- need to be re-run via SELECT refresh_rent_stab_borough_stats() during a
-- quieter window. Wrapped in a sub-transaction so a timeout doesn't abort
-- the whole migration.
DO $$
BEGIN
    PERFORM refresh_rent_stab_borough_stats();
EXCEPTION WHEN query_canceled THEN
    RAISE NOTICE 'Initial backfill timed out; run SELECT refresh_rent_stab_borough_stats() manually.';
END
$$;

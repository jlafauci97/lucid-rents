-- supabase/migrations/20260521010000_nyc_311_per_building_matview.sql
--
-- Per-building NYC 311 aggregates (noise last 90d, rats last 12mo).
-- The radius RPCs sum over this view instead of scanning the 15M-row
-- complaints_311 partition. Refresh via REFRESH MATERIALIZED VIEW
-- CONCURRENTLY nyc_311_per_building after each daily complaints sync.
--
-- Build time: ~100s. Refresh time (CONCURRENT): ~30s. Page reads ~1ms.
--
-- The build requires a raised statement_timeout because the ILIKE
-- scan over 15M rows exceeds the default 8s. Use set_config inline
-- to bump for this transaction.

DO $$ BEGIN PERFORM set_config('statement_timeout', '300000', false); END $$;

DROP MATERIALIZED VIEW IF EXISTS nyc_311_per_building CASCADE;

CREATE MATERIALIZED VIEW nyc_311_per_building AS
SELECT
  building_id,
  count(*) FILTER (WHERE complaint_type ILIKE '%noise%' AND created_date > NOW() - INTERVAL '90 days')::int AS noise_90d,
  count(*) FILTER (WHERE (complaint_type ILIKE '%rodent%' OR descriptor ILIKE '%rat%') AND created_date > NOW() - INTERVAL '12 months')::int AS rats_12mo
FROM complaints_311
WHERE metro = 'nyc'
  AND building_id IS NOT NULL
  AND created_date > NOW() - INTERVAL '12 months'
GROUP BY building_id;

CREATE UNIQUE INDEX nyc_311_per_building_pk ON nyc_311_per_building (building_id);

GRANT SELECT ON nyc_311_per_building TO anon, authenticated;

COMMENT ON MATERIALIZED VIEW nyc_311_per_building IS
  'Per-building NYC 311 counts. Used by count_311_noise_near / count_rats_near. Refresh after each complaints_311 sync.';

-- Rewire the 311 RPCs to sum over the matview.
CREATE OR REPLACE FUNCTION count_311_noise_near(
  p_lat double precision,
  p_lng double precision,
  p_radius_m int DEFAULT 1207
) RETURNS int LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  result int;
BEGIN
  EXECUTE format($q$
    WITH nearby_buildings AS (
      SELECT id FROM buildings
      WHERE metro = 'nyc'
        AND latitude  BETWEEN %1$s - 0.02  AND %1$s + 0.02
        AND longitude BETWEEN %2$s - 0.025 AND %2$s + 0.025
        AND ST_DWithin(
          ST_MakePoint(longitude::double precision, latitude::double precision)::geography,
          ST_MakePoint(%2$s, %1$s)::geography,
          %3$s
        )
    )
    SELECT COALESCE(sum(agg.noise_90d), 0)::int
    FROM nearby_buildings nb
    JOIN nyc_311_per_building agg ON agg.building_id = nb.id
  $q$, p_lat::text, p_lng::text, p_radius_m::text) INTO result;
  RETURN COALESCE(result, 0);
END;
$$;

CREATE OR REPLACE FUNCTION count_rats_near(
  p_lat double precision,
  p_lng double precision,
  p_radius_m int DEFAULT 1207
) RETURNS int LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  result int;
BEGIN
  EXECUTE format($q$
    WITH nearby_buildings AS (
      SELECT id FROM buildings
      WHERE metro = 'nyc'
        AND latitude  BETWEEN %1$s - 0.02  AND %1$s + 0.02
        AND longitude BETWEEN %2$s - 0.025 AND %2$s + 0.025
        AND ST_DWithin(
          ST_MakePoint(longitude::double precision, latitude::double precision)::geography,
          ST_MakePoint(%2$s, %1$s)::geography,
          %3$s
        )
    )
    SELECT COALESCE(sum(agg.rats_12mo), 0)::int
    FROM nearby_buildings nb
    JOIN nyc_311_per_building agg ON agg.building_id = nb.id
  $q$, p_lat::text, p_lng::text, p_radius_m::text) INTO result;
  RETURN COALESCE(result, 0);
END;
$$;

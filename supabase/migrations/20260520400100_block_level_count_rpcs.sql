-- supabase/migrations/20260520400100_block_level_count_rpcs.sql
--
-- Block-level count RPCs for the Neighborhood Risks tool.
--
-- The 311 RPCs use EXECUTE with format() — NOT a parameterized prepared
-- statement — because Postgres' generic plan caching produces a terrible
-- plan when the lat/lng are bind parameters: it falls back to scanning
-- the 15M+ row complaints_311_nyc partition. With format() the literal
-- values are baked into the query text each call, the planner sees them,
-- and chooses the nested-loop-on-small-buildings-CTE plan.

CREATE OR REPLACE FUNCTION count_311_noise_near(
  p_lat double precision,
  p_lng double precision,
  p_radius_m int DEFAULT 1207
) RETURNS int LANGUAGE plpgsql STABLE AS $$
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
    SELECT count(*)::int
    FROM complaints_311 c
    WHERE c.metro = 'nyc'
      AND c.created_date > NOW() - INTERVAL '90 days'
      AND c.complaint_type ILIKE '%%noise%%'
      AND EXISTS (SELECT 1 FROM nearby_buildings nb WHERE nb.id = c.building_id)
  $q$, p_lat::text, p_lng::text, p_radius_m::text) INTO result;
  RETURN COALESCE(result, 0);
END;
$$;

CREATE OR REPLACE FUNCTION count_rats_near(
  p_lat double precision,
  p_lng double precision,
  p_radius_m int DEFAULT 1207
) RETURNS int LANGUAGE plpgsql STABLE AS $$
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
    SELECT count(*)::int
    FROM complaints_311 c
    WHERE c.metro = 'nyc'
      AND c.created_date > NOW() - INTERVAL '12 months'
      AND (c.complaint_type ILIKE '%%rodent%%' OR c.descriptor ILIKE '%%rat%%')
      AND EXISTS (SELECT 1 FROM nearby_buildings nb WHERE nb.id = c.building_id)
  $q$, p_lat::text, p_lng::text, p_radius_m::text) INTO result;
  RETURN COALESCE(result, 0);
END;
$$;

CREATE OR REPLACE FUNCTION count_bedbugs_near(
  p_lat double precision,
  p_lng double precision,
  p_radius_m int DEFAULT 1207
) RETURNS int LANGUAGE plpgsql STABLE AS $$
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
    SELECT count(DISTINCT br.id)::int
    FROM bedbug_reports br
    WHERE br.filing_date > (NOW() - INTERVAL '3 years')::date
      AND EXISTS (SELECT 1 FROM nearby_buildings nb WHERE nb.id = br.building_id)
  $q$, p_lat::text, p_lng::text, p_radius_m::text) INTO result;
  RETURN COALESCE(result, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION count_311_noise_near TO anon, authenticated;
GRANT EXECUTE ON FUNCTION count_rats_near TO anon, authenticated;
GRANT EXECUTE ON FUNCTION count_bedbugs_near TO anon, authenticated;

COMMENT ON FUNCTION count_311_noise_near IS 'Counts NYC 311 noise complaints in the last 90 days within radius_m meters of a point.';
COMMENT ON FUNCTION count_rats_near IS 'Counts NYC 311 rat/rodent complaints in the last 12 months within radius_m meters of a point.';
COMMENT ON FUNCTION count_bedbugs_near IS 'Counts bedbug_reports filed in the last 3 years whose building is within radius_m meters of a point.';

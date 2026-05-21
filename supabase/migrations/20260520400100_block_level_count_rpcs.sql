-- supabase/migrations/20260520400100_block_level_count_rpcs.sql
--
-- Block-level count RPCs for the Neighborhood Risks tool.
--
-- Performance history:
--   v1 — direct ST_DWithin on complaints_311 ............. timed out
--   v2 — EXISTS on small buildings CTE ................... timed out for dense areas
--   v3 — JOIN to small buildings CTE via composite index .. ~500ms, current
--
-- The 311 RPCs use EXECUTE format() (not parameterized SQL) so the literal
-- coordinates are baked into the query text per call. This lets the planner
-- see actual lat/lng values and pick the small-buildings-CTE → JOIN path
-- rather than scanning the 15M+ row complaints_311_nyc partition.

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
    FROM nearby_buildings nb
    JOIN complaints_311 c
      ON c.building_id = nb.id
     AND c.metro = 'nyc'
     AND c.created_date > NOW() - INTERVAL '90 days'
    WHERE c.complaint_type ILIKE '%%noise%%'
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
    FROM nearby_buildings nb
    JOIN complaints_311 c
      ON c.building_id = nb.id
     AND c.metro = 'nyc'
     AND c.created_date > NOW() - INTERVAL '12 months'
    WHERE c.complaint_type ILIKE '%%rodent%%' OR c.descriptor ILIKE '%%rat%%'
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
    FROM nearby_buildings nb
    JOIN bedbug_reports br ON br.building_id = nb.id
    WHERE br.filing_date > (NOW() - INTERVAL '3 years')::date
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

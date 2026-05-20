-- supabase/migrations/20260520400100_block_level_count_rpcs.sql

-- 311 noise complaints within radius (last 90 days)
CREATE OR REPLACE FUNCTION count_311_noise_near(
  p_lat double precision,
  p_lng double precision,
  p_radius_m int DEFAULT 1207
) RETURNS int LANGUAGE sql STABLE AS $$
  SELECT count(*)::int
  FROM complaints_311
  WHERE metro = 'nyc'
    AND complaint_type ILIKE '%noise%'
    AND created_date > NOW() - INTERVAL '90 days'
    AND latitude IS NOT NULL
    AND longitude IS NOT NULL
    AND ST_DWithin(
      ST_MakePoint(longitude::double precision, latitude::double precision)::geography,
      ST_MakePoint(p_lng, p_lat)::geography,
      p_radius_m
    );
$$;

-- Rat / rodent 311 complaints within radius (last 12 months)
CREATE OR REPLACE FUNCTION count_rats_near(
  p_lat double precision,
  p_lng double precision,
  p_radius_m int DEFAULT 1207
) RETURNS int LANGUAGE sql STABLE AS $$
  SELECT count(*)::int
  FROM complaints_311
  WHERE metro = 'nyc'
    AND (complaint_type ILIKE '%rodent%' OR descriptor ILIKE '%rat%')
    AND created_date > NOW() - INTERVAL '12 months'
    AND latitude IS NOT NULL
    AND longitude IS NOT NULL
    AND ST_DWithin(
      ST_MakePoint(longitude::double precision, latitude::double precision)::geography,
      ST_MakePoint(p_lng, p_lat)::geography,
      p_radius_m
    );
$$;

-- Bedbug filings within radius (last 3 years), via building join
CREATE OR REPLACE FUNCTION count_bedbugs_near(
  p_lat double precision,
  p_lng double precision,
  p_radius_m int DEFAULT 1207
) RETURNS int LANGUAGE sql STABLE AS $$
  SELECT count(DISTINCT br.id)::int
  FROM bedbug_reports br
  JOIN buildings b ON br.building_id = b.id
  WHERE b.metro = 'nyc'
    AND br.filing_date > (NOW() - INTERVAL '3 years')::date
    AND b.geom IS NOT NULL
    AND ST_DWithin(
      b.geom::geography,
      ST_MakePoint(p_lng, p_lat)::geography,
      p_radius_m
    );
$$;

GRANT EXECUTE ON FUNCTION count_311_noise_near TO anon, authenticated;
GRANT EXECUTE ON FUNCTION count_rats_near TO anon, authenticated;
GRANT EXECUTE ON FUNCTION count_bedbugs_near TO anon, authenticated;

COMMENT ON FUNCTION count_311_noise_near IS 'Counts NYC 311 noise complaints in the last 90 days within radius_m meters of a point.';
COMMENT ON FUNCTION count_rats_near IS 'Counts NYC 311 rat/rodent complaints in the last 12 months within radius_m meters of a point.';
COMMENT ON FUNCTION count_bedbugs_near IS 'Counts bedbug_reports filed in the last 3 years whose building is within radius_m meters of a point.';

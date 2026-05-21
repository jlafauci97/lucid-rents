-- supabase/migrations/20260520400000_nearby_concerns_within_radius_rpc.sql

CREATE OR REPLACE FUNCTION nearby_concerns_within_radius(
  p_lat double precision,
  p_lng double precision,
  p_radius_m int DEFAULT 1207
) RETURNS TABLE (
  id BIGINT,
  category TEXT,
  sub_category TEXT,
  name TEXT,
  address TEXT,
  source TEXT,
  source_url TEXT,
  distance_mi DOUBLE PRECISION
) LANGUAGE sql STABLE AS $$
  SELECT
    nc.id,
    nc.category,
    nc.sub_category,
    COALESCE(ov.new_name, nc.name) AS name,
    nc.address,
    nc.source,
    nc.source_url,
    ST_Distance(nc.geom::geography, ST_MakePoint(p_lng, p_lat)::geography) / 1609.344 AS distance_mi
  FROM nearby_concerns nc
  LEFT JOIN nearby_concerns_overrides ov
    ON ov.source = nc.source AND ov.source_record_id = nc.source_record_id
  WHERE nc.active = TRUE
    AND nc.metro = 'nyc'
    AND (ov.action IS NULL OR ov.action != 'hide')
    AND ST_DWithin(nc.geom::geography, ST_MakePoint(p_lng, p_lat)::geography, p_radius_m)
  ORDER BY distance_mi ASC;
$$;

GRANT EXECUTE ON FUNCTION nearby_concerns_within_radius TO anon, authenticated;

COMMENT ON FUNCTION nearby_concerns_within_radius IS 'Returns active nearby_concerns rows within radius (meters) of a point, with overrides applied.';

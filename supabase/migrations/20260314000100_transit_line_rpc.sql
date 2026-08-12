-- RPC: Find buildings near a transit line (subway or bus)
-- Usage: SELECT * FROM buildings_near_transit_line('L', 'subway', 1, 25);

CREATE OR REPLACE FUNCTION buildings_near_transit_line(
  line_name text,
  transit_type text DEFAULT 'subway',
  page_num int DEFAULT 1,
  page_size int DEFAULT 25
)
RETURNS TABLE (
  id uuid,
  full_address text,
  borough text,
  zip_code text,
  slug text,
  year_built int,
  total_units int,
  owner_name text,
  overall_score numeric,
  review_count int,
  violation_count int,
  complaint_count int,
  is_rent_stabilized boolean,
  latitude numeric,
  longitude numeric,
  nearest_station text,
  station_distance_mi numeric,
  total_count bigint
) AS $$
WITH line_stops AS (
  SELECT name, latitude, longitude
  FROM transit_stops
  WHERE type = transit_type
    AND line_name = ANY(routes)
),
nearby AS (
  SELECT DISTINCT ON (b.id)
    b.id, b.full_address, b.borough, b.zip_code, b.slug,
    b.year_built, b.total_units, b.owner_name, b.overall_score,
    b.review_count, b.violation_count, b.complaint_count,
    b.is_rent_stabilized, b.latitude, b.longitude,
    s.name AS nearest_station,
    ROUND(
      (3958.8 * 2 * ASIN(SQRT(
        POWER(SIN(RADIANS(b.latitude - s.latitude) / 2), 2) +
        COS(RADIANS(s.latitude)) * COS(RADIANS(b.latitude)) *
        POWER(SIN(RADIANS(b.longitude - s.longitude) / 2), 2)
      )))::numeric, 2
    ) AS station_distance_mi
  FROM buildings b
  JOIN line_stops s ON
    b.latitude BETWEEN s.latitude - 0.005 AND s.latitude + 0.005
    AND b.longitude BETWEEN s.longitude - 0.005 AND s.longitude + 0.005
  WHERE b.latitude IS NOT NULL AND b.longitude IS NOT NULL
  ORDER BY b.id, station_distance_mi
)
SELECT
  n.*,
  (SELECT COUNT(*) FROM nearby) AS total_count
FROM nearby n
ORDER BY n.nearest_station, n.full_address
OFFSET (page_num - 1) * page_size
LIMIT page_size;
$$ LANGUAGE sql STABLE;

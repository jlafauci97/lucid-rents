-- Energy RPCs — city-aware via p_metro parameter
-- These replace the old non-parameterised versions (if any).

-- 1. energy_stats: avg score + building count per borough/area
CREATE OR REPLACE FUNCTION energy_stats(p_metro text DEFAULT 'nyc')
RETURNS TABLE(borough text, avg_score numeric, building_count bigint)
LANGUAGE sql STABLE
AS $$
  SELECT
    e.borough,
    round(avg(e.energy_star_score)::numeric, 1) AS avg_score,
    count(DISTINCT e.property_id)               AS building_count
  FROM energy_benchmarks e
  WHERE e.metro = p_metro
    AND e.energy_star_score IS NOT NULL
    AND e.report_year = (
      SELECT max(report_year) FROM energy_benchmarks WHERE metro = p_metro AND energy_star_score IS NOT NULL
    )
    AND e.borough IS NOT NULL
  GROUP BY e.borough
  ORDER BY avg_score DESC;
$$;

-- 2. energy_by_zip: avg score + count per zip code (for choropleth map)
CREATE OR REPLACE FUNCTION energy_by_zip(p_metro text DEFAULT 'nyc')
RETURNS TABLE(zip_code text, avg_score numeric, building_count bigint)
LANGUAGE sql STABLE
AS $$
  SELECT
    e.zip_code,
    round(avg(e.energy_star_score)::numeric, 1) AS avg_score,
    count(DISTINCT e.property_id)               AS building_count
  FROM energy_benchmarks e
  WHERE e.metro = p_metro
    AND e.energy_star_score IS NOT NULL
    AND e.zip_code IS NOT NULL
    AND e.report_year = (
      SELECT max(report_year) FROM energy_benchmarks WHERE metro = p_metro AND energy_star_score IS NOT NULL
    )
  GROUP BY e.zip_code
  ORDER BY avg_score DESC;
$$;

-- 3. energy_score_distribution: histogram buckets 1-10, 11-20, ... 91-100
CREATE OR REPLACE FUNCTION energy_score_distribution(p_metro text DEFAULT 'nyc')
RETURNS TABLE(bucket text, count bigint)
LANGUAGE sql STABLE
AS $$
  SELECT
    CASE
      WHEN energy_star_score BETWEEN  1 AND 10 THEN '1-10'
      WHEN energy_star_score BETWEEN 11 AND 20 THEN '11-20'
      WHEN energy_star_score BETWEEN 21 AND 30 THEN '21-30'
      WHEN energy_star_score BETWEEN 31 AND 40 THEN '31-40'
      WHEN energy_star_score BETWEEN 41 AND 50 THEN '41-50'
      WHEN energy_star_score BETWEEN 51 AND 60 THEN '51-60'
      WHEN energy_star_score BETWEEN 61 AND 70 THEN '61-70'
      WHEN energy_star_score BETWEEN 71 AND 80 THEN '71-80'
      WHEN energy_star_score BETWEEN 81 AND 90 THEN '81-90'
      WHEN energy_star_score BETWEEN 91 AND 100 THEN '91-100'
    END AS bucket,
    count(*) AS count
  FROM energy_benchmarks
  WHERE metro = p_metro
    AND energy_star_score IS NOT NULL
    AND report_year = (
      SELECT max(report_year) FROM energy_benchmarks WHERE metro = p_metro AND energy_star_score IS NOT NULL
    )
  GROUP BY bucket
  ORDER BY bucket;
$$;

-- 4. energy_top_buildings: top 200 scored buildings, linked to buildings table for slug
CREATE OR REPLACE FUNCTION energy_top_buildings(p_metro text DEFAULT 'nyc')
RETURNS TABLE(
  property_name text,
  address text,
  borough text,
  energy_star_score int,
  site_eui numeric,
  total_ghg_emissions numeric,
  building_slug text,
  building_borough text
)
LANGUAGE sql STABLE
AS $$
  SELECT
    e.property_name,
    e.address,
    e.borough,
    e.energy_star_score,
    e.site_eui::numeric,
    e.total_ghg_emissions::numeric,
    b.slug           AS building_slug,
    b.borough        AS building_borough
  FROM energy_benchmarks e
  LEFT JOIN buildings b ON b.id = e.building_id
  WHERE e.metro = p_metro
    AND e.energy_star_score IS NOT NULL
    AND e.report_year = (
      SELECT max(report_year) FROM energy_benchmarks WHERE metro = p_metro AND energy_star_score IS NOT NULL
    )
  ORDER BY e.energy_star_score DESC, e.site_eui ASC NULLS LAST
  LIMIT 200;
$$;

-- Add APN column to energy_benchmarks for LA property linkage
ALTER TABLE energy_benchmarks ADD COLUMN IF NOT EXISTS apn text;
CREATE INDEX IF NOT EXISTS idx_energy_benchmarks_apn ON energy_benchmarks(apn) WHERE apn IS NOT NULL;

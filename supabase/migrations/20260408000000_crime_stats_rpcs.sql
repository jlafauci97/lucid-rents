-- Crime stats RPCs for city-wide aggregates, zip trend sparklines, and YoY deltas.
-- All functions accept an optional `metro` param (NULL = all cities).

-- 1. City-wide aggregate stats (comparison baselines)
CREATE OR REPLACE FUNCTION crime_city_stats(
  since_date date DEFAULT (CURRENT_DATE - INTERVAL '2 years')::date,
  metro text DEFAULT NULL
)
RETURNS TABLE (
  total_crimes bigint,
  total_violent bigint,
  total_property bigint,
  total_qol bigint,
  zip_count bigint,
  avg_per_zip numeric,
  avg_violent_per_zip numeric,
  avg_property_per_zip numeric,
  avg_qol_per_zip numeric
)
LANGUAGE sql STABLE
AS $$
  SELECT
    COUNT(*)::bigint AS total_crimes,
    COUNT(*) FILTER (WHERE crime_category = 'violent')::bigint AS total_violent,
    COUNT(*) FILTER (WHERE crime_category = 'property')::bigint AS total_property,
    COUNT(*) FILTER (WHERE crime_category = 'quality_of_life')::bigint AS total_qol,
    COUNT(DISTINCT zip_code)::bigint AS zip_count,
    ROUND(COUNT(*)::numeric / NULLIF(COUNT(DISTINCT zip_code), 0), 1) AS avg_per_zip,
    ROUND(COUNT(*) FILTER (WHERE crime_category = 'violent')::numeric / NULLIF(COUNT(DISTINCT zip_code), 0), 1) AS avg_violent_per_zip,
    ROUND(COUNT(*) FILTER (WHERE crime_category = 'property')::numeric / NULLIF(COUNT(DISTINCT zip_code), 0), 1) AS avg_property_per_zip,
    ROUND(COUNT(*) FILTER (WHERE crime_category = 'quality_of_life')::numeric / NULLIF(COUNT(DISTINCT zip_code), 0), 1) AS avg_qol_per_zip
  FROM nypd_complaints
  WHERE cmplnt_date >= since_date
    AND (crime_city_stats.metro IS NULL OR metro = crime_city_stats.metro)
    AND zip_code IS NOT NULL;
$$;

-- 2. Monthly totals for ALL zips (batch sparkline data)
CREATE OR REPLACE FUNCTION crime_all_zip_trends(
  metro text DEFAULT NULL,
  num_months int DEFAULT 12
)
RETURNS TABLE (
  zip_code text,
  month_start date,
  total bigint
)
LANGUAGE sql STABLE
AS $$
  SELECT
    n.zip_code,
    date_trunc('month', n.cmplnt_date)::date AS month_start,
    COUNT(*)::bigint AS total
  FROM nypd_complaints n
  WHERE n.cmplnt_date >= (date_trunc('month', CURRENT_DATE) - (num_months || ' months')::interval)::date
    AND (crime_all_zip_trends.metro IS NULL OR n.metro = crime_all_zip_trends.metro)
    AND n.zip_code IS NOT NULL
  GROUP BY n.zip_code, date_trunc('month', n.cmplnt_date)
  ORDER BY n.zip_code, month_start;
$$;

-- 3. Current-year vs prior-year counts per zip (YoY delta)
CREATE OR REPLACE FUNCTION crime_zip_yoy(
  metro text DEFAULT NULL
)
RETURNS TABLE (
  zip_code text,
  current_year_total bigint,
  prior_year_total bigint,
  current_violent bigint,
  prior_violent bigint,
  current_property bigint,
  prior_property bigint,
  current_qol bigint,
  prior_qol bigint
)
LANGUAGE sql STABLE
AS $$
  WITH bounds AS (
    SELECT
      (CURRENT_DATE - INTERVAL '1 year')::date AS current_start,
      CURRENT_DATE AS current_end,
      (CURRENT_DATE - INTERVAL '2 years')::date AS prior_start,
      (CURRENT_DATE - INTERVAL '1 year')::date AS prior_end
  )
  SELECT
    n.zip_code,
    COUNT(*) FILTER (WHERE n.cmplnt_date >= b.current_start)::bigint AS current_year_total,
    COUNT(*) FILTER (WHERE n.cmplnt_date < b.prior_end AND n.cmplnt_date >= b.prior_start)::bigint AS prior_year_total,
    COUNT(*) FILTER (WHERE n.cmplnt_date >= b.current_start AND n.crime_category = 'violent')::bigint AS current_violent,
    COUNT(*) FILTER (WHERE n.cmplnt_date < b.prior_end AND n.cmplnt_date >= b.prior_start AND n.crime_category = 'violent')::bigint AS prior_violent,
    COUNT(*) FILTER (WHERE n.cmplnt_date >= b.current_start AND n.crime_category = 'property')::bigint AS current_property,
    COUNT(*) FILTER (WHERE n.cmplnt_date < b.prior_end AND n.cmplnt_date >= b.prior_start AND n.crime_category = 'property')::bigint AS prior_property,
    COUNT(*) FILTER (WHERE n.cmplnt_date >= b.current_start AND n.crime_category = 'quality_of_life')::bigint AS current_qol,
    COUNT(*) FILTER (WHERE n.cmplnt_date < b.prior_end AND n.cmplnt_date >= b.prior_start AND n.crime_category = 'quality_of_life')::bigint AS prior_qol
  FROM nypd_complaints n, bounds b
  WHERE n.cmplnt_date >= b.prior_start
    AND (crime_zip_yoy.metro IS NULL OR n.metro = crime_zip_yoy.metro)
    AND n.zip_code IS NOT NULL
  GROUP BY n.zip_code;
$$;

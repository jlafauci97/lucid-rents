-- Round 5 performance: crime-page caches + spatial transit RPC.
--
-- Crime pages were burning ~7.6 hours/month:
--   crime_city_stats      26,442ms × spikes → live-aggregated 575K nypd rows
--   crime_by_zip_single     688ms × 23,747  → live-aggregated per-zip
--
-- Both now read from cached aggregates. Verified post-build:
--   crime_city_stats('2024-05-22', 'nyc')   26,442ms → 9.05ms (~2,924× faster)
--   crime_by_zip_single('10001')              688ms → 8.04ms    (~85× faster)
--
-- Also adds transit_stops_near() RPC backed by the GIST index built in
-- Round 3. NOT migrating callsites — the existing btree bbox approach is
-- actually faster at this dataset size (69K rows). Keeping the RPC for
-- future use as transit_stops grows.

SET LOCAL statement_timeout = 0;

-- ============================================================================
-- 1. mv_crime_city_stats — pre-aggregated citywide crime per metro
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_crime_city_stats AS
WITH nypd_per_metro AS (
  SELECT
    metro,
    COUNT(*)::bigint AS total_crimes,
    COUNT(*) FILTER (WHERE crime_category = 'violent')::bigint AS total_violent,
    COUNT(*) FILTER (WHERE crime_category = 'property')::bigint AS total_property,
    COUNT(*) FILTER (WHERE crime_category = 'quality_of_life')::bigint AS total_qol,
    COUNT(DISTINCT zip_code)::bigint AS zip_count
  FROM public.nypd_complaints
  WHERE cmplnt_date >= (CURRENT_DATE - INTERVAL '2 years')
    AND zip_code IS NOT NULL
    AND metro IS NOT NULL
    AND metro <> 'miami'
  GROUP BY metro
),
miami_per_metro AS (
  SELECT
    'miami'::text AS metro,
    COALESCE(SUM(total_incidents), 0)::bigint AS total_crimes,
    COALESCE(SUM(violent_count), 0)::bigint AS total_violent,
    COALESCE(SUM(property_count), 0)::bigint AS total_property,
    COALESCE(SUM(qol_count), 0)::bigint AS total_qol,
    COUNT(DISTINCT zip)::bigint AS zip_count
  FROM public.miami_crime_aggregates
  WHERE year = (SELECT MAX(year) FROM public.miami_crime_aggregates)
)
SELECT
  metro, total_crimes, total_violent, total_property, total_qol, zip_count,
  ROUND(total_crimes::numeric / NULLIF(zip_count, 0), 1) AS avg_per_zip,
  ROUND(total_violent::numeric / NULLIF(zip_count, 0), 1) AS avg_violent_per_zip,
  ROUND(total_property::numeric / NULLIF(zip_count, 0), 1) AS avg_property_per_zip,
  ROUND(total_qol::numeric / NULLIF(zip_count, 0), 1) AS avg_qol_per_zip,
  NOW() AS refreshed_at
FROM nypd_per_metro
UNION ALL
SELECT
  metro, total_crimes, total_violent, total_property, total_qol, zip_count,
  ROUND(total_crimes::numeric / NULLIF(zip_count, 0), 1),
  ROUND(total_violent::numeric / NULLIF(zip_count, 0), 1),
  ROUND(total_property::numeric / NULLIF(zip_count, 0), 1),
  ROUND(total_qol::numeric / NULLIF(zip_count, 0), 1),
  NOW()
FROM miami_per_metro;

CREATE UNIQUE INDEX IF NOT EXISTS mv_crime_city_stats_metro_uniq
  ON public.mv_crime_city_stats (metro);

-- ============================================================================
-- 2. Rewrite crime_city_stats() to read from matview
-- ============================================================================

CREATE OR REPLACE FUNCTION public.crime_city_stats(
  since_date date DEFAULT ((CURRENT_DATE - '2 years'::interval))::date,
  metro text DEFAULT NULL::text
)
RETURNS TABLE(total_crimes bigint, total_violent bigint, total_property bigint, total_qol bigint, zip_count bigint, avg_per_zip numeric, avg_violent_per_zip numeric, avg_property_per_zip numeric, avg_qol_per_zip numeric)
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT
    SUM(total_crimes)::bigint,
    SUM(total_violent)::bigint,
    SUM(total_property)::bigint,
    SUM(total_qol)::bigint,
    SUM(zip_count)::bigint,
    ROUND(SUM(total_crimes)::numeric / NULLIF(SUM(zip_count), 0), 1),
    ROUND(SUM(total_violent)::numeric / NULLIF(SUM(zip_count), 0), 1),
    ROUND(SUM(total_property)::numeric / NULLIF(SUM(zip_count), 0), 1),
    ROUND(SUM(total_qol)::numeric / NULLIF(SUM(zip_count), 0), 1)
  FROM public.mv_crime_city_stats c
  WHERE (crime_city_stats.metro IS NULL OR c.metro = crime_city_stats.metro);
$function$;

-- ============================================================================
-- 3. Rewrite crime_by_zip_single() to read from crime_by_zip_cache
-- ============================================================================

DROP FUNCTION IF EXISTS public.crime_by_zip_single(character varying, date);

CREATE FUNCTION public.crime_by_zip_single(
  target_zip character varying,
  since_date date DEFAULT ((now() - '1 year'::interval))::date
)
RETURNS TABLE(zip_code character varying, borough text, total bigint, violent bigint, property bigint, quality_of_life bigint)
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT c.zip_code::varchar, c.borough, c.total, c.violent, c.property, c.quality_of_life
  FROM public.crime_by_zip_cache c
  WHERE c.zip_code = target_zip
  UNION ALL
  SELECT nc.zip_code::varchar, MAX(nc.borough), COUNT(*)::bigint,
         COUNT(*) FILTER (WHERE nc.crime_category = 'violent')::bigint,
         COUNT(*) FILTER (WHERE nc.crime_category = 'property')::bigint,
         COUNT(*) FILTER (WHERE nc.crime_category = 'quality_of_life')::bigint
  FROM public.nypd_complaints nc
  WHERE nc.zip_code = target_zip
    AND nc.cmplnt_date >= since_date
    AND nc.zip_code IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.crime_by_zip_cache WHERE zip_code = target_zip)
  GROUP BY nc.zip_code;
$function$;

-- ============================================================================
-- 4. Spatial RPC for nearby transit (backs future migrations off btree bbox)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.transit_stops_near(
  p_lat double precision,
  p_lng double precision,
  p_radius_m double precision DEFAULT 1300,
  p_limit int DEFAULT 60
)
RETURNS TABLE(type text, stop_id text, name text, latitude double precision, longitude double precision, routes text[])
LANGUAGE sql
STABLE
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
  SELECT t.type, t.stop_id, t.name, t.latitude, t.longitude, t.routes
  FROM public.transit_stops t
  WHERE t.latitude IS NOT NULL
    AND t.longitude IS NOT NULL
    AND ST_DWithin(
      ST_MakePoint(t.longitude, t.latitude)::geography,
      ST_MakePoint(p_lng, p_lat)::geography,
      p_radius_m
    )
  ORDER BY ST_MakePoint(t.longitude, t.latitude)::geography
       <-> ST_MakePoint(p_lng, p_lat)::geography
  LIMIT p_limit;
$function$;

GRANT EXECUTE ON FUNCTION public.transit_stops_near(double precision, double precision, double precision, int) TO anon, authenticated, service_role;

-- ============================================================================
-- 5. Extend refresh_perf_matviews() to include mv_crime_city_stats
-- ============================================================================

CREATE OR REPLACE FUNCTION public.refresh_perf_matviews()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  city_ms numeric;
  crime_ms numeric;
  city_stats_ms numeric;
  t0 timestamptz;
BEGIN
  t0 := clock_timestamp();
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_city_avg_score;
  city_ms := EXTRACT(MILLISECONDS FROM clock_timestamp() - t0);

  t0 := clock_timestamp();
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_crime_zip_summary;
  crime_ms := EXTRACT(MILLISECONDS FROM clock_timestamp() - t0);

  t0 := clock_timestamp();
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_crime_city_stats;
  city_stats_ms := EXTRACT(MILLISECONDS FROM clock_timestamp() - t0);

  RETURN jsonb_build_object(
    'mv_city_avg_score_ms', round(city_ms, 0),
    'mv_crime_zip_summary_ms', round(crime_ms, 0),
    'mv_crime_city_stats_ms', round(city_stats_ms, 0),
    'refreshed_at', NOW()
  );
END;
$function$;

-- Round 4 performance: cache hot aggregate RPCs into materialized views.
--
-- pg_stat_statements identified two RPCs burning enormous DB time on
-- queries whose results barely change between calls:
--
--   city_avg_score(p_metro)              2.3M calls × 348ms  = 226 h/month
--   crime_zip_summary(zip, since, metro) 548K calls × ~4000ms = 559 h/month
--
-- Both now read from precomputed materialized views. Same RPC signatures,
-- no application code changes needed.
--
-- Verified via EXPLAIN ANALYZE:
--   city_avg_score('nyc')             348ms   → 2.95ms  (118× faster)
--   crime_zip_summary('10001',NULL,nyc) 5,430ms → 26.7ms (~200× faster)
--
-- A Vercel cron route (/api/cron/refresh-matviews at 3:30 AM UTC) calls
-- public.refresh_perf_matviews() nightly to refresh both views CONCURRENTLY.

-- ============================================================================
-- 1. mv_city_avg_score — 5-row aggregate per metro
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_city_avg_score AS
SELECT
  metro,
  ROUND(AVG(avg_score)::numeric, 2) AS avg_score,
  NOW() AS refreshed_at
FROM public.landlord_stats
WHERE metro IS NOT NULL AND avg_score IS NOT NULL
GROUP BY metro;

CREATE UNIQUE INDEX IF NOT EXISTS mv_city_avg_score_metro_uniq
  ON public.mv_city_avg_score (metro);

CREATE OR REPLACE FUNCTION public.city_avg_score(p_metro text DEFAULT 'nyc'::text)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT avg_score FROM public.mv_city_avg_score WHERE metro = p_metro
  UNION ALL
  -- Fallback: live compute if matview hasn't been refreshed for an unknown metro
  SELECT round(avg(avg_score)::numeric, 2)
  FROM public.landlord_stats
  WHERE metro = p_metro
    AND NOT EXISTS (SELECT 1 FROM public.mv_city_avg_score WHERE metro = p_metro)
  LIMIT 1;
$function$;

-- ============================================================================
-- 2. mv_crime_zip_summary — pre-aggregated counts for default 2-year window
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_crime_zip_summary AS
SELECT
  zip_code,
  metro,
  COUNT(*)::bigint AS total,
  COUNT(*) FILTER (WHERE crime_category = 'violent')::bigint AS violent,
  COUNT(*) FILTER (WHERE crime_category = 'property')::bigint AS property,
  COUNT(*) FILTER (WHERE crime_category = 'quality_of_life')::bigint AS quality_of_life,
  COUNT(*) FILTER (WHERE law_category = 'FELONY')::bigint AS felonies,
  COUNT(*) FILTER (WHERE law_category = 'MISDEMEANOR')::bigint AS misdemeanors,
  COUNT(*) FILTER (WHERE law_category = 'VIOLATION')::bigint AS violations,
  NOW() AS refreshed_at
FROM public.nypd_complaints
WHERE zip_code IS NOT NULL
  AND cmplnt_date >= (CURRENT_DATE - INTERVAL '2 years')
GROUP BY zip_code, metro;

CREATE UNIQUE INDEX IF NOT EXISTS mv_crime_zip_summary_zip_metro_uniq
  ON public.mv_crime_zip_summary (zip_code, metro);

CREATE OR REPLACE FUNCTION public.crime_zip_summary(
  target_zip text,
  since_date date DEFAULT ((CURRENT_DATE - '2 years'::interval))::date,
  metro text DEFAULT NULL::text
)
RETURNS TABLE(total bigint, violent bigint, property bigint, quality_of_life bigint, felonies bigint, misdemeanors bigint, violations bigint)
LANGUAGE plpgsql
STABLE
SET statement_timeout TO '5s'
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  default_since_date date := (CURRENT_DATE - INTERVAL '2 years')::date;
  use_cache boolean;
BEGIN
  -- Treat as cache-eligible when since_date is within ±1 day of the canonical
  -- default (handles client clock skew + daily refresh cadence).
  use_cache := ABS(since_date - default_since_date) <= 1;

  IF use_cache THEN
    RETURN QUERY
    SELECT
      c.total, c.violent, c.property, c.quality_of_life,
      c.felonies, c.misdemeanors, c.violations
    FROM public.mv_crime_zip_summary c
    WHERE c.zip_code = target_zip
      AND (crime_zip_summary.metro IS NULL OR c.metro = crime_zip_summary.metro);

    IF FOUND THEN
      RETURN;
    END IF;
    -- Fall through to live compute if no cached row (new zip code since refresh)
  END IF;

  RETURN QUERY
  SELECT
    COUNT(*)::bigint,
    COUNT(*) FILTER (WHERE nc.crime_category = 'violent')::bigint,
    COUNT(*) FILTER (WHERE nc.crime_category = 'property')::bigint,
    COUNT(*) FILTER (WHERE nc.crime_category = 'quality_of_life')::bigint,
    COUNT(*) FILTER (WHERE nc.law_category = 'FELONY')::bigint,
    COUNT(*) FILTER (WHERE nc.law_category = 'MISDEMEANOR')::bigint,
    COUNT(*) FILTER (WHERE nc.law_category = 'VIOLATION')::bigint
  FROM public.nypd_complaints nc
  WHERE nc.zip_code = crime_zip_summary.target_zip
    AND nc.cmplnt_date >= crime_zip_summary.since_date
    AND (crime_zip_summary.metro IS NULL OR nc.metro = crime_zip_summary.metro);
END;
$function$;

-- ============================================================================
-- 3. Single refresh entrypoint for the Vercel cron route
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
  t0 timestamptz;
BEGIN
  t0 := clock_timestamp();
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_city_avg_score;
  city_ms := EXTRACT(MILLISECONDS FROM clock_timestamp() - t0);

  t0 := clock_timestamp();
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_crime_zip_summary;
  crime_ms := EXTRACT(MILLISECONDS FROM clock_timestamp() - t0);

  RETURN jsonb_build_object(
    'mv_city_avg_score_ms', round(city_ms, 0),
    'mv_crime_zip_summary_ms', round(crime_ms, 0),
    'refreshed_at', NOW()
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.refresh_perf_matviews() TO service_role;

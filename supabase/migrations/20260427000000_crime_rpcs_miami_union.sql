-- ============================================================================
-- Wire Miami into crime_by_zip_cache + restore cache-reading RPCs
-- ============================================================================
-- Background: Miami has only zip-level annual aggregates (miami_crime_aggregates),
-- not incident-level data. The redesigned crime page calls crime_by_zip /
-- crime_zip_yoy RPCs and these read from crime_by_zip_cache for performance.
-- The cache only contained nyc/los-angeles/chicago/houston, so Miami rendered
-- without rankings.
--
-- This migration:
--   1. Inserts Miami rows into crime_by_zip_cache from miami_crime_aggregates
--      (latest year, with prior_year derived via self-join when available).
--   2. Re-asserts the canonical cache-reading RPC bodies (idempotent — these
--      should already match production but are included so the migration file
--      describes the complete contract end-to-end).
-- ============================================================================

-- 1. Populate Miami rows in cache
INSERT INTO crime_by_zip_cache (
  metro, zip_code, borough,
  total, violent, property, quality_of_life,
  current_year_total, prior_year_total,
  current_violent, prior_violent,
  current_property, prior_property,
  refreshed_at
)
SELECT
  'miami' AS metro,
  ma.zip::varchar AS zip_code,
  NULL AS borough,
  ma.total_incidents::bigint AS total,
  ma.violent_count::bigint AS violent,
  ma.property_count::bigint AS property,
  ma.qol_count::bigint AS quality_of_life,
  ma.total_incidents::bigint AS current_year_total,
  COALESCE(prev.total_incidents, 0)::bigint AS prior_year_total,
  ma.violent_count::bigint AS current_violent,
  COALESCE(prev.violent_count, 0)::bigint AS prior_violent,
  ma.property_count::bigint AS current_property,
  COALESCE(prev.property_count, 0)::bigint AS prior_property,
  now() AS refreshed_at
FROM miami_crime_aggregates ma
LEFT JOIN miami_crime_aggregates prev
  ON prev.zip = ma.zip
 AND prev.year = ma.year - 1
WHERE ma.year = (SELECT MAX(year) FROM miami_crime_aggregates)
ON CONFLICT (metro, zip_code) DO UPDATE SET
  total = EXCLUDED.total,
  violent = EXCLUDED.violent,
  property = EXCLUDED.property,
  quality_of_life = EXCLUDED.quality_of_life,
  current_year_total = EXCLUDED.current_year_total,
  prior_year_total = EXCLUDED.prior_year_total,
  current_violent = EXCLUDED.current_violent,
  prior_violent = EXCLUDED.prior_violent,
  current_property = EXCLUDED.current_property,
  prior_property = EXCLUDED.prior_property,
  refreshed_at = EXCLUDED.refreshed_at;

-- 2. crime_by_zip — read from cache (fast, all metros)
CREATE OR REPLACE FUNCTION crime_by_zip(
    since_date date DEFAULT (now() - interval '1 year')::date,
    metro text DEFAULT NULL
)
RETURNS TABLE(
    zip_code varchar(5),
    borough text,
    total bigint,
    violent bigint,
    property bigint,
    quality_of_life bigint
)
LANGUAGE sql STABLE
AS $$
    SELECT
        c.zip_code::varchar(5),
        c.borough,
        c.total,
        c.violent,
        c.property,
        c.quality_of_life
    FROM crime_by_zip_cache c
    WHERE (crime_by_zip.metro IS NULL OR c.metro = crime_by_zip.metro)
    ORDER BY c.total DESC;
$$;

-- 3. crime_zip_yoy — read from cache
-- Note: crime_by_zip_cache does not store current_qol/prior_qol, so they're 0.
CREATE OR REPLACE FUNCTION crime_zip_yoy(
  metro text DEFAULT NULL
)
RETURNS TABLE (
  zip_code varchar,
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
    SELECT
        c.zip_code,
        c.current_year_total,
        c.prior_year_total,
        c.current_violent,
        c.prior_violent,
        c.current_property,
        c.prior_property,
        0::bigint AS current_qol,
        0::bigint AS prior_qol
    FROM crime_by_zip_cache c
    WHERE (crime_zip_yoy.metro IS NULL OR c.metro = crime_zip_yoy.metro);
$$;

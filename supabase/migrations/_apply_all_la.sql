-- ============================================================================
-- COMBINED MIGRATION: All LA multi-city RPCs + RSO support
-- Paste this entire block into the Supabase SQL editor and run it.
-- ============================================================================

-- ============================================================================
-- 1. ENERGY RPCs (multi-city)
-- ============================================================================

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

ALTER TABLE energy_benchmarks ADD COLUMN IF NOT EXISTS apn text;
CREATE INDEX IF NOT EXISTS idx_energy_benchmarks_apn ON energy_benchmarks(apn) WHERE apn IS NOT NULL;

-- ============================================================================
-- 2. PERMIT RPCs (multi-city)
-- ============================================================================

CREATE OR REPLACE FUNCTION permit_stats(p_metro text DEFAULT 'nyc')
RETURNS TABLE(borough text, active_count bigint, top_work_type text)
LANGUAGE sql STABLE AS $$
  SELECT
    COALESCE(b.borough, p.borough) AS borough,
    COUNT(*) AS active_count,
    (
      SELECT p2.work_type
      FROM dob_permits p2
      LEFT JOIN buildings b2 ON b2.id = p2.building_id
      WHERE COALESCE(b2.borough, p2.borough) = COALESCE(b.borough, p.borough)
        AND p2.permit_status = 'Permit Issued'
        AND p2.metro = p_metro
      GROUP BY p2.work_type
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ) AS top_work_type
  FROM dob_permits p
  LEFT JOIN buildings b ON b.id = p.building_id
  WHERE p.permit_status = 'Permit Issued'
    AND p.metro = p_metro
  GROUP BY COALESCE(b.borough, p.borough)
  ORDER BY active_count DESC;
$$;

CREATE OR REPLACE FUNCTION permits_by_zip(p_metro text DEFAULT 'nyc')
RETURNS TABLE(zip_code text, borough text, permit_count bigint)
LANGUAGE sql STABLE AS $$
  SELECT
    p.zip_code,
    COALESCE(b.borough, p.borough) AS borough,
    COUNT(*) AS permit_count
  FROM dob_permits p
  LEFT JOIN buildings b ON b.id = p.building_id
  WHERE p.permit_status = 'Permit Issued'
    AND p.zip_code IS NOT NULL
    AND p.metro = p_metro
  GROUP BY p.zip_code, COALESCE(b.borough, p.borough)
  ORDER BY permit_count DESC;
$$;

CREATE OR REPLACE FUNCTION permits_by_type(p_metro text DEFAULT 'nyc')
RETURNS TABLE(work_type text, active_count bigint, avg_cost numeric)
LANGUAGE sql STABLE AS $$
  SELECT
    p.work_type,
    COUNT(*) AS active_count,
    ROUND(AVG(p.estimated_job_costs), 0) AS avg_cost
  FROM dob_permits p
  WHERE p.permit_status = 'Permit Issued'
    AND p.work_type IS NOT NULL
    AND p.metro = p_metro
  GROUP BY p.work_type
  ORDER BY active_count DESC;
$$;

CREATE OR REPLACE FUNCTION permits_recent(p_metro text DEFAULT 'nyc')
RETURNS TABLE (
  work_permit text,
  house_no text,
  street_name text,
  borough text,
  zip_code text,
  work_type text,
  permit_status text,
  filing_reason text,
  issued_date date,
  expired_date date,
  job_description text,
  estimated_job_costs numeric,
  owner_business_name text,
  building_slug text,
  building_borough text
)
LANGUAGE sql STABLE
AS $$
  SELECT
    p.work_permit,
    p.house_no,
    p.street_name,
    COALESCE(b.borough, p.borough) AS borough,
    p.zip_code,
    p.work_type,
    p.permit_status,
    p.filing_reason,
    p.issued_date,
    p.expired_date,
    p.job_description,
    p.estimated_job_costs,
    p.owner_business_name,
    b.slug AS building_slug,
    b.borough AS building_borough
  FROM dob_permits p
  LEFT JOIN buildings b ON b.id = p.building_id
  WHERE p.permit_status = 'Permit Issued'
    AND p.issued_date >= CURRENT_DATE - INTERVAL '90 days'
    AND p.metro = p_metro
  ORDER BY p.issued_date DESC
  LIMIT 50;
$$;

-- ============================================================================
-- 3. RENT RPCs (multi-city)
-- ============================================================================

CREATE OR REPLACE FUNCTION rent_trend_citywide(p_metro text DEFAULT 'nyc')
RETURNS TABLE(date date, avg_rent numeric)
LANGUAGE sql STABLE AS $$
  SELECT zr.date, ROUND(AVG(zr.median_rent), 0) AS avg_rent
  FROM zillow_rents zr
  JOIN buildings b ON b.zip_code = zr.zip_code AND b.metro = p_metro
  WHERE zr.median_rent IS NOT NULL
    AND zr.metro = p_metro
  GROUP BY zr.date
  ORDER BY zr.date;
$$;

CREATE OR REPLACE FUNCTION rent_trend_by_borough(p_metro text DEFAULT 'nyc')
RETURNS TABLE(borough text, date date, avg_rent numeric)
LANGUAGE sql STABLE AS $$
  SELECT b.borough, zr.date,
         ROUND(AVG(zr.median_rent), 0) AS avg_rent
  FROM zillow_rents zr
  JOIN buildings b ON b.zip_code = zr.zip_code AND b.metro = p_metro
  WHERE zr.median_rent IS NOT NULL
    AND zr.metro = p_metro
  GROUP BY b.borough, zr.date
  ORDER BY b.borough, zr.date;
$$;

CREATE OR REPLACE FUNCTION rent_by_zip_current(p_metro text DEFAULT 'nyc')
RETURNS TABLE(zip_code text, borough text, median_rent numeric, month date)
LANGUAGE sql STABLE AS $$
  SELECT zr.zip_code,
         (SELECT bb.borough FROM buildings bb WHERE bb.zip_code = zr.zip_code AND bb.metro = p_metro LIMIT 1) AS borough,
         zr.median_rent,
         zr.date AS month
  FROM zillow_rents zr
  WHERE zr.date = (SELECT MAX(z2.date) FROM zillow_rents z2 WHERE z2.median_rent IS NOT NULL AND z2.metro = p_metro)
    AND zr.median_rent IS NOT NULL
    AND zr.metro = p_metro
  ORDER BY zr.median_rent DESC;
$$;

-- ============================================================================
-- 4. RSO SUPPORT (LA rent stabilization)
-- ============================================================================

CREATE OR REPLACE FUNCTION rent_stab_borough_stats(p_metro text DEFAULT 'nyc')
RETURNS TABLE(
    borough varchar,
    total_buildings bigint,
    stabilized_buildings bigint,
    total_stabilized_units bigint
)
LANGUAGE sql STABLE
AS $$
    SELECT
        b.borough,
        COUNT(DISTINCT b.id) as total_buildings,
        COUNT(DISTINCT b.id) FILTER (WHERE b.is_rent_stabilized = true) as stabilized_buildings,
        COALESCE(SUM(b.stabilized_units) FILTER (WHERE b.is_rent_stabilized = true), 0) as total_stabilized_units
    FROM buildings b
    WHERE b.borough IS NOT NULL
      AND b.metro = p_metro
    GROUP BY b.borough
    HAVING COUNT(DISTINCT b.id) FILTER (WHERE b.is_rent_stabilized = true) > 0
    ORDER BY total_stabilized_units DESC;
$$;

-- Derive RSO status: pre-1978 buildings with 2+ units
UPDATE buildings
SET
    is_rent_stabilized = true,
    stabilized_units = COALESCE(residential_units, total_units),
    stabilized_year = year_built
WHERE metro = 'los-angeles'
  AND year_built IS NOT NULL
  AND year_built > 0
  AND year_built <= 1978
  AND COALESCE(residential_units, total_units, 0) >= 2
  AND (is_rent_stabilized IS NULL OR is_rent_stabilized = false);

-- Mark non-RSO buildings
UPDATE buildings
SET is_rent_stabilized = false
WHERE metro = 'los-angeles'
  AND is_rent_stabilized IS NULL
  AND (
    (year_built IS NOT NULL AND year_built > 1978)
    OR COALESCE(residential_units, total_units, 0) < 2
  );

-- ============================================================================
-- Dewey Data Integration: RPC functions
-- Migration: 20260401000001_dewey_building_rents_rpc.sql
-- ============================================================================

-- 1. get_building_rent_history
--    Returns monthly rent history for a building, optionally filtered by beds.
CREATE OR REPLACE FUNCTION get_building_rent_history(
  p_building_id uuid,
  p_beds smallint DEFAULT NULL
)
RETURNS TABLE(
  month date,
  beds smallint,
  median_rent numeric,
  min_rent numeric,
  max_rent numeric,
  listing_count integer
)
LANGUAGE sql STABLE
AS $$
  SELECT
    dbr.month,
    dbr.beds,
    dbr.median_rent,
    dbr.min_rent,
    dbr.max_rent,
    dbr.listing_count
  FROM dewey_building_rents dbr
  WHERE dbr.building_id = p_building_id
    AND (p_beds IS NULL OR dbr.beds = p_beds)
  ORDER BY dbr.month, dbr.beds;
$$;

-- 2. get_building_value_score
--    "Rent vs Reality" value score: compares building rent to neighborhood median.
--    Returns the building median, neighborhood median, pct difference, and letter grade.
CREATE OR REPLACE FUNCTION get_building_value_score(p_building_id uuid)
RETURNS TABLE(
  beds smallint,
  building_median numeric,
  neighborhood_median numeric,
  diff_pct numeric,
  grade text
)
LANGUAGE sql STABLE
AS $$
  WITH building_latest AS (
    SELECT
      dbr.beds,
      dbr.median_rent,
      dbr.month
    FROM dewey_building_rents dbr
    WHERE dbr.building_id = p_building_id
      AND dbr.median_rent IS NOT NULL
      AND dbr.month = (
        SELECT MAX(d2.month)
        FROM dewey_building_rents d2
        WHERE d2.building_id = p_building_id
          AND d2.median_rent IS NOT NULL
      )
  ),
  building_zip AS (
    SELECT b.zip_code, b.metro
    FROM buildings b
    WHERE b.id = p_building_id
  ),
  neighborhood_latest AS (
    SELECT
      dnr.beds,
      dnr.median_rent
    FROM dewey_neighborhood_rents dnr
    WHERE dnr.zip = (SELECT zip_code FROM building_zip)
      AND dnr.city = (SELECT metro FROM building_zip)
      AND dnr.median_rent IS NOT NULL
      AND dnr.month = (
        SELECT MAX(d3.month)
        FROM dewey_neighborhood_rents d3
        WHERE d3.zip = (SELECT zip_code FROM building_zip)
          AND d3.city = (SELECT metro FROM building_zip)
          AND d3.median_rent IS NOT NULL
      )
  )
  SELECT
    bl.beds,
    bl.median_rent AS building_median,
    nl.median_rent AS neighborhood_median,
    ROUND(
      ((bl.median_rent - nl.median_rent) / NULLIF(nl.median_rent, 0)) * 100,
      1
    ) AS diff_pct,
    CASE
      WHEN nl.median_rent IS NULL OR nl.median_rent = 0 THEN NULL
      WHEN ((bl.median_rent - nl.median_rent) / nl.median_rent) * 100 <= -15 THEN 'A'
      WHEN ((bl.median_rent - nl.median_rent) / nl.median_rent) * 100 <= -5  THEN 'B'
      WHEN ((bl.median_rent - nl.median_rent) / nl.median_rent) * 100 <= 5   THEN 'C'
      WHEN ((bl.median_rent - nl.median_rent) / nl.median_rent) * 100 <= 15  THEN 'D'
      ELSE 'F'
    END AS grade
  FROM building_latest bl
  LEFT JOIN neighborhood_latest nl ON nl.beds = bl.beds
  ORDER BY bl.beds;
$$;

-- 3. get_neighborhood_rent_trends
--    Monthly rent trends for a neighborhood/zip, optionally filtered by beds.
CREATE OR REPLACE FUNCTION get_neighborhood_rent_trends(
  p_city text,
  p_zip text,
  p_beds smallint DEFAULT NULL
)
RETURNS TABLE(
  month date,
  beds smallint,
  median_rent numeric,
  p25_rent numeric,
  p75_rent numeric,
  listing_count integer
)
LANGUAGE sql STABLE
AS $$
  SELECT
    dnr.month,
    dnr.beds,
    dnr.median_rent,
    dnr.p25_rent,
    dnr.p75_rent,
    dnr.listing_count
  FROM dewey_neighborhood_rents dnr
  WHERE dnr.city = p_city
    AND dnr.zip = p_zip
    AND (p_beds IS NULL OR dnr.beds = p_beds)
  ORDER BY dnr.month, dnr.beds;
$$;

-- 4. get_seasonal_rent_index
--    Returns the 12-month seasonal pattern for a city, optionally by zip and beds.
CREATE OR REPLACE FUNCTION get_seasonal_rent_index(
  p_city text,
  p_zip text DEFAULT NULL,
  p_beds smallint DEFAULT NULL
)
RETURNS TABLE(
  month_of_year smallint,
  beds smallint,
  rent_index numeric,
  sample_years integer
)
LANGUAGE sql STABLE
AS $$
  SELECT
    dsi.month_of_year,
    dsi.beds,
    dsi.rent_index,
    dsi.sample_years
  FROM dewey_seasonal_index dsi
  WHERE dsi.city = p_city
    AND (p_zip IS NULL OR dsi.zip = p_zip)
    AND (p_beds IS NULL OR dsi.beds = p_beds)
  ORDER BY dsi.beds, dsi.month_of_year;
$$;

-- 5. get_amenity_premiums
--    Returns amenity premiums for a city, optionally narrowed to a zip.
CREATE OR REPLACE FUNCTION get_amenity_premiums(
  p_city text,
  p_zip text DEFAULT NULL
)
RETURNS TABLE(
  amenity text,
  beds smallint,
  median_with numeric,
  median_without numeric,
  premium_pct numeric,
  premium_dollars numeric,
  sample_size integer,
  period text
)
LANGUAGE sql STABLE
AS $$
  SELECT
    dap.amenity,
    dap.beds,
    dap.median_with,
    dap.median_without,
    dap.premium_pct,
    dap.premium_dollars,
    dap.sample_size,
    dap.period
  FROM dewey_amenity_premiums dap
  WHERE dap.city = p_city
    AND (p_zip IS NULL OR dap.zip = p_zip)
  ORDER BY dap.amenity, dap.beds, dap.period;
$$;

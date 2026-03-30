-- ============================================================================
-- Fix rent RPCs: drop conflicting zero-arg overloads, rewrite to avoid
-- expensive JOIN with buildings table (was causing statement timeouts via
-- PostgREST anon role). Use zillow_rents.borough directly instead.
-- Also normalize NYC borough names in buildings table.
-- ============================================================================

-- Drop old zero-arg overloads (the p_metro versions with DEFAULT 'nyc' remain)
DROP FUNCTION IF EXISTS rent_trend_citywide();
DROP FUNCTION IF EXISTS rent_trend_by_borough();
DROP FUNCTION IF EXISTS rent_by_zip_current();

-- Normalize NYC borough casing in buildings table
UPDATE buildings SET borough = 'Brooklyn' WHERE borough = 'BROOKLYN' AND metro = 'nyc';
UPDATE buildings SET borough = 'Queens' WHERE borough = 'QUEENS' AND metro = 'nyc';
UPDATE buildings SET borough = 'Bronx' WHERE borough IN ('BRONX', 'The Bronx') AND metro = 'nyc';
UPDATE buildings SET borough = 'Manhattan' WHERE borough IN ('MANHATTAN', 'New York') AND metro = 'nyc';
UPDATE buildings SET borough = 'Staten Island' WHERE borough IN ('STATEN ISLAND', 'Richmond') AND metro = 'nyc';

-- Rewrite RPCs to use zillow_rents columns directly (no buildings JOIN)
CREATE OR REPLACE FUNCTION rent_trend_citywide(p_metro text DEFAULT 'nyc')
RETURNS TABLE(date date, avg_rent numeric)
LANGUAGE sql STABLE AS $$
  SELECT zr.date, ROUND(AVG(zr.median_rent), 0) AS avg_rent
  FROM zillow_rents zr
  WHERE zr.metro = p_metro
    AND zr.median_rent IS NOT NULL
  GROUP BY zr.date
  ORDER BY zr.date;
$$;

CREATE OR REPLACE FUNCTION rent_trend_by_borough(p_metro text DEFAULT 'nyc')
RETURNS TABLE(borough text, date date, avg_rent numeric)
LANGUAGE sql STABLE AS $$
  SELECT zr.borough, zr.date,
         ROUND(AVG(zr.median_rent), 0) AS avg_rent
  FROM zillow_rents zr
  WHERE zr.metro = p_metro
    AND zr.median_rent IS NOT NULL
    AND zr.borough IS NOT NULL AND zr.borough != ''
  GROUP BY zr.borough, zr.date
  ORDER BY zr.borough, zr.date;
$$;

CREATE OR REPLACE FUNCTION rent_by_zip_current(p_metro text DEFAULT 'nyc')
RETURNS TABLE(zip_code text, borough text, median_rent numeric, month date)
LANGUAGE sql STABLE AS $$
  SELECT zr.zip_code,
         zr.borough,
         zr.median_rent,
         zr.date AS month
  FROM zillow_rents zr
  WHERE zr.date = (SELECT MAX(z2.date) FROM zillow_rents z2 WHERE z2.median_rent IS NOT NULL AND z2.metro = p_metro)
    AND zr.median_rent IS NOT NULL
    AND zr.metro = p_metro
  ORDER BY zr.median_rent DESC;
$$;

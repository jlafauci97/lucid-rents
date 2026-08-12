-- ============================================================================
-- Multi-city rent RPCs: add p_metro parameter to filter by metro area
-- ============================================================================

-- RPC: Citywide rent trend filtered by metro
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

-- RPC: Rent trend by borough/area filtered by metro
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

-- RPC: Current median rent by zip code filtered by metro
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

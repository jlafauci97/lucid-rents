-- Pre-computed neighborhood median rents table.
-- Replaces the expensive get_neighborhood_median_rents RPC that joined
-- building_rents with buildings on every building page view (30-60s under load).
-- Now reads from this table in <1ms.

CREATE TABLE IF NOT EXISTS neighborhood_median_rents (
  zip_code text NOT NULL,
  bedrooms smallint NOT NULL,
  median_rent numeric NOT NULL,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (zip_code, bedrooms)
);

-- Rewrite RPC to read from pre-computed table
DROP FUNCTION IF EXISTS get_neighborhood_median_rents(text, uuid);

CREATE OR REPLACE FUNCTION get_neighborhood_median_rents(p_zip text, p_exclude_building uuid)
RETURNS TABLE(bedrooms smallint, median_rent numeric) AS $$
  SELECT n.bedrooms, n.median_rent
  FROM neighborhood_median_rents n
  WHERE n.zip_code = p_zip;
$$ LANGUAGE sql STABLE;

-- Refresh function called by /api/cron/refresh-stats
CREATE OR REPLACE FUNCTION refresh_neighborhood_median_rents()
RETURNS void AS $$
BEGIN
  INSERT INTO neighborhood_median_rents (zip_code, bedrooms, median_rent)
  SELECT b.zip_code, br.bedrooms,
         percentile_cont(0.5) WITHIN GROUP (ORDER BY br.median_rent)::numeric
  FROM building_rents br
  JOIN buildings b ON b.id = br.building_id
  WHERE br.median_rent > 0 AND b.zip_code IS NOT NULL
  GROUP BY b.zip_code, br.bedrooms
  ON CONFLICT (zip_code, bedrooms) DO UPDATE SET
    median_rent = EXCLUDED.median_rent, updated_at = now();
END;
$$ LANGUAGE plpgsql;

-- Set statement timeout on authenticator role to prevent pool saturation
ALTER ROLE authenticator SET statement_timeout = '5s';

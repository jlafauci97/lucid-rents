-- Run this after the BBL backfill completes to populate neighborhood_median_rents.
-- Can also be called periodically to refresh.
-- Runs as a single INSERT ... ON CONFLICT UPSERT.

SET statement_timeout = '600s';

INSERT INTO neighborhood_median_rents (zip_code, bedrooms, median_rent)
SELECT
  b.zip_code,
  br.bedrooms,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY br.median_rent)::numeric
FROM building_rents br
JOIN buildings b ON b.id = br.building_id
WHERE br.median_rent > 0 AND b.zip_code IS NOT NULL
GROUP BY b.zip_code, br.bedrooms
ON CONFLICT (zip_code, bedrooms) DO UPDATE SET
  median_rent = EXCLUDED.median_rent,
  updated_at = now();

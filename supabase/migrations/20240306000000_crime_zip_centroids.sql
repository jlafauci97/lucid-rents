-- ============================================================================
-- NYC Zip Code Centroids + Crime Zip Backfill Function
-- Derives zip codes for NYPD complaints from lat/lon using nearest centroid
-- Migration: 20240306000000_crime_zip_centroids.sql
-- ============================================================================

-- --------------------------------------------------------------------------
-- nyc_zip_centroids — average lat/lon per NYC zip code
-- Populated from complaints_311 joined with buildings
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nyc_zip_centroids (
    zip_code    varchar(5) PRIMARY KEY,
    avg_lat     numeric,
    avg_lon     numeric,
    sample_count integer
);

-- Populate from existing 311 complaint + building data
INSERT INTO nyc_zip_centroids (zip_code, avg_lat, avg_lon, sample_count)
SELECT
    b.zip_code,
    AVG(c.latitude) AS avg_lat,
    AVG(c.longitude) AS avg_lon,
    COUNT(*) AS sample_count
FROM complaints_311 c
JOIN buildings b ON b.id = c.building_id
WHERE c.latitude IS NOT NULL
  AND c.longitude IS NOT NULL
  AND b.zip_code IS NOT NULL
  AND b.zip_code != ''
GROUP BY b.zip_code
HAVING COUNT(*) >= 5
ON CONFLICT (zip_code) DO NOTHING;

-- --------------------------------------------------------------------------
-- RPC: backfill_crime_zip_codes
-- Updates nypd_complaints where zip_code IS NULL and lat/lon exist
-- Assigns nearest centroid zip code
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION backfill_crime_zip_codes()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    updated_count integer;
BEGIN
    UPDATE nypd_complaints nc
    SET zip_code = nearest.zip_code
    FROM (
        SELECT DISTINCT ON (nc2.id)
            nc2.id,
            z.zip_code
        FROM nypd_complaints nc2
        CROSS JOIN nyc_zip_centroids z
        WHERE nc2.zip_code IS NULL
          AND nc2.latitude IS NOT NULL
          AND nc2.longitude IS NOT NULL
        ORDER BY nc2.id,
            (nc2.latitude - z.avg_lat)^2 + (nc2.longitude - z.avg_lon)^2 ASC
    ) nearest
    WHERE nc.id = nearest.id;

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$;

-- Auto-fill buildings.zip_code from the nearest zip_centroid on insert/update
-- when zip_code is null but lat/lng/metro are present. Prevents the
-- "null zip silently breaks neighborhood-keyed queries" failure mode that
-- bit us after #260 (sitemaps, NMR card, crime, demographics).

CREATE OR REPLACE FUNCTION infer_zip_from_centroid(
  p_metro text,
  p_lat double precision,
  p_lon double precision
) RETURNS varchar AS $$
  SELECT zip_code
  FROM zip_centroids
  WHERE metro = p_metro
  ORDER BY (avg_lat::float8 - p_lat) * (avg_lat::float8 - p_lat)
         + (avg_lon::float8 - p_lon) * (avg_lon::float8 - p_lon)
  LIMIT 1;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION buildings_fill_zip_from_centroid()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.zip_code IS NULL
     AND NEW.latitude IS NOT NULL
     AND NEW.longitude IS NOT NULL
     AND NEW.metro IS NOT NULL
  THEN
    NEW.zip_code := infer_zip_from_centroid(
      NEW.metro,
      NEW.latitude::float8,
      NEW.longitude::float8
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS buildings_fill_zip_from_centroid_trg ON buildings;
CREATE TRIGGER buildings_fill_zip_from_centroid_trg
  BEFORE INSERT OR UPDATE OF latitude, longitude, zip_code, metro
  ON buildings
  FOR EACH ROW
  EXECUTE FUNCTION buildings_fill_zip_from_centroid();

CREATE INDEX IF NOT EXISTS zip_centroids_metro_idx ON zip_centroids(metro);

-- Helper RPC for the one-shot backfill script. Splits the catch-up update
-- into ~2K-row batches because the buildings table has expression indexes
-- (idx_buildings_*_norm on normalize_street) that push larger updates past
-- Supabase's statement timeout.
CREATE OR REPLACE FUNCTION backfill_zip_centroid_batch(p_metro text, p_limit int)
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  v_count int;
BEGIN
  WITH batch AS (
    SELECT id FROM buildings
    WHERE metro = p_metro
      AND zip_code IS NULL
      AND latitude IS NOT NULL
      AND longitude IS NOT NULL
    ORDER BY id
    LIMIT p_limit
  ), updated AS (
    UPDATE buildings b SET zip_code = (
      SELECT zc.zip_code FROM zip_centroids zc WHERE zc.metro = b.metro
      ORDER BY (zc.avg_lat::float8 - b.latitude::float8) * (zc.avg_lat::float8 - b.latitude::float8)
             + (zc.avg_lon::float8 - b.longitude::float8) * (zc.avg_lon::float8 - b.longitude::float8)
      LIMIT 1)
    FROM batch WHERE b.id = batch.id
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM updated;
  RETURN v_count;
END;
$$;

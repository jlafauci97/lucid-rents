-- supabase/migrations/20260520100100_sex_offender_restricted.sql

CREATE TABLE IF NOT EXISTS sex_offender_locations_restricted (
  id BIGSERIAL PRIMARY KEY,
  metro TEXT NOT NULL,
  level INT NOT NULL CHECK (level IN (2, 3)),
  geom geometry(Point, 4326) NOT NULL,
  source TEXT NOT NULL DEFAULT 'nys_dcjs',
  source_record_id TEXT NOT NULL,
  last_synced TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT sex_offender_unique UNIQUE (source, source_record_id)
);

CREATE INDEX IF NOT EXISTS sex_offender_geom_gist
  ON sex_offender_locations_restricted USING GIST (geom);

ALTER TABLE sex_offender_locations_restricted ENABLE ROW LEVEL SECURITY;
-- No SELECT policies — service role only writes, RPC only reads counts.

CREATE OR REPLACE FUNCTION count_sex_offenders_near(
  lat double precision,
  lng double precision,
  radius_meters int DEFAULT 1207
) RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT count(*)::int
  FROM sex_offender_locations_restricted
  WHERE ST_DWithin(
    geom::geography,
    ST_MakePoint(lng, lat)::geography,
    radius_meters
  );
$$;

REVOKE ALL ON FUNCTION count_sex_offenders_near FROM PUBLIC;
GRANT EXECUTE ON FUNCTION count_sex_offenders_near TO anon, authenticated;

COMMENT ON FUNCTION count_sex_offenders_near IS 'Returns count of registered offenders within radius. Never exposes individual records.';

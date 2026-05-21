-- supabase/migrations/20260520100000_nearby_concerns.sql

CREATE TABLE IF NOT EXISTS nearby_concerns (
  id BIGSERIAL PRIMARY KEY,
  metro TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('public_safety', 'noise', 'environmental')),
  -- Section D ('block_level') is NOT stored here — derived live from nyc_311, hpd_bedbugs, dohmh_rats.
  sub_category TEXT NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  borough TEXT,
  neighborhood TEXT,
  geom geometry(Point, 4326) NOT NULL,
  lat NUMERIC(10, 7),
  lng NUMERIC(10, 7),
  source TEXT NOT NULL,
  source_url TEXT,
  source_record_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_synced TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT nearby_concerns_unique_source UNIQUE (source, source_record_id)
);

CREATE INDEX IF NOT EXISTS nearby_concerns_geom_gist ON nearby_concerns USING GIST (geom);
CREATE INDEX IF NOT EXISTS nearby_concerns_metro_active_idx ON nearby_concerns (metro, active);
CREATE INDEX IF NOT EXISTS nearby_concerns_cat_idx
  ON nearby_concerns (metro, category, sub_category)
  WHERE active = TRUE;

COMMENT ON TABLE nearby_concerns IS 'Unified POI table for Neighborhood Risks tenant tool';
COMMENT ON COLUMN nearby_concerns.source IS 'Logical source key, e.g. nyc_open_data_dhs_dropin, coalition_for_homeless';
COMMENT ON COLUMN nearby_concerns.source_record_id IS 'Stable upstream ID for upserts';

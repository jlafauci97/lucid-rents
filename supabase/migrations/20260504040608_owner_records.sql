-- ============================================================================
-- Owner backfill: corporate ownership records
-- ============================================================================
-- Adds owner_type classification to buildings + a per-parcel ownership history
-- table sourced from county assessor data. Pipeline only inserts records where
-- the owner is a company (individual records are dropped because the upstream
-- assessor data only provides last names for individuals).
--
-- Already applied to production (recorded as version 20260504040608); this
-- file was recovered from supabase_migrations.schema_migrations so the
-- migration chain matches the live schema. A draft of this migration
-- previously sat untracked as 20260503000000_owner_records.sql — the version
-- here is the one prod recorded, so `db push` treats it as applied.
-- ============================================================================

ALTER TABLE buildings
  ADD COLUMN IF NOT EXISTS owner_type text
  CHECK (owner_type IS NULL OR owner_type IN ('company', 'individual', 'unknown'));

CREATE INDEX IF NOT EXISTS idx_buildings_owner_type
  ON buildings(owner_type) WHERE owner_type IS NOT NULL;

-- One row per parcel-year. Provenance kept via source_record_id so reruns
-- upsert cleanly. Mailing-address columns power LLC clustering downstream.
CREATE TABLE IF NOT EXISTS building_ownership_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  source_record_id text NOT NULL,
  assessment_year smallint NOT NULL,
  parcel_id text,
  owner_name text NOT NULL,
  owner_type text NOT NULL CHECK (owner_type IN ('company', 'individual')),
  owner_mailing_address text,
  owner_mailing_city text,
  owner_mailing_state text,
  owner_mailing_zip text,
  last_sale_date date,
  last_sale_price numeric(14, 2),
  assessed_value numeric(14, 2),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_record_id, assessment_year)
);

CREATE INDEX IF NOT EXISTS idx_bor_building ON building_ownership_records(building_id);
CREATE INDEX IF NOT EXISTS idx_bor_owner_name ON building_ownership_records(owner_name);
CREATE INDEX IF NOT EXISTS idx_bor_mailing
  ON building_ownership_records(owner_mailing_zip, owner_mailing_address)
  WHERE owner_mailing_address IS NOT NULL;

ALTER TABLE building_ownership_records ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Public read building_ownership_records"
    ON building_ownership_records FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

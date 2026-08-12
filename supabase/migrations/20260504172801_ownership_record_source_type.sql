-- ============================================================================
-- Ownership records: source_type + recording_date
-- ============================================================================
-- Distinguishes assessor-roll rows from other record sources (e.g. deed
-- recordings) and stamps when the source document was recorded.
--
-- Already applied to production (recorded as version 20260504172801); this
-- file was recovered from supabase_migrations.schema_migrations — it had
-- never been committed to the repo, leaving the migration chain unable to
-- reproduce the live schema.
-- ============================================================================

ALTER TABLE building_ownership_records
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'assessor',
  ADD COLUMN IF NOT EXISTS recording_date date;

CREATE INDEX IF NOT EXISTS idx_bor_source_type
  ON building_ownership_records(source_type);

CREATE INDEX IF NOT EXISTS idx_bor_recording_date
  ON building_ownership_records(recording_date)
  WHERE recording_date IS NOT NULL;

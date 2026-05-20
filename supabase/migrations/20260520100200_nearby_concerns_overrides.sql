-- supabase/migrations/20260520100200_nearby_concerns_overrides.sql

CREATE TABLE IF NOT EXISTS nearby_concerns_overrides (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  source_record_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('hide', 'rename', 'reclassify')),
  new_name TEXT,
  new_category TEXT,
  new_sub_category TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT nearby_concerns_overrides_unique UNIQUE (source, source_record_id)
);

COMMENT ON TABLE nearby_concerns_overrides IS 'Admin escape hatch for hiding or fixing nearby_concerns rows without rewriting the sync.';

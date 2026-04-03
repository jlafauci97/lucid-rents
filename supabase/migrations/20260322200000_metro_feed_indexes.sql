-- Composite indexes for the activity feed queries: metro + date DESC
-- These prevent timeouts on large tables (673K+ complaints, 28K+ violations)
CREATE INDEX IF NOT EXISTS idx_hpd_violations_metro_date
  ON hpd_violations (metro, inspection_date DESC)
  WHERE building_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_complaints_311_metro_date
  ON complaints_311 (metro, created_date DESC)
  WHERE building_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dob_violations_metro_date
  ON dob_violations (metro, issue_date DESC)
  WHERE building_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reviews_metro_date
  ON reviews (metro, created_at DESC)
  WHERE building_id IS NOT NULL;

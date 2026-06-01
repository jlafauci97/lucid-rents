-- Activity feed cold-path index for dob_violations.
--
-- The /api/activity `filter=all` (no-metro, homepage) feed orders dob_violations
-- by issue_date and keeps only building-linked rows. The existing
-- idx_dob_violations_issue_date (full, non-partial) forced the ORDER BY
-- issue_date DESC LIMIT n walk to scan past unlinked rows (building_id IS NULL),
-- costing ~5s on a cold cache and contributing to /api/activity tripping the
-- serverless 30s timeout (504). This partial index contains only linked rows in
-- date order, so the walk is tight — warm latency dropped 13ms -> 0.3ms.
--
-- Already applied to production via CREATE INDEX CONCURRENTLY (online,
-- non-blocking). IF NOT EXISTS keeps this migration a no-op there; on a fresh
-- database it builds instantly against an empty table.
CREATE INDEX IF NOT EXISTS idx_dob_violations_feed_recent
  ON dob_violations (issue_date DESC)
  WHERE building_id IS NOT NULL;

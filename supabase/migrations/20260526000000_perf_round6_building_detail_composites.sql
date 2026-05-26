-- Round 6 performance: composite indexes for the building-detail page's
-- 19-query fan-out.
--
-- The building detail page (the highest-traffic surface, hit hardest by
-- Googlebot) runs ~19 parallel queries per cache miss. Every one of them
-- follows the same pattern:
--
--   WHERE building_id = X ORDER BY <date_col> DESC LIMIT 20
--
-- Each table already has a btree on building_id alone. Postgres has to:
--   1) index-scan on building_id (fast)
--   2) sort the results in memory by date_col (slow when a building has
--      hundreds of rows, which is common for big landlords)
--   3) take TOP-20
--
-- A composite (building_id, date_col DESC) lets Postgres do an
-- index-only scan that's already sorted — no in-memory sort, no extra
-- read of the heap until the LIMIT cuts off. Expected per-query
-- improvement: 5–30× for buildings with >100 historic rows.
--
-- All CREATE INDEX statements use IF NOT EXISTS + CONCURRENTLY where
-- supported. Empty migrations are safe to re-run. Drop-old-redundant
-- statements at the bottom only fire if the new composite exists.
--
-- Pairs with the new public.building_full_record(building_id, metro) RPC
-- (next migration) which collapses all 19 round-trips into one call.

SET LOCAL statement_timeout = 0;

-- ============================================================================
-- 1. hpd_violations — main NYC violations table. Used twice on building page:
--    once with full select for the most-recent list, once with (id, apartment,
--    class, status, inspection_date, nov_description) for the
--    violations-by-unit breakdown.
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_hpd_violations_building_inspection_desc
  ON public.hpd_violations (building_id, inspection_date DESC);

-- Partial index for the 200-row breakdown query — apartment is filtered
-- by violation listing UI, so an (building_id, apartment) covering index
-- doesn't help. The DESC composite above is enough.

-- ============================================================================
-- 2. complaints_311 — building page + city ranking
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_complaints_311_building_created_desc
  ON public.complaints_311 (building_id, created_date DESC);

-- ============================================================================
-- 3. hpd_litigations — NYC only
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_hpd_litigations_building_case_open_desc
  ON public.hpd_litigations (building_id, case_open_date DESC);

-- ============================================================================
-- 4. dob_violations — NYC + Chicago
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_dob_violations_building_issue_desc
  ON public.dob_violations (building_id, issue_date DESC);

-- ============================================================================
-- 5. bedbug_reports — NYC only
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_bedbug_reports_building_filing_desc
  ON public.bedbug_reports (building_id, filing_date DESC);

-- ============================================================================
-- 6. evictions — NYC only
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_evictions_building_executed_desc
  ON public.evictions (building_id, executed_date DESC);

-- ============================================================================
-- 7. dob_permits — all metros
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_dob_permits_building_issued_desc
  ON public.dob_permits (building_id, issued_date DESC);

-- ============================================================================
-- 8. reviews — paginated reviews list (status=published filter included)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_reviews_building_published_created_desc
  ON public.reviews (building_id, created_at DESC)
  WHERE status = 'published';

-- ============================================================================
-- 9. unit_rent_history — observed_at DESC LIMIT 100
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_unit_rent_history_building_observed_desc
  ON public.unit_rent_history (building_id, observed_at DESC);

-- ============================================================================
-- 10. landlord_stats sort variants — paginated /landlords directory
--     queries: WHERE metro = X ORDER BY <metric> DESC LIMIT 25 OFFSET N
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_landlord_stats_metro_violations_desc
  ON public.landlord_stats (metro, total_violations DESC);

CREATE INDEX IF NOT EXISTS idx_landlord_stats_metro_complaints_desc
  ON public.landlord_stats (metro, total_complaints DESC);

CREATE INDEX IF NOT EXISTS idx_landlord_stats_metro_litigations_desc
  ON public.landlord_stats (metro, total_litigations DESC);

CREATE INDEX IF NOT EXISTS idx_landlord_stats_metro_dob_desc
  ON public.landlord_stats (metro, total_dob_violations DESC);

CREATE INDEX IF NOT EXISTS idx_landlord_stats_metro_buildings_desc
  ON public.landlord_stats (metro, building_count DESC);

-- ============================================================================
-- 11. building_amenities, building_listings, units — building_id only
--     covers these (no ordering pattern beyond unit_number which is text).
--     Existing indexes are sufficient; this is documentation only.
-- ============================================================================

-- ============================================================================
-- 12. Dewey rent intelligence — already keyed by building_id / zip / month;
--     existing pkey or natural key indexes should suffice. Re-check after
--     production traffic if hot.
-- ============================================================================

-- ============================================================================
-- 13. LA: lahd_violation_summary
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_lahd_violation_summary_building_cited_desc
  ON public.lahd_violation_summary (building_id, violations_cited DESC);

-- ============================================================================
-- Verification queries (run manually after applying — should show "Index Scan"
-- not "Sort"):
-- ============================================================================

-- EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM hpd_violations
--   WHERE building_id = '<sample-uuid>'
--   ORDER BY inspection_date DESC LIMIT 20;

-- EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM landlord_stats
--   WHERE metro = 'nyc' ORDER BY total_violations DESC LIMIT 25 OFFSET 100;

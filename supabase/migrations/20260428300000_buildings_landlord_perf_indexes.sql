-- Performance indexes for /[city]/building-rankings and /[city]/landlords
--
-- These pages page across the buildings table (~640K NYC, ~250K-480K
-- elsewhere) ordering by various denormalized count columns. Without
-- composite indexes, ORDER BY ... DESC + filter on a non-violation_count
-- column hits the anon role's 3s statement timeout and the page's
-- "directory" section had to fall back to re-sorting a cached top-200
-- pool in app code (capping non-violations sorts at page 8).
--
-- These partial indexes (WHERE col > 0) are tiny relative to the table
-- because most rows have 0 in these columns, and they let the planner
-- do an indexed range scan instead of a full sort.

-- ─── buildings table ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_buildings_metro_complaints
  ON buildings (metro, complaint_count DESC NULLS LAST)
  WHERE complaint_count > 0;

CREATE INDEX IF NOT EXISTS idx_buildings_metro_evictions
  ON buildings (metro, eviction_count DESC NULLS LAST)
  WHERE eviction_count > 0;

CREATE INDEX IF NOT EXISTS idx_buildings_metro_litigation
  ON buildings (metro, litigation_count DESC NULLS LAST)
  WHERE litigation_count > 0;

CREATE INDEX IF NOT EXISTS idx_buildings_metro_bedbug
  ON buildings (metro, bedbug_report_count DESC NULLS LAST)
  WHERE bedbug_report_count > 0;

CREATE INDEX IF NOT EXISTS idx_buildings_metro_lead
  ON buildings (metro, lead_violation_count DESC NULLS LAST)
  WHERE lead_violation_count > 0;

-- For the "tenant favorites" section: ordered top-rated buildings with
-- enough reviews. Without this, the favorites query was timing out.
CREATE INDEX IF NOT EXISTS idx_buildings_metro_score
  ON buildings (metro, overall_score DESC NULLS LAST, review_count DESC NULLS LAST)
  WHERE overall_score > 0 AND review_count > 5;

-- For the per-borough breakdown — composite (metro, borough, violations)
-- so the per-borough top-3 queries don't have to scan the full city.
CREATE INDEX IF NOT EXISTS idx_buildings_metro_borough_violations
  ON buildings (metro, borough, violation_count DESC NULLS LAST)
  WHERE violation_count > 0;

-- ─── landlord_stats_canonical (the deduped rollup the landlords page
-- queries against — same fields as landlord_stats but rolled up) ─────
CREATE INDEX IF NOT EXISTS idx_landlord_canon_metro_complaints
  ON landlord_stats_canonical (metro, total_complaints DESC NULLS LAST)
  WHERE total_complaints > 0;

CREATE INDEX IF NOT EXISTS idx_landlord_canon_metro_litigations
  ON landlord_stats_canonical (metro, total_litigations DESC NULLS LAST)
  WHERE total_litigations > 0;

CREATE INDEX IF NOT EXISTS idx_landlord_canon_metro_dob
  ON landlord_stats_canonical (metro, total_dob_violations DESC NULLS LAST)
  WHERE total_dob_violations > 0;

CREATE INDEX IF NOT EXISTS idx_landlord_canon_metro_buildings
  ON landlord_stats_canonical (metro, building_count DESC NULLS LAST)
  WHERE building_count > 0;

-- Search support — name ilike for the autocomplete in /landlords
CREATE INDEX IF NOT EXISTS idx_landlord_canon_metro_name_lower
  ON landlord_stats_canonical (metro, lower(name));

-- ─── refresh planner stats so count: 'estimated' returns sane values
-- for every metro instead of 0. This was the reason BUILDINGS_FLOOR
-- hardcoded fallback existed in /[city]/building-rankings/page.tsx.
ANALYZE buildings;
ANALYZE landlord_stats_canonical;

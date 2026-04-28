-- ============================================================================
-- landlord_311_summary — public-read RLS + perf-tuned RPC (2026-04-28)
--
-- Follow-up to 20260428000000_landlord_311_summary.sql. The matview-style
-- migration in that file was simplified in production into a regular table
-- (`landlord_311_summary`) populated per-metro by `refresh_landlord_311_for_metro`
-- so that the rebuild can run inside Supabase's MCP/HTTP timeout windows.
--
-- That left two real bugs the original migration didn't cover:
--
-- 1. RLS was enabled on the table by default but no SELECT policy existed,
--    so `get_top_landlords_by_311` (running with the caller's privileges)
--    returned [] for anon. The /[city]/landlords page silently fell back
--    to stale `landlord_stats.total_complaints`.
--
-- 2. The first cut of the RPC LEFT JOINed against a deduped CTE over
--    landlord_stats, which Postgres materialized fully (~639K rows for NYC,
--    ~85K for LA) before the join — 4.5s end-to-end, well past anon's 3s
--    statement timeout, so NYC + LA returned 500.
--
-- This migration:
--   - Adds a permissive SELECT policy (table is a pure aggregate of public
--     records — no PII).
--   - Adds a functional index on `(metro, UPPER(TRIM(name)))` over
--     landlord_stats so cross-table name lookups can use an index.
--   - Replaces `get_top_landlords_by_311` with a two-stage form: pull top-N
--     from landlord_311_summary first (uses landlord_311_summary_metro_count_idx),
--     then attach `slug` via a correlated subquery that uses the new
--     functional index. NYC drops 4585ms → 171ms.
-- ============================================================================

-- ── 1. Public read on the rollup ────────────────────────────────────────────
DROP POLICY IF EXISTS "public read landlord_311_summary" ON landlord_311_summary;

CREATE POLICY "public read landlord_311_summary"
  ON landlord_311_summary
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- ── 2. Functional index for cross-table name matching ──────────────────────
-- landlord_stats.name has mixed casing ("Williams" + "WILLIAMS") so a plain
-- (name, metro) btree can't satisfy `UPPER(TRIM(name)) = X`. ~940K rows
-- total → ~30 MB index.
CREATE INDEX IF NOT EXISTS idx_landlord_stats_norm_name_metro
  ON landlord_stats (metro, (UPPER(TRIM(name))));

-- ── 3. Perf-tuned RPC ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_top_landlords_by_311(
  p_limit int DEFAULT 3,
  p_metro text DEFAULT 'nyc'
)
RETURNS TABLE (
  name             text,
  building_count   int,
  complaint_count  bigint,
  slug             text
)
LANGUAGE sql
STABLE
AS $$
  WITH top AS (
    SELECT s.name, s.building_count, s.complaint_count, s.metro
    FROM landlord_311_summary s
    WHERE s.metro = p_metro
    ORDER BY s.complaint_count DESC
    LIMIT p_limit
  )
  SELECT
    t.name,
    t.building_count,
    t.complaint_count,
    (
      SELECT ls.slug
      FROM landlord_stats ls
      WHERE ls.metro = t.metro
        AND UPPER(TRIM(ls.name)) = UPPER(TRIM(t.name))
      ORDER BY ls.building_count DESC NULLS LAST
      LIMIT 1
    ) AS slug
  FROM top t
  ORDER BY t.complaint_count DESC;
$$;

GRANT EXECUTE ON FUNCTION get_top_landlords_by_311(int, text) TO anon, authenticated;

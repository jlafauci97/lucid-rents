-- ============================================================================
-- Landlord-level 311 aggregates (2026-04-28)
--
-- Problem: complaints_311_X tables are huge (NYC alone is ~16M rows). Live
-- aggregation per-landlord exceeds the anon role's 3s statement timeout, so
-- the /[city]/landlords ranking page can't compute "Most 311 complaints"
-- on demand. landlord_stats.total_complaints is also stale (rebuilt only
-- when scripts/build-landlord-stats.mjs runs, which lags behind 311 ETL).
--
-- Fix: pre-aggregate 311 → buildings → owner into a materialized view that
-- the ranking RPC can read in <50ms. Refresh nightly via pg_cron so it
-- always reflects the latest 311 imports.
--
-- Apply via Supabase SQL editor (NOT the MCP tool — it has a 60s timeout
-- and the initial matview build takes 2-5 minutes).
-- ============================================================================

-- ── 1. Pre-aggregate 311 per landlord, cross-metro ─────────────────────────
DROP MATERIALIZED VIEW IF EXISTS landlord_311_summary CASCADE;

CREATE MATERIALIZED VIEW landlord_311_summary AS
WITH per_building AS (
  SELECT building_id, metro, COUNT(*)::bigint AS bldg_count
  FROM (
    SELECT building_id, metro FROM complaints_311_nyc     WHERE building_id IS NOT NULL
    UNION ALL
    SELECT building_id, metro FROM complaints_311_la      WHERE building_id IS NOT NULL
    UNION ALL
    SELECT building_id, metro FROM complaints_311_chicago WHERE building_id IS NOT NULL
    UNION ALL
    SELECT building_id, metro FROM complaints_311_miami   WHERE building_id IS NOT NULL
    UNION ALL
    SELECT building_id, metro FROM complaints_311_houston WHERE building_id IS NOT NULL
  ) all_complaints
  GROUP BY building_id, metro
)
SELECT
  b.owner_name AS name,
  b.metro,
  SUM(pb.bldg_count)::bigint AS complaint_count,
  COUNT(DISTINCT b.id)::int  AS building_count
FROM per_building pb
INNER JOIN buildings b ON b.id = pb.building_id
WHERE b.owner_name IS NOT NULL
  AND b.owner_name NOT IN (
    'AVAILABLE FROM DATA SOURCE',
    'NAME NOT ON FILE',
    'NOT AVAILABLE',
    'NOT AVAILABLE FROM THE DATA',
    'NOT AVAILABLE FROM THE DATA SOURCE',
    'UNKNOWN',
    'UNKNOWN OWNER',
    'N/A',
    'NA',
    'UNAVAILABLE',
    'UNAVAILABLE OWNER',
    'Taxpayer Unknown'
  )
GROUP BY b.owner_name, b.metro;

-- Required for REFRESH MATERIALIZED VIEW CONCURRENTLY
CREATE UNIQUE INDEX landlord_311_summary_pk
  ON landlord_311_summary (metro, name);

-- Lookup index for the ranking RPC
CREATE INDEX landlord_311_summary_metro_count_idx
  ON landlord_311_summary (metro, complaint_count DESC);

GRANT SELECT ON landlord_311_summary TO anon, authenticated;

-- ── 2. RPC: top landlords by current 311 (per metro) ───────────────────────
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
  SELECT
    s.name,
    s.building_count,
    s.complaint_count,
    ls.slug
  FROM landlord_311_summary s
  LEFT JOIN landlord_stats ls
    ON UPPER(TRIM(ls.name)) = UPPER(TRIM(s.name))
   AND ls.metro = s.metro
  WHERE s.metro = p_metro
  ORDER BY s.complaint_count DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION get_top_landlords_by_311(int, text) TO anon, authenticated;

-- ── 3. Nightly refresh via pg_cron ─────────────────────────────────────────
-- pg_cron must be enabled. On Supabase: Database → Extensions → enable
-- pg_cron, OR run `CREATE EXTENSION IF NOT EXISTS pg_cron;` once as
-- superuser. The wrapper below is idempotent.
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Drop any prior schedule with the same name so this migration is rerunnable.
DO $$
BEGIN
  PERFORM cron.unschedule('refresh_landlord_311_summary');
EXCEPTION WHEN OTHERS THEN
  -- ignore if it didn't exist
  NULL;
END;
$$;

-- Refresh nightly at 04:30 UTC (off-peak for all 5 US metros).
-- CONCURRENTLY keeps the matview readable during the rebuild.
SELECT cron.schedule(
  'refresh_landlord_311_summary',
  '30 4 * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY landlord_311_summary;$$
);

-- ── 4. Same pattern for OATH (encode in migration so it's reproducible) ────
-- Already created via MCP; this CREATE OR REPLACE is a no-op if identical.
DROP MATERIALIZED VIEW IF EXISTS landlord_oath_summary CASCADE;

CREATE MATERIALIZED VIEW landlord_oath_summary AS
WITH eligible AS (
  SELECT name, slug, metro, building_count
  FROM landlord_stats
  WHERE name NOT IN (
    'AVAILABLE FROM DATA SOURCE',
    'NAME NOT ON FILE',
    'NOT AVAILABLE',
    'NOT AVAILABLE FROM THE DATA',
    'NOT AVAILABLE FROM THE DATA SOURCE',
    'UNKNOWN',
    'UNKNOWN OWNER',
    'N/A',
    'NA',
    'UNAVAILABLE',
    'UNAVAILABLE OWNER',
    'Taxpayer Unknown'
  )
)
SELECT
  e.name,
  e.slug,
  e.metro,
  e.building_count,
  COUNT(*)::bigint                                AS hearing_count,
  COALESCE(SUM(oh.penalty_imposed), 0)::numeric   AS total_penalty,
  COALESCE(SUM(oh.balance_due), 0)::numeric       AS total_balance
FROM oath_hearings oh
INNER JOIN eligible e
  ON UPPER(TRIM(e.name)) = UPPER(TRIM(oh.respondent_name))
 AND e.metro = oh.metro
WHERE oh.respondent_name IS NOT NULL AND oh.respondent_name <> ''
GROUP BY e.name, e.slug, e.metro, e.building_count;

CREATE UNIQUE INDEX landlord_oath_summary_pk
  ON landlord_oath_summary (metro, name);
CREATE INDEX landlord_oath_summary_metro_count_idx
  ON landlord_oath_summary (metro, hearing_count DESC);

GRANT SELECT ON landlord_oath_summary TO anon, authenticated;

-- Recreate the RPC (DROP CASCADE killed it)
CREATE OR REPLACE FUNCTION get_top_landlords_by_oath(
  p_limit int DEFAULT 3,
  p_metro text DEFAULT 'nyc'
)
RETURNS TABLE (
  name            text,
  slug            text,
  building_count  int,
  hearing_count   bigint,
  total_penalty   numeric,
  total_balance   numeric
)
LANGUAGE sql
STABLE
AS $$
  SELECT name, slug, building_count, hearing_count, total_penalty, total_balance
  FROM landlord_oath_summary
  WHERE metro = p_metro
  ORDER BY hearing_count DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION get_top_landlords_by_oath(int, text) TO anon, authenticated;

DO $$
BEGIN
  PERFORM cron.unschedule('refresh_landlord_oath_summary');
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

SELECT cron.schedule(
  'refresh_landlord_oath_summary',
  '40 4 * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY landlord_oath_summary;$$
);

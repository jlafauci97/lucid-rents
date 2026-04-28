-- ============================================================================
-- landlord_stats_canonical — slug-deduped rollup of landlord_stats
-- (2026-04-28, follow-up to 20260428100000_landlord_311_summary_rls_and_perf.sql)
--
-- Problem: landlord_stats stores the same legal entity as multiple rows when
-- the upstream owner-name normalization picks up trivial casing/punctuation
-- variants. Real example from prod NYC:
--
--   "SENIOR LIVING OPTIONS, INC."   9 bldg   6,564 violations
--   "SENIOR LIVING OPTIONS INC"    10 bldg   3,568 violations
--   "SENIOR LIVING OPTIONS, INC"    3 bldg     825 violations
--
-- All three already share slug "senior-living-options-inc" — slug IS the
-- canonical key, the rest are display variants. But every ranking query on
-- /[city]/landlords (shame featured cards + the 5 ranking strips +
-- paginated directory) hit landlord_stats raw, so users saw the same
-- landlord listed 3 times in a row.
--
-- Scope: 9,818 dup-groups in NYC alone (~20K duplicate rows), plus 2,886
-- houston / 736 chicago / 371 LA / 184 miami.
--
-- Fix: pre-aggregate by (metro, slug), pick the longest name as the
-- display name (longest variant typically has the punctuation), SUM the
-- numeric metrics, take the worst-building of the duped rows. Read this
-- table from the page instead of landlord_stats raw.
--
-- Built as a regular table populated by a SECURITY DEFINER function so the
-- rebuild runs as postgres (no anon timeout) — NYC takes ~106s to aggregate
-- 600K rows, well past the anon 3s and MCP 60s caps.
-- ============================================================================

DROP TABLE IF EXISTS landlord_stats_canonical CASCADE;

CREATE TABLE landlord_stats_canonical (
  metro                 text   NOT NULL,
  slug                  text   NOT NULL,
  name                  text   NOT NULL,
  building_count        int    NOT NULL DEFAULT 0,
  total_violations      int    NOT NULL DEFAULT 0,
  total_complaints      int    NOT NULL DEFAULT 0,
  total_litigations     int    NOT NULL DEFAULT 0,
  total_dob_violations  int    NOT NULL DEFAULT 0,
  total_units           int,
  avg_score             numeric,
  worst_building_address    text,
  worst_building_violations int,
  refreshed_at          timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (metro, slug)
);

-- One index per ranking metric (+ buildings + units) so the strip queries
-- can hit an index. Each is small (~600K rows × 12 bytes ≈ 7 MB).
CREATE INDEX landlord_stats_canonical_violations_idx
  ON landlord_stats_canonical (metro, total_violations DESC);
CREATE INDEX landlord_stats_canonical_complaints_idx
  ON landlord_stats_canonical (metro, total_complaints DESC);
CREATE INDEX landlord_stats_canonical_litigations_idx
  ON landlord_stats_canonical (metro, total_litigations DESC);
CREATE INDEX landlord_stats_canonical_dob_idx
  ON landlord_stats_canonical (metro, total_dob_violations DESC);
CREATE INDEX landlord_stats_canonical_buildings_idx
  ON landlord_stats_canonical (metro, building_count DESC);
CREATE INDEX landlord_stats_canonical_units_idx
  ON landlord_stats_canonical (metro, total_units DESC NULLS LAST);

ALTER TABLE landlord_stats_canonical ENABLE ROW LEVEL SECURITY;

-- Pure aggregate of public records — no PII. Permissive read.
DROP POLICY IF EXISTS "public read landlord_stats_canonical" ON landlord_stats_canonical;
CREATE POLICY "public read landlord_stats_canonical"
  ON landlord_stats_canonical
  FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT SELECT ON landlord_stats_canonical TO anon, authenticated;

-- ── Per-metro rebuild (called nightly + on-demand) ──────────────────────
CREATE OR REPLACE FUNCTION refresh_landlord_stats_canonical_for_metro(p_metro text)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rowcount int;
BEGIN
  DELETE FROM landlord_stats_canonical WHERE metro = p_metro;

  INSERT INTO landlord_stats_canonical (
    metro, slug, name,
    building_count, total_violations, total_complaints,
    total_litigations, total_dob_violations, total_units,
    avg_score, worst_building_address, worst_building_violations,
    refreshed_at
  )
  SELECT
    metro,
    slug,
    -- Longest variant typically has the canonical punctuation
    -- ("SENIOR LIVING OPTIONS, INC." > "SENIOR LIVING OPTIONS INC").
    (ARRAY_AGG(name ORDER BY length(name) DESC, name))[1] AS name,
    SUM(COALESCE(building_count, 0))::int        AS building_count,
    SUM(COALESCE(total_violations, 0))::int      AS total_violations,
    SUM(COALESCE(total_complaints, 0))::int      AS total_complaints,
    SUM(COALESCE(total_litigations, 0))::int     AS total_litigations,
    SUM(COALESCE(total_dob_violations, 0))::int  AS total_dob_violations,
    NULLIF(SUM(COALESCE(total_units, 0)), 0)::int AS total_units,
    -- Building-count-weighted average of the per-row avg_scores
    CASE
      WHEN SUM(COALESCE(building_count, 0)) > 0
      THEN (SUM(COALESCE(avg_score, 0) * COALESCE(building_count, 0))
            / NULLIF(SUM(COALESCE(building_count, 0)), 0))
      ELSE NULL
    END AS avg_score,
    -- Pick the single worst building across all duped rows
    (ARRAY_AGG(worst_building_address ORDER BY worst_building_violations DESC NULLS LAST))[1]    AS worst_building_address,
    MAX(worst_building_violations)::int                                                          AS worst_building_violations,
    NOW()
  FROM landlord_stats
  WHERE metro = p_metro
    AND slug IS NOT NULL
    AND slug <> ''
    AND name NOT IN (
      'AVAILABLE FROM DATA SOURCE',
      'NAME NOT ON FILE',
      'NOT AVAILABLE',
      'NOT AVAILABLE FROM THE DATA',
      'NOT AVAILABLE FROM THE DATA SOURCE',
      'UNKNOWN',
      'UNKNOWN OWNER',
      'CURRENT OWNER',
      'N/A',
      'NA',
      'UNAVAILABLE',
      'UNAVAILABLE OWNER',
      'Taxpayer Unknown'
    )
  GROUP BY metro, slug;

  GET DIAGNOSTICS rowcount = ROW_COUNT;
  RETURN rowcount;
END;
$$;

GRANT EXECUTE ON FUNCTION refresh_landlord_stats_canonical_for_metro(text) TO service_role;

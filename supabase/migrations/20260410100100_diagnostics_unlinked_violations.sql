-- Diagnostics: unlinked violation/complaint detection per metro.
-- Supports the Houston/Miami violation linking fix (plan: 2026-04-10-violation-linking-fix.md).
--
-- Two RPCs:
--   1. unlinked_violations_by_metro(p_metro text) — aggregate counts + percentages
--      across the major enforcement sources per city, revealing where linking is failing.
--   2. unlinked_violations_sample(p_metro text, p_source text, p_limit int) — returns
--      raw address fragments of currently-unlinked rows so we can eyeball the failure
--      modes before rebuilding the address normalizer.
--
-- Both functions are SECURITY INVOKER / STABLE. Used by Mission Control and by ad-hoc
-- debugging. Safe to call repeatedly — purely read-only.

-- --------------------------------------------------------------------------
-- 1. Aggregate: unlinked_violations_by_metro
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION unlinked_violations_by_metro(p_metro text)
RETURNS TABLE (
  source text,
  total bigint,
  linked bigint,
  unlinked bigint,
  pct_unlinked numeric
)
LANGUAGE sql STABLE
AS $$
  SELECT
    'dob_violations'::text AS source,
    COUNT(*)::bigint AS total,
    COUNT(building_id)::bigint AS linked,
    (COUNT(*) - COUNT(building_id))::bigint AS unlinked,
    ROUND(100.0 * (COUNT(*) - COUNT(building_id)) / NULLIF(COUNT(*), 0), 2) AS pct_unlinked
  FROM dob_violations
  WHERE metro = p_metro

  UNION ALL

  SELECT
    'complaints_311'::text,
    COUNT(*)::bigint,
    COUNT(building_id)::bigint,
    (COUNT(*) - COUNT(building_id))::bigint,
    ROUND(100.0 * (COUNT(*) - COUNT(building_id)) / NULLIF(COUNT(*), 0), 2)
  FROM complaints_311
  WHERE metro = p_metro

  UNION ALL

  SELECT
    'nypd_complaints'::text,
    COUNT(*)::bigint,
    COUNT(building_id)::bigint,
    (COUNT(*) - COUNT(building_id))::bigint,
    ROUND(100.0 * (COUNT(*) - COUNT(building_id)) / NULLIF(COUNT(*), 0), 2)
  FROM nypd_complaints
  WHERE metro = p_metro

  UNION ALL

  SELECT
    'hpd_violations'::text,
    COUNT(*)::bigint,
    COUNT(building_id)::bigint,
    (COUNT(*) - COUNT(building_id))::bigint,
    ROUND(100.0 * (COUNT(*) - COUNT(building_id)) / NULLIF(COUNT(*), 0), 2)
  FROM hpd_violations
  WHERE metro = p_metro

  ORDER BY source;
$$;

COMMENT ON FUNCTION unlinked_violations_by_metro(text) IS
  'Percent of rows per enforcement source where building_id IS NULL for a given metro. '
  'Used by Mission Control to detect linking regressions. '
  'See docs/superpowers/plans/2026-04-10-violation-linking-fix.md';

-- --------------------------------------------------------------------------
-- 2. Raw sample: unlinked_violations_sample
-- --------------------------------------------------------------------------
-- Returns raw address columns for a handful of currently-unlinked rows from a
-- single source so a human can inspect the failure mode. The output schema is
-- normalized across sources: (source, row_id, borough, house_number,
-- street_name, full_address, reported_at). Sources with different column names
-- are mapped into these canonical fields.

CREATE OR REPLACE FUNCTION unlinked_violations_sample(
  p_metro text,
  p_source text,
  p_limit int DEFAULT 25
)
RETURNS TABLE (
  source text,
  row_id text,
  borough text,
  house_number text,
  street_name text,
  full_address text,
  reported_at timestamptz
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  IF p_source = 'dob_violations' THEN
    RETURN QUERY
      SELECT
        'dob_violations'::text,
        v.id::text,
        v.borough::text,
        v.house_number::text,
        v.street_name::text,
        NULL::text,
        v.issue_date::timestamptz
      FROM dob_violations v
      WHERE v.metro = p_metro
        AND v.building_id IS NULL
      ORDER BY v.issue_date DESC NULLS LAST
      LIMIT p_limit;

  ELSIF p_source = 'complaints_311' THEN
    RETURN QUERY
      SELECT
        'complaints_311'::text,
        c.id::text,
        c.borough::text,
        c.parsed_house_num::text,
        c.parsed_street::text,
        c.incident_address::text,
        c.created_date::timestamptz
      FROM complaints_311 c
      WHERE c.metro = p_metro
        AND c.building_id IS NULL
      ORDER BY c.created_date DESC NULLS LAST
      LIMIT p_limit;

  ELSIF p_source = 'nypd_complaints' THEN
    RETURN QUERY
      SELECT
        'nypd_complaints'::text,
        n.id::text,
        n.borough::text,
        NULL::text,
        NULL::text,
        n.incident_address::text,
        n.cmplnt_date::timestamptz
      FROM nypd_complaints n
      WHERE n.metro = p_metro
        AND n.building_id IS NULL
      ORDER BY n.cmplnt_date DESC NULLS LAST
      LIMIT p_limit;

  ELSIF p_source = 'hpd_violations' THEN
    RETURN QUERY
      SELECT
        'hpd_violations'::text,
        h.id::text,
        h.borough::text,
        h.house_number::text,
        h.street_name::text,
        NULL::text,
        NULL::timestamptz
      FROM hpd_violations h
      WHERE h.metro = p_metro
        AND h.building_id IS NULL
      LIMIT p_limit;

  ELSE
    RAISE EXCEPTION 'Unknown source: %. Expected one of: dob_violations, complaints_311, nypd_complaints, hpd_violations', p_source;
  END IF;
END;
$$;

COMMENT ON FUNCTION unlinked_violations_sample(text, text, int) IS
  'Returns raw address columns for currently-unlinked rows from a given source+metro. '
  'Used to eyeball address-format failures driving the unlinked count. '
  'See docs/superpowers/plans/2026-04-10-violation-linking-fix.md';

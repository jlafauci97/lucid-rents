-- ============================================================================
-- SEO title aggregates — categorize HPD violations + 311 complaints into
-- short renter-readable buckets so the title cascade can emit templates like
-- "Heat, Roach, Mold: Inside {addr}'s 42 Violations".
--
-- Adds two IMMUTABLE classifier functions and two RPCs:
--   • classify_hpd_description(text)       → short label
--   • classify_311_complaint(text)         → short label
--   • building_top_categories(uuid)        → rows of (label, total, recent)
--   • landlord_top_category(slug, metro)   → single row (label, count, share)
--
-- Phase 2 of the SEO title overhaul. Phase 1 (the template cascade) ships
-- without these and gracefully degrades when these functions aren't deployed.
-- ============================================================================

-- ── 1. HPD nov_description classifier ──────────────────────────────────────
-- Free-text HPD descriptions get bucketed via case-insensitive regex.
-- Keep returns short (≤ 12 chars) so they fit inside our title budget.
CREATE OR REPLACE FUNCTION classify_hpd_description(_desc text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN _desc IS NULL THEN NULL
    -- Lead must come BEFORE paint so "LEADED PAINT" buckets to Lead Paint.
    WHEN _desc ~* '\mlead(ed|ing|s)?\M' THEN 'Lead Paint'
    WHEN _desc ~* '\m(roach(es)?|vermin|mice|rats?|mouse|rodents?|pests?|bedbugs?|bed[ -]?bugs?|cockroach(es)?|extermin)\M' THEN 'Pests'
    WHEN _desc ~* '\m(hot[ -]?water|cold[ -]?water)\M' THEN 'Hot Water'
    WHEN _desc ~* '\mheat(ing)?\M' THEN 'Heat'
    WHEN _desc ~* '\m(molds?|mildew)\M' THEN 'Mold'
    WHEN _desc ~* '\m(paints?|painted|painting|plasters?|plastered|plastering)\M' THEN 'Paint'
    WHEN _desc ~* '\m(leaks?|leaking|leaked|water[ -]?damage|seep(ed|ing|s)?)\M' THEN 'Leaks'
    WHEN _desc ~* '\m(smoke[ -]?detectors?|carbon[ -]?monoxide|fire[ -]?alarms?)\M' THEN 'Detectors'
    WHEN _desc ~* '\mwindows?\M' THEN 'Windows'
    WHEN _desc ~* '\mdoors?\M' THEN 'Doors'
    WHEN _desc ~* '\m(electric(al)?|wiring|outlets?)\M' THEN 'Electric'
    WHEN _desc ~* '\mplumb(ing)?\M' THEN 'Plumbing'
    WHEN _desc ~* '\m(floors?|flooring|stairs?|stairway)\M' THEN 'Stairs'
    WHEN _desc ~* '\m(roofs?|roofing|ceilings?)\M' THEN 'Roof'
    WHEN _desc ~* '\mgas(es)?\M' THEN 'Gas'
    WHEN _desc ~* '\melevators?\M' THEN 'Elevator'
    WHEN _desc ~* '\m(garbage|trash|sanit(ation|ary)?)\M' THEN 'Sanitation'
    ELSE NULL  -- unbucketed — excluded from "top" results
  END;
$$;

-- ── 2. 311 complaint_type classifier ───────────────────────────────────────
CREATE OR REPLACE FUNCTION classify_311_complaint(_type text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN _type IS NULL THEN NULL
    WHEN _type ~* '\m(heat|hot[ -]?water)\M' THEN 'Heat'
    WHEN _type ~* '\m(pests?|rodents?|unsanitary|mice|rats?|roach(es)?)\M' THEN 'Pests'
    WHEN _type ~* '\m(paints?|plasters?)\M' THEN 'Paint'
    WHEN _type ~* '\m(leaks?|water)\M' THEN 'Leaks'
    WHEN _type ~* '\mmolds?\M' THEN 'Mold'
    WHEN _type ~* '\melectric(al)?\M' THEN 'Electric'
    WHEN _type ~* '\mplumb(ing)?\M' THEN 'Plumbing'
    WHEN _type ~* '\mnoise\M' THEN 'Noise'
    WHEN _type ~* '\mgas(es)?\M' THEN 'Gas'
    WHEN _type ~* '\melevators?\M' THEN 'Elevator'
    WHEN _type ~* '\mdoors?\M' THEN 'Doors'
    WHEN _type ~* '\mwindows?\M' THEN 'Windows'
    ELSE NULL
  END;
$$;

-- ── 3. building_top_categories — used by B1, B2 ────────────────────────────
-- Returns up to ~15 distinct categories sorted by total_count desc, with the
-- last-12-months count alongside (for B2 recency template).
CREATE OR REPLACE FUNCTION building_top_categories(_building_id uuid)
RETURNS TABLE(
  category_label text,
  total_count    bigint,
  recent_count   bigint
)
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  WITH issues AS (
    SELECT classify_hpd_description(nov_description) AS label,
           nov_issue_date::timestamptz                AS issued_at
    FROM hpd_violations
    WHERE building_id = _building_id
      AND nov_description IS NOT NULL
    UNION ALL
    SELECT classify_311_complaint(complaint_type) AS label,
           created_date::timestamptz              AS issued_at
    FROM complaints_311
    WHERE building_id = _building_id
      AND complaint_type IS NOT NULL
  )
  SELECT label,
         COUNT(*)::bigint AS total_count,
         COUNT(*) FILTER (WHERE issued_at >= NOW() - INTERVAL '12 months')::bigint AS recent_count
  FROM issues
  WHERE label IS NOT NULL
  GROUP BY label
  ORDER BY total_count DESC
  LIMIT 15;
$$;

GRANT EXECUTE ON FUNCTION building_top_categories(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION classify_hpd_description(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION classify_311_complaint(text) TO anon, authenticated;

-- ── 4. landlord_top_category — used by L2 ─────────────────────────────────
-- Returns the single most-cited HPD category across the landlord's portfolio,
-- with absolute count and share of total. Resolves slug → owner_name via
-- landlord_stats (matches the existing loadLandlordBuildingList pattern in
-- src/app/[city]/landlord/[name]/_data.ts), then joins buildings by owner_name
-- (an indexed equality match — much faster than slug regex).
CREATE OR REPLACE FUNCTION landlord_top_category(_slug text, _metro text)
RETURNS TABLE(
  category_label text,
  category_count bigint,
  total_violations bigint,
  share          numeric
)
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  WITH owner AS (
    SELECT name AS owner_name
    FROM landlord_stats
    WHERE slug = _slug AND metro = _metro
    LIMIT 1
  ),
  ll_buildings AS (
    SELECT b.id
    FROM buildings b
    JOIN owner o ON b.owner_name = o.owner_name
    WHERE b.metro = _metro
  ),
  cat_counts AS (
    SELECT classify_hpd_description(v.nov_description) AS label,
           COUNT(*) AS cnt
    FROM hpd_violations v
    JOIN ll_buildings b ON b.id = v.building_id
    WHERE v.nov_description IS NOT NULL
    GROUP BY 1
  ),
  total AS (
    SELECT COALESCE(SUM(cnt), 0) AS total_v FROM cat_counts
  )
  SELECT t.label::text,
         t.cnt,
         total.total_v,
         CASE WHEN total.total_v > 0 THEN (t.cnt::numeric / total.total_v) ELSE 0 END
  FROM cat_counts t, total
  WHERE t.label IS NOT NULL
  ORDER BY t.cnt DESC
  LIMIT 5;  -- top N so the TS layer can apply display filters (e.g. skip "Paint")
$$;

GRANT EXECUTE ON FUNCTION landlord_top_category(text, text) TO anon, authenticated;

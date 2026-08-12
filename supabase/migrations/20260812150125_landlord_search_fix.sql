-- Landlord directory search (/api/landlords?search=) was returning HTTP 500
-- ("canceling statement due to statement timeout") for common queries:
--   * 1-2 char queries can't use the trigram index, so `ILIKE '%sm%'` seq-scanned
--     all 631K rows through the (metro, total_violations DESC) index — 28s+.
--   * 3+ char queries used the trigram index but fetched thousands of scattered
--     heap pages on cold cache (~9ms/page on this instance) — 4.5-14s.
--   * The old idx_landlord_stats_norm_name_metro can't serve LIKE prefixes at
--     all (built without text_pattern_ops).
--
-- Fix: a covering index that serves prefix searches index-only (no heap), and
-- an RPC that branches: <3 chars → prefix-only via the covering index (~30ms);
-- >=3 chars → trigram substring hard-capped at 300 candidate rows so cold heap
-- I/O stays bounded (~1-4s worst case, well under the statement timeout).

CREATE INDEX IF NOT EXISTS idx_landlord_stats_search_cover
ON landlord_stats (metro, upper(btrim(name)) text_pattern_ops, total_violations DESC)
INCLUDE (name, slug, building_count, total_complaints, total_litigations,
         total_dob_violations, avg_score, worst_building_id,
         worst_building_address, worst_building_violations);

-- Subsumed by the covering index above (and unusable for LIKE anyway).
DROP INDEX IF EXISTS idx_landlord_stats_norm_name_metro;

CREATE OR REPLACE FUNCTION public.search_landlord_stats(
  city_filter text,
  search_query text,
  sort_by text DEFAULT 'violations',
  page_offset integer DEFAULT 0,
  page_limit integer DEFAULT 25
) RETURNS SETOF json
LANGUAGE plpgsql STABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  q_norm text := upper(btrim(search_query));
BEGIN
  IF q_norm IS NULL OR q_norm = '' THEN
    RETURN;
  END IF;

  IF length(q_norm) < 3 THEN
    -- Short queries: prefix match only, served index-only by
    -- idx_landlord_stats_search_cover. Substring on 1-2 chars cannot use the
    -- trigram index and used to seq-scan into a statement timeout.
    RETURN QUERY
    WITH matches AS MATERIALIZED (
      SELECT name, slug, building_count, total_violations, total_complaints,
             total_litigations, total_dob_violations, avg_score,
             worst_building_id, worst_building_address, worst_building_violations
      FROM landlord_stats
      WHERE (city_filter IS NULL OR metro = city_filter)
        AND upper(btrim(name)) LIKE q_norm || '%'
      LIMIT 1000
    )
    SELECT row_to_json(t) FROM (
      SELECT m.*, count(*) OVER () AS total_count
      FROM matches m
      ORDER BY
        CASE WHEN sort_by = 'complaints'  THEN m.total_complaints
             WHEN sort_by = 'litigations' THEN m.total_litigations
             WHEN sort_by = 'dob'         THEN m.total_dob_violations
             WHEN sort_by = 'buildings'   THEN m.building_count
             ELSE m.total_violations END DESC NULLS LAST
      OFFSET page_offset LIMIT page_limit
    ) t;
  ELSE
    -- 3+ chars: substring match via the trigram index, hard-capped so the
    -- scattered heap fetches stay bounded on cold cache.
    RETURN QUERY
    WITH matches AS MATERIALIZED (
      SELECT name, slug, building_count, total_violations, total_complaints,
             total_litigations, total_dob_violations, avg_score,
             worst_building_id, worst_building_address, worst_building_violations
      FROM landlord_stats
      WHERE name ILIKE '%' || btrim(search_query) || '%'
        AND (city_filter IS NULL OR metro = city_filter)
      LIMIT 300
    )
    SELECT row_to_json(t) FROM (
      SELECT m.*, count(*) OVER () AS total_count
      FROM matches m
      ORDER BY
        CASE WHEN sort_by = 'complaints'  THEN m.total_complaints
             WHEN sort_by = 'litigations' THEN m.total_litigations
             WHEN sort_by = 'dob'         THEN m.total_dob_violations
             WHEN sort_by = 'buildings'   THEN m.building_count
             ELSE m.total_violations END DESC NULLS LAST
      OFFSET page_offset LIMIT page_limit
    ) t;
  END IF;
END;
$function$;

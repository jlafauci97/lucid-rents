-- Search performance for the landlord directory.
--
-- Before this migration the `?search=` variant of /[city]/landlords took
-- 6-11s for nyc because PostgREST's count="planned" still triggered a
-- full SELECT under the hood for `ilike '%term%'` (no usable index), and
-- the row fetch itself was a seq scan.
--
-- Three parts:
--   1) Trigram GIN index on landlord_stats_canonical.name so ilike lookups
--      become index-scans with accurate planner selectivity.
--   2) Overloaded get_landlord_directory_count(p_metro, p_search) that
--      returns the planner's row estimate via EXPLAIN (FORMAT JSON).
--   3) Collapse the 1-arg variant into a thin wrapper over the 2-arg one.
--
-- Compared to the 20260507000000 version, this drops the GARBAGE NOT IN
-- filter from the function body. The planner is already inexact (10-22%
-- off vs COUNT(*)), and the placeholder-owner list in page.tsx
-- (GARBAGE_NAMES) keeps growing — keeping it duplicated here required a
-- migration every change. The actual row filter still applies at render
-- time; only the displayed "X indexed owners" hero is slightly inflated.

-- ── 1. Trigram index ─────────────────────────────────────────────────────
-- pg_trgm extension is already enabled at the cluster level.
CREATE INDEX IF NOT EXISTS idx_landlord_stats_canonical_name_trgm
ON public.landlord_stats_canonical
USING gin (name gin_trgm_ops);

-- ── 2. Search-aware count RPC ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_landlord_directory_count(
  p_metro text,
  p_search text
)
RETURNS bigint
LANGUAGE plpgsql
VOLATILE
SET statement_timeout = '3s'
AS $func$
DECLARE
  plan_json jsonb;
  search_pattern text;
BEGIN
  IF p_search IS NULL OR length(btrim(p_search)) = 0 THEN
    EXECUTE
      'EXPLAIN (FORMAT JSON) SELECT 1 FROM public.landlord_stats_canonical WHERE metro = $1'
      INTO plan_json USING p_metro;
  ELSE
    search_pattern := '%' || p_search || '%';
    EXECUTE
      'EXPLAIN (FORMAT JSON) SELECT 1 FROM public.landlord_stats_canonical WHERE metro = $1 AND name ILIKE $2'
      INTO plan_json USING p_metro, search_pattern;
  END IF;

  RETURN COALESCE((plan_json->0->'Plan'->>'Plan Rows')::bigint, 0);
END;
$func$;

GRANT EXECUTE ON FUNCTION public.get_landlord_directory_count(text, text) TO anon, authenticated;

-- ── 3. 1-arg variant becomes a wrapper ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_landlord_directory_count(p_metro text)
RETURNS bigint
LANGUAGE sql
VOLATILE
AS $func$
  SELECT public.get_landlord_directory_count(p_metro, NULL::text);
$func$;

GRANT EXECUTE ON FUNCTION public.get_landlord_directory_count(text) TO anon, authenticated;

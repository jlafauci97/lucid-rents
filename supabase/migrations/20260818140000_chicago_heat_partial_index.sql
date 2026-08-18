-- Chicago heating-tracker heat-complaint partial index (2026-08-18).
-- Applied to prod via one-shot pg_cron; IF NOT EXISTS makes this a no-op.
--
-- The tracker's or= filter had unencoded "/" and space characters
-- (BUILDING/HOUSING, "no heat") — PostgREST returned HTTP 400 on every
-- request since the page shipped, silently swallowed as an empty list.
-- With the syntax fixed, the 6-wildcard OR scan over the Chicago slice blew
-- the anon 8s statement_timeout; this partial index (predicate textually
-- identical to the app's or= filter — keep them in sync or the planner
-- reverts to the scan) serves list + exact-count in ~0.25s.
--
-- NOTE: complaints_311 is PARTITIONED — CREATE INDEX CONCURRENTLY is not
-- allowed on the parent, so this was built plain (33s, off-peak; writes
-- only happen during sync windows).
--
-- DATA FINDING, separate from this fix: the index matched ZERO rows across
-- all Chicago data — the Chicago 311 ingest apparently never captured heat
-- complaint categories. The page now renders its empty state honestly and
-- fast; fixing the ingest is a data-pipeline task.
CREATE INDEX IF NOT EXISTS idx_c311_chicago_heat
  ON public.complaints_311 (created_date DESC NULLS LAST)
  WHERE metro = 'chicago' AND (
    complaint_type ILIKE '%heat%' OR complaint_type ILIKE '%BUILDING/HOUSING%'
    OR descriptor ILIKE '%heat%' OR descriptor ILIKE '%no heat%'
    OR descriptor ILIKE '%furnace%' OR descriptor ILIKE '%boiler%'
  );

-- RPCs the page actually uses (POST body — no URL-encoding pitfalls; the
-- pre-encoded or= URL was ALSO re-normalized somewhere in Next's build-time
-- fetch path). The list RPC additionally fixes the page's second
-- always-broken piece: it selected a nonexistent `address` column
-- (complaints_311 calls it incident_address) — HTTP 400 on every request
-- since the page shipped, silently swallowed as an empty list.
CREATE OR REPLACE FUNCTION public.chicago_heat_complaints(p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
RETURNS TABLE (id uuid, address text, created_date timestamptz, status text, complaint_type text, descriptor text)
LANGUAGE sql STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT c.id, (c.incident_address)::text AS address, c.created_date, (c.status)::text, (c.complaint_type)::text, (c.descriptor)::text
  FROM complaints_311 c
  WHERE c.metro = 'chicago' AND (
    c.complaint_type ILIKE '%heat%' OR c.complaint_type ILIKE '%BUILDING/HOUSING%'
    OR c.descriptor ILIKE '%heat%' OR c.descriptor ILIKE '%no heat%'
    OR c.descriptor ILIKE '%furnace%' OR c.descriptor ILIKE '%boiler%')
  ORDER BY c.created_date DESC NULLS LAST
  LIMIT p_limit OFFSET p_offset;
$$;

CREATE OR REPLACE FUNCTION public.chicago_heat_count(p_since timestamptz DEFAULT NULL)
RETURNS bigint
LANGUAGE sql STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT count(*)
  FROM complaints_311 c
  WHERE c.metro = 'chicago' AND (
    c.complaint_type ILIKE '%heat%' OR c.complaint_type ILIKE '%BUILDING/HOUSING%'
    OR c.descriptor ILIKE '%heat%' OR c.descriptor ILIKE '%no heat%'
    OR c.descriptor ILIKE '%furnace%' OR c.descriptor ILIKE '%boiler%')
    AND (p_since IS NULL OR c.created_date >= p_since);
$$;

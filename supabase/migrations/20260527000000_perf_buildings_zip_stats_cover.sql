-- Performance: covering index for neighborhood_stats(target_zip) RPC.
--
-- Diagnosis: large NYC ZIPs (e.g. 11216 / Bed-Stuy with 7,346 buildings)
-- caused neighborhood_stats() to run ~13s, exceeding the anon role's 8s
-- statement_timeout. PostgREST returned a timeout error; the Next.js page
-- (src/app/[city]/neighborhood/[slug]/page.tsx) interpreted !res.ok as
-- "no data" and rendered the empty state. Result: any large neighborhood
-- page intermittently rendered "No Data for {Neighborhood}".
--
-- Root cause: idx_buildings_zip_code is a btree on (zip_code) only, so the
-- aggregate had to heap-fetch all matching rows to read overall_score,
-- violation_count, complaint_count, litigation_count, review_count, and
-- owner_name. Random heap reads dominated.
--
-- Fix: covering index turns the aggregate into an Index Only Scan.
-- EXPLAIN ANALYZE as the anon role on ZIP 11216:
--   Before: 12,886 ms
--   After (cold): 1,165 ms
--   After (warm):    67 ms
-- Well under the 8s anon timeout in every state.
--
-- Applied directly to the active DB via apply_migration; this file exists
-- so other environments stay in sync.

SET LOCAL statement_timeout = 0;

CREATE INDEX IF NOT EXISTS idx_buildings_zip_stats_cover
  ON public.buildings (zip_code)
  INCLUDE (overall_score, violation_count, complaint_count,
           litigation_count, review_count, owner_name)
  WHERE zip_code IS NOT NULL;

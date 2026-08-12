-- Covering indexes for the per-metro violation rollups behind the Reddit
-- self-posts (worst landlords / worst neighborhoods) and the ranking pages.
--
-- The problem was not the number of queries, it was that every one of them
-- fell through to the heap. Grouping NYC's ~201k violation-bearing buildings
-- by ZIP planned as a bitmap heap scan touching 106,044 heap blocks and took
-- 67.4 SECONDS -- past the platform's ~100s response ceiling once the endpoint
-- looped several cities, which is why /api/marketing/reddit/selfpost answered
-- HTTP 524 and worst_landlords / worst_neighborhoods never generated at all.
--
-- The existing idx_buildings_zip_stats_cover already INCLUDEs violation_count
-- but is keyed on zip_code alone, so a per-metro rollup could not use it as an
-- index-only scan. Adding metro as the leading key is what makes these
-- index-only. Measured after: the same ZIP aggregate runs in 2.2s (30x), with
-- 2,859 heap fetches instead of 106k blocks.
--
-- Predicate is violation_count > 0 while the callers filter on
-- MIN_VIOLATIONS (10). That is deliberate: > 10 implies > 0, so the planner can
-- still prove the partial index applies, and the wider predicate also serves
-- the neighbourhoods rollup, which filters at > 0.
--
-- NOTE ON CONCURRENTLY: both indexes were built against production with
-- CREATE INDEX CONCURRENTLY (driven through pg_cron, since the build ran ~12
-- minutes and blows past the 30s statement timeout). They are written here
-- without CONCURRENTLY because migrations run inside a transaction, where it
-- is not permitted. IF NOT EXISTS makes this a no-op on production, which
-- already has them; on a fresh database the plain build is correct.

-- Neighbourhood rollup: group buildings by ZIP within a metro.
CREATE INDEX IF NOT EXISTS idx_buildings_metro_zip_viol_cover
  ON public.buildings (metro, zip_code)
  INCLUDE (violation_count)
  WHERE violation_count > 0 AND zip_code IS NOT NULL;

-- Landlord rollup: group buildings by owner within a metro.
CREATE INDEX IF NOT EXISTS idx_buildings_metro_owner_viol_cover
  ON public.buildings (metro, owner_name)
  INCLUDE (violation_count)
  WHERE violation_count > 0 AND owner_name IS NOT NULL;

-- Applied to prod 2026-08-16 via MCP; this file mirrors the recorded
-- migration (version 20260816171115) so `db push` sees it as applied.
--
-- Extended statistics so the planner stops multiplying metro and borough
-- selectivities independently (borough functionally determines metro).
-- Tightens PostgREST count=planned estimates used for building-page
-- related-links copy, and helps every metro+borough query plan.
--
-- Context: the building page's RelatedLinks "same-era buildings" count was a
-- count=exact over metro + ilike(borough) + year_built range — a parallel seq
-- scan over ~3.5M rows (94s uncached) that hit the anon role's 8s
-- statement_timeout on every cold ISR render, gating cold TTFB at ~8.7s
-- site-wide. The code fix (eq borough + count=planned + limit 1) lives in
-- src/components/building/v2/streaming/RelatedLinksStreamed.tsx; these stats
-- bring the planned estimates within ~3x of actuals (they were ~10x under).
CREATE STATISTICS IF NOT EXISTS stat_buildings_metro_borough (dependencies, ndistinct) ON metro, borough FROM public.buildings;
ANALYZE public.buildings;

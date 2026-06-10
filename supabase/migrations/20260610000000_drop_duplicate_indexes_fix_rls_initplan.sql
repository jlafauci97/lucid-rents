-- Applied to production 2026-06-10 via Supabase MCP (audit remediation).
-- 1. Drop exact-duplicate indexes (verified identical definitions in pg_indexes).
DROP INDEX IF EXISTS public.idx_bedbug_reports_building_date;
DROP INDEX IF EXISTS public.idx_dob_permits_building_date;
DROP INDEX IF EXISTS public.idx_dob_violations_building_date;
DROP INDEX IF EXISTS public.idx_evictions_building_date;
DROP INDEX IF EXISTS public.idx_hpd_litigations_building_date;
DROP INDEX IF EXISTS public.idx_hpd_violations_building_date;
DROP INDEX IF EXISTS public.unit_rent_history_building_idx;

-- 2. Cover unindexed foreign keys flagged by the performance advisor.
CREATE INDEX IF NOT EXISTS idx_review_amenities_review_id
  ON public.review_amenities (review_id);
CREATE INDEX IF NOT EXISTS idx_featured_news_history_article_id
  ON public.featured_news_history (article_id);

-- 3. monitored_buildings policies: evaluate auth.uid() once per statement
--    instead of per row (advisor lint auth_rls_initplan).
ALTER POLICY monitored_buildings_select ON public.monitored_buildings
  USING ((SELECT auth.uid()) = user_id);
ALTER POLICY monitored_buildings_insert ON public.monitored_buildings
  WITH CHECK ((SELECT auth.uid()) = user_id);
ALTER POLICY monitored_buildings_delete ON public.monitored_buildings
  USING ((SELECT auth.uid()) = user_id);

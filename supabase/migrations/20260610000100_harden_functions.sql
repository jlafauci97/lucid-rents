-- Applied to production 2026-06-10 via Supabase MCP (audit remediation).
-- 1. Pin search_path on every user-defined public function lacking one
--    (advisor lint function_search_path_mutable). Explicit trailing pg_temp
--    prevents temp-schema hijacking; extension-owned functions excluded.
DO $$
DECLARE fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind IN ('f', 'p')
      AND NOT EXISTS (
        SELECT 1 FROM unnest(coalesce(p.proconfig, '{}'::text[])) c
        WHERE c LIKE 'search_path=%'
      )
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.objid = p.oid AND d.deptype = 'e'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, extensions, pg_temp', fn.sig);
  END LOOP;
END $$;

-- 2. Internal ETL / admin SECURITY DEFINER functions: revoke EXECUTE from
--    PUBLIC, anon, authenticated (advisor lints 0028/0029). Only invoked by
--    service-role cron routes, DB triggers, or the auth admin. Read-only
--    aggregates used by pages with the anon key keep their grants.
DO $$
DECLARE fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY(ARRAY[
        'apply_hpd_contact_links','apply_hpd_registration_links',
        'backfill_buildings_owner_name','backfill_buildings_owner_name_by_bbl',
        'backfill_flood_zones_chunk','backfill_flood_zones_for_metro',
        'backup_review_original','backup_reviews_batch',
        'bulk_link_complaints_311','bulk_link_to_buildings',
        'bulk_set_owner','bulk_update_building_counts',
        'check_building_count_drift','create_311_indexes',
        'get_backed_up_review_ids','handle_new_user',
        'link_311_nyc_bulk','link_311_nyc_by_keys',
        'link_hpd_contacts_to_buildings',
        'pg_advisory_unlock','pg_try_advisory_lock',
        'reconcile_building_counts',
        'refresh_landlord_311_for_metro','refresh_landlord_stats_canonical_for_metro',
        'refresh_perf_matviews','refresh_permit_caches',
        'refresh_rent_stab_borough_stats','relink_311_nyc_normalized_range',
        'reset_pg_stat_statements','rls_auto_enable',
        'terminate_idle_advisory_locks',
        'update_building_review_stats','update_helpful_count',
        'upsert_flood_zone','upsert_flood_zones_batch'
      ])
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn.sig);
  END LOOP;
END $$;

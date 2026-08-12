-- Applied to prod 2026-08-12 via MCP; this file mirrors the recorded
-- migration (version 20260812040950) so `db push` sees it as applied.
--
-- Cost cleanup: Miami/Houston removed from product 2026-07-26 (PR #292).
-- Dropping their tables (~1.5 GB) plus dead cook_county_owners (437 MB, zero
-- code refs). All re-importable from public open-data portals via
-- scripts/backfill-*. mv_crime_city_stats was already rebuilt without its
-- miami branch in 20260812040057.
set local lock_timeout = '10s';

-- 1. Drop metro-specific backfill/link helper functions (all overloads).
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'link_miami_311_partition','bulk_link_miami_311','bulk_link_miami_311_new',
      'update_houston_counts','link_miami_permits_partition','link_miami_permits_batch',
      'refresh_miami_letter','refresh_houston_letter','refresh_houston_canonical_letter',
      'apply_cook_county_sales_chunk','apply_cook_county_chunk',
      'apply_miami_owners_chunk','apply_houston_owners_chunk',
      'delete_miami_single_family_chunk','delete_houston_single_family_chunk'
    )
  loop
    execute 'drop function if exists ' || r.sig;
  end loop;
end $$;

-- 2. Drop the dead tables.
drop table if exists public.complaints_311_miami;
drop table if exists public.complaints_311_houston;
drop table if exists public.miami_dade_owners;
drop table if exists public._houston_addr_lookup;
drop table if exists public.miami_unsafe_structures;
drop table if exists public.houston_industrial_proximity;
drop table if exists public.houston_flood_risk;
drop table if exists public.houston_dangerous_buildings;
drop table if exists public.houston_affordable_housing;
drop table if exists public.miami_crime_aggregates;
drop table if exists public.houston_super_neighborhoods;
drop table if exists public.miami_forty_year_recerts;
drop table if exists public.miami_flood_claims;
drop table if exists public.houston_land_use_conflicts;
drop table if exists public.houston_tax_protests;
drop table if exists public.miami_storm_damage;
drop table if exists public.cook_county_owners;

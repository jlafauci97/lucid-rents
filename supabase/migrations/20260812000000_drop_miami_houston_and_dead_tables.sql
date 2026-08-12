-- Cost cleanup 2026-08-12 (applied directly to prod via MCP the same day;
-- this file mirrors it for history).
--
-- Miami/Houston were removed from the product on 2026-07-26 (PR #292). Their
-- tables (~1.5 GB) plus dead cook_county_owners (437 MB, zero code refs) are
-- dropped here. All of it is re-importable from public open-data portals via
-- scripts/backfill-* if the metros ever come back — see
-- docs/miami-houston-removal.md.

-- 1. Rebuild mv_crime_city_stats without the miami branch (it read
--    miami_crime_aggregates). Recreated WITH NO DATA + refreshed so the DDL
--    itself stays fast.
drop materialized view if exists public.mv_crime_city_stats;

create materialized view public.mv_crime_city_stats as
with nypd_per_metro as (
  select metro,
    count(*) as total_crimes,
    count(*) filter (where crime_category::text = 'violent') as total_violent,
    count(*) filter (where crime_category::text = 'property') as total_property,
    count(*) filter (where crime_category::text = 'quality_of_life') as total_qol,
    count(distinct zip_code) as zip_count
  from nypd_complaints
  where cmplnt_date >= (current_date - interval '2 years')
    and zip_code is not null
    and metro is not null
    and metro <> 'miami'
  group by metro
)
select metro, total_crimes, total_violent, total_property, total_qol, zip_count,
  round(total_crimes::numeric / nullif(zip_count, 0)::numeric, 1) as avg_per_zip,
  round(total_violent::numeric / nullif(zip_count, 0)::numeric, 1) as avg_violent_per_zip,
  round(total_property::numeric / nullif(zip_count, 0)::numeric, 1) as avg_property_per_zip,
  round(total_qol::numeric / nullif(zip_count, 0)::numeric, 1) as avg_qol_per_zip,
  now() as refreshed_at
from nypd_per_metro
with no data;

create unique index mv_crime_city_stats_metro_uniq on public.mv_crime_city_stats using btree (metro);
grant select on public.mv_crime_city_stats to anon, authenticated, service_role;

refresh materialized view public.mv_crime_city_stats;

-- 2. Drop metro-specific backfill/link helper functions (all overloads).
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

-- 3. Drop the dead tables.
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

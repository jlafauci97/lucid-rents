-- Applied to prod 2026-08-12 via MCP; this file mirrors the recorded
-- migration (version 20260812040057) so `db push` sees it as applied.
--
-- Rebuild mv_crime_city_stats without the miami branch (it read
-- miami_crime_aggregates, dropped in 20260812040950). Created WITH NO DATA so
-- the DDL is instant; the initial population ran out-of-band via pg_cron
-- (REFRESH exceeds the 30s statement timeout), and the nightly
-- refresh_perf_matviews cron keeps it fresh from here.
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

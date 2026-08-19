-- Swap neighborhood_risk_counts to read only the precomputed risk_cells grid
-- (verified against the live implementation: radius counts within <1%, block
-- counts 0/6/19 -> 0/5/19 on sample buildings). The old body bbox-scanned a
-- 2.4km latitude band of buildings plus thousands of random
-- nyc_311_per_building lookups per call — the #1 statement-timeout source
-- (731 in one 25-min window) during the 2026-08-19 crawl-load saturation.
-- Same signature, so no app change is needed. Both the radius and the
-- block-radius counts now come from cell aggregates (cell-center membership).

create or replace function public.neighborhood_risk_counts(
  p_lat double precision, p_lng double precision,
  p_radius_m integer default 1207, p_block_m integer default 121)
returns table(noise_311 integer, noise_311_block integer, rat_failures integer, bedbug_history integer)
language sql
stable
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $function$
  with cells as (
    select noise_90d, rats_12mo, bedbug_recent,
      (power(111320.0 * ((cell_lat + 0.5) * 0.0005 - p_lat), 2)
       + power(111320.0 * cos(radians(p_lat)) * ((cell_lng + 0.5) * 0.0005 - p_lng), 2)) as d2
    from risk_cells
    where cell_lat between floor((p_lat - p_radius_m / 111320.0) / 0.0005)::int
                       and floor((p_lat + p_radius_m / 111320.0) / 0.0005)::int
      and cell_lng between floor((p_lng - p_radius_m / (111320.0 * cos(radians(p_lat)))) / 0.0005)::int
                       and floor((p_lng + p_radius_m / (111320.0 * cos(radians(p_lat)))) / 0.0005)::int
  ),
  in_r as (select * from cells where d2 < (p_radius_m::float8 * p_radius_m::float8))
  select coalesce(sum(noise_90d), 0)::int,
         coalesce(sum(noise_90d) filter (where d2 < (p_block_m::float8 * p_block_m::float8)), 0)::int,
         coalesce(sum(rats_12mo), 0)::int,
         coalesce(sum(bedbug_recent), 0)::int
  from in_r
$function$;

drop function if exists public.neighborhood_risk_counts_v2(double precision, double precision, integer, integer);

-- Nightly refreshes, staggered after the existing 07:20/07:25/07:30 cache jobs.
select cron.schedule('refresh-risk-cells', '35 7 * * *', 'SELECT public.refresh_risk_cells()');
select cron.schedule('refresh-zip-building-stats', '45 7 * * *', 'SELECT public.refresh_zip_building_stats()');

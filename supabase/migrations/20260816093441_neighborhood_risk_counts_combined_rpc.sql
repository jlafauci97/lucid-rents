-- One-pass replacement for the four per-page radius counters
-- (count_311_noise_near x2 radii, count_rats_near, count_bedbugs_near).
-- Those each re-found nearby buildings with a PostGIS geography recheck
-- (4.3s/call measured; 11.7s mean under load, 20h cumulative in
-- pg_stat_statements) and the page fired all four per cold render — with the
-- app's timeout race abandoning the wait while the queries kept burning DB.
--
-- This computes the nearby set ONCE with planar meter math (bbox prefilter +
-- squared-distance; at NYC latitudes the planar error over 1.2km is <<1% —
-- irrelevant for complaint counts) and returns all four aggregates. Designed
-- for index-only bbox scans via idx_buildings_nyc_latlng_cover (separate
-- migration).
create or replace function public.neighborhood_risk_counts(
  p_lat double precision,
  p_lng double precision,
  p_radius_m integer default 1207,
  p_block_m integer default 121
)
returns table(noise_311 integer, noise_311_block integer, rat_failures integer, bedbug_history integer)
language sql
stable
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $$
  with nearby as (
    select id,
      (power(111320.0 * (latitude::float8 - p_lat), 2)
       + power(111320.0 * cos(radians(p_lat)) * (longitude::float8 - p_lng), 2)) as d2
    from buildings
    where metro = 'nyc'
      and latitude between p_lat - (p_radius_m / 111320.0) and p_lat + (p_radius_m / 111320.0)
      and longitude between p_lng - (p_radius_m / (111320.0 * cos(radians(p_lat))))
                        and p_lng + (p_radius_m / (111320.0 * cos(radians(p_lat))))
  ),
  in_radius as (
    select id, d2 from nearby where d2 < (p_radius_m::float8 * p_radius_m::float8)
  )
  select
    coalesce(sum(agg.noise_90d), 0)::int,
    coalesce(sum(agg.noise_90d) filter (where ir.d2 < (p_block_m::float8 * p_block_m::float8)), 0)::int,
    coalesce(sum(agg.rats_12mo), 0)::int,
    (select count(distinct br.building_id)::int
       from bedbug_reports br
       join in_radius n on br.building_id = n.id
      where br.filing_date > (now() - interval '3 years')::date)
  from in_radius ir
  left join nyc_311_per_building agg on agg.building_id = ir.id
$$;

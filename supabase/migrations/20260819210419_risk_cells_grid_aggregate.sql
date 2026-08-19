-- Precomputed ~55m grid-cell aggregates for neighborhood_risk_counts.
-- The live RPC scanned a 2.4km latitude band of buildings + thousands of
-- random nyc_311_per_building lookups per call; under crawl load it was
-- timing out ~1,500x/25min and saturating disk I/O. Cells are summed at
-- refresh time so the RPC becomes a bbox scan over a ~small, fully-cached
-- table. Cell size 0.0005 deg (~56m lat x ~42m lng at NYC latitude) —
-- constant must match refresh_risk_cells() and neighborhood_risk_counts().

create table if not exists public.risk_cells (
  cell_lat int not null,
  cell_lng int not null,
  noise_90d int not null default 0,
  rats_12mo int not null default 0,
  bedbug_recent int not null default 0,
  refreshed_at timestamptz not null default now(),
  primary key (cell_lat, cell_lng)
);

-- Read path is SECURITY DEFINER functions only; no direct API access.
alter table public.risk_cells enable row level security;

create or replace function public.refresh_risk_cells()
returns void
language sql
security definer
set search_path to 'public', 'pg_temp'
set statement_timeout to '1800s'
as $$
  insert into risk_cells (cell_lat, cell_lng, noise_90d, rats_12mo, bedbug_recent, refreshed_at)
  select floor(b.latitude / 0.0005)::int,
         floor(b.longitude / 0.0005)::int,
         coalesce(sum(a.noise_90d), 0)::int,
         coalesce(sum(a.rats_12mo), 0)::int,
         count(bb.building_id)::int,
         now()
  from buildings b
  left join nyc_311_per_building a on a.building_id = b.id
  left join (
    select distinct building_id from bedbug_reports
    where filing_date > (now() - interval '3 years')::date
  ) bb on bb.building_id = b.id
  where b.metro = 'nyc' and b.latitude is not null and b.longitude is not null
  group by 1, 2
  on conflict (cell_lat, cell_lng) do update
    set noise_90d = excluded.noise_90d,
        rats_12mo = excluded.rats_12mo,
        bedbug_recent = excluded.bedbug_recent,
        refreshed_at = excluded.refreshed_at;
  delete from risk_cells where refreshed_at < now() - interval '2 days';
$$;

-- Candidate replacement, kept separate until verified against the live RPC.
-- Radius counts come from cell aggregates (cell-center membership test);
-- the tiny block-radius count (121m default) stays exact against buildings.
create or replace function public.neighborhood_risk_counts_v2(
  p_lat double precision, p_lng double precision,
  p_radius_m integer default 1207, p_block_m integer default 121)
returns table(noise_311 integer, noise_311_block integer, rat_failures integer, bedbug_history integer)
language sql
stable
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $$
  with in_r as (
    select noise_90d, rats_12mo, bedbug_recent
    from risk_cells
    where cell_lat between floor((p_lat - p_radius_m / 111320.0) / 0.0005)::int
                       and floor((p_lat + p_radius_m / 111320.0) / 0.0005)::int
      and cell_lng between floor((p_lng - p_radius_m / (111320.0 * cos(radians(p_lat)))) / 0.0005)::int
                       and floor((p_lng + p_radius_m / (111320.0 * cos(radians(p_lat)))) / 0.0005)::int
      and (power(111320.0 * ((cell_lat + 0.5) * 0.0005 - p_lat), 2)
           + power(111320.0 * cos(radians(p_lat)) * ((cell_lng + 0.5) * 0.0005 - p_lng), 2))
          < (p_radius_m::float8 * p_radius_m::float8)
  ),
  block as (
    select coalesce(sum(a.noise_90d), 0)::int as nb
    from buildings b
    join nyc_311_per_building a on a.building_id = b.id
    where b.metro = 'nyc'
      and b.latitude between (p_lat - p_block_m / 111320.0)::numeric
                         and (p_lat + p_block_m / 111320.0)::numeric
      and b.longitude between (p_lng - p_block_m / (111320.0 * cos(radians(p_lat))))::numeric
                          and (p_lng + p_block_m / (111320.0 * cos(radians(p_lat))))::numeric
      and (power(111320.0 * (b.latitude::float8 - p_lat), 2)
           + power(111320.0 * cos(radians(p_lat)) * (b.longitude::float8 - p_lng), 2))
          < (p_block_m::float8 * p_block_m::float8)
  )
  select coalesce(sum(in_r.noise_90d), 0)::int,
         (select nb from block),
         coalesce(sum(in_r.rats_12mo), 0)::int,
         coalesce(sum(in_r.bedbug_recent), 0)::int
  from in_r
$$;

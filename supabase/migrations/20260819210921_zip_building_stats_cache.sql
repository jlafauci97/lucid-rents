-- Cached per-zip building count + average LucidIQ score for the building
-- page's "Neighborhood stats" section. The live query fetched EVERY building
-- row in the zip (up to 1000+) on each render just to count and average —
-- 652 statement timeouts in one 25-minute window under crawl load.
-- Mirrors the crime_zip_aggregates pattern: batch-refreshed, one-row read.

create table if not exists public.zip_building_stats (
  zip text primary key,
  buildings_tracked int not null default 0,
  avg_score numeric,
  refreshed_at timestamptz not null default now()
);

alter table public.zip_building_stats enable row level security;

create policy zip_building_stats_select_public
  on public.zip_building_stats for select using (true);

create or replace function public.refresh_zip_building_stats()
returns void
language sql
security definer
set search_path to 'public', 'pg_temp'
set statement_timeout to '1200s'
as $$
  insert into zip_building_stats (zip, buildings_tracked, avg_score, refreshed_at)
  select zip_code, count(*)::int, avg(overall_score), now()
  from buildings
  where zip_code is not null
  group by zip_code
  on conflict (zip) do update
    set buildings_tracked = excluded.buildings_tracked,
        avg_score = excluded.avg_score,
        refreshed_at = excluded.refreshed_at;
  delete from zip_building_stats where refreshed_at < now() - interval '2 days';
$$;

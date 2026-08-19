-- Extend zip_building_stats to carry every field neighborhood_stats returns,
-- and rewrite that RPC cache-first. The live version did two aggregate passes
-- over buildings per zip on every cold neighborhood/[slug] render — 0.2s with
-- the idx_buildings_zip_stats_cover index, 6-21s (and one thrown 500) while
-- that index was dropped during the 2026-08-19 count-recount sweep. Render
-- paths should not depend on maintenance state of a 3.5M-row table's indexes.

alter table public.zip_building_stats
  add column if not exists total_violations bigint not null default 0,
  add column if not exists total_complaints bigint not null default 0,
  add column if not exists total_litigations bigint not null default 0,
  add column if not exists buildings_with_reviews int not null default 0,
  add column if not exists total_reviews bigint not null default 0,
  add column if not exists top_landlord text,
  add column if not exists top_landlord_buildings int not null default 0;

create or replace function public.refresh_zip_building_stats()
returns void
language sql
security definer
set search_path to 'public', 'pg_temp'
set statement_timeout to '1200s'
as $$
  insert into zip_building_stats (
    zip, buildings_tracked, avg_score, total_violations, total_complaints,
    total_litigations, buildings_with_reviews, total_reviews,
    top_landlord, top_landlord_buildings, refreshed_at)
  with s as (
    select zip_code,
           count(*)::int as cnt,
           avg(overall_score) as avg_score,
           coalesce(sum(violation_count), 0)::bigint as tv,
           coalesce(sum(complaint_count), 0)::bigint as tc,
           coalesce(sum(litigation_count), 0)::bigint as tl,
           (count(*) filter (where review_count > 0))::int as bwr,
           coalesce(sum(review_count), 0)::bigint as tr
    from buildings
    where zip_code is not null
    group by zip_code
  ),
  per_owner as (
    select zip_code, owner_name, count(*)::int as cnt
    from buildings
    where zip_code is not null and owner_name is not null
    group by zip_code, owner_name
  ),
  top as (
    select distinct on (zip_code) zip_code, owner_name, cnt
    from per_owner
    order by zip_code, cnt desc
  )
  select s.zip_code, s.cnt, s.avg_score, s.tv, s.tc, s.tl, s.bwr, s.tr,
         top.owner_name, coalesce(top.cnt, 0), now()
  from s left join top on top.zip_code = s.zip_code
  on conflict (zip) do update
    set buildings_tracked = excluded.buildings_tracked,
        avg_score = excluded.avg_score,
        total_violations = excluded.total_violations,
        total_complaints = excluded.total_complaints,
        total_litigations = excluded.total_litigations,
        buildings_with_reviews = excluded.buildings_with_reviews,
        total_reviews = excluded.total_reviews,
        top_landlord = excluded.top_landlord,
        top_landlord_buildings = excluded.top_landlord_buildings,
        refreshed_at = excluded.refreshed_at;
  delete from zip_building_stats where refreshed_at < now() - interval '2 days';
$$;

-- Cache-first, with the old live aggregation kept as fallback for zips that
-- appear between nightly refreshes (returns the same always-one-row shape).
create or replace function public.neighborhood_stats(target_zip text)
returns table(building_count bigint, avg_score numeric, total_violations bigint,
              total_complaints bigint, total_litigations bigint,
              buildings_with_reviews bigint, total_reviews bigint,
              top_landlord text, top_landlord_buildings bigint)
language sql
stable
set search_path to 'public', 'pg_temp'
as $$
  select z.buildings_tracked::bigint, z.avg_score::numeric(4,2),
         z.total_violations, z.total_complaints, z.total_litigations,
         z.buildings_with_reviews::bigint, z.total_reviews,
         z.top_landlord, z.top_landlord_buildings::bigint
  from zip_building_stats z
  where z.zip = target_zip
  union all
  (
    with stats as (
      select count(*) as building_count,
             avg(overall_score)::numeric(4,2) as avg_score,
             coalesce(sum(violation_count), 0) as total_violations,
             coalesce(sum(complaint_count), 0) as total_complaints,
             coalesce(sum(litigation_count), 0) as total_litigations,
             count(*) filter (where review_count > 0) as buildings_with_reviews,
             coalesce(sum(review_count), 0) as total_reviews
      from buildings
      where zip_code = target_zip
    ),
    top as (
      select owner_name, count(*) as cnt
      from buildings
      where zip_code = target_zip and owner_name is not null
      group by owner_name
      order by count(*) desc
      limit 1
    )
    select s.building_count, s.avg_score, s.total_violations, s.total_complaints,
           s.total_litigations, s.buildings_with_reviews, s.total_reviews,
           t.owner_name, coalesce(t.cnt, 0)
    from stats s left join top t on true
    where not exists (select 1 from zip_building_stats where zip = target_zip)
  )
$$;

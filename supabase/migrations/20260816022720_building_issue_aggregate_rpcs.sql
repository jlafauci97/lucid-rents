-- Server-side aggregates for the building page's Issues section. Previously
-- the page pulled up to 5000 hpd_violations rows + every complaints_311 row +
-- every dated row across 4 tables (7-year trends) per cold render, just to
-- count in Node. These push the aggregation into Postgres; the JS taxonomy
-- (categorizeHpdViolation) still runs client of the RPC, over distinct
-- descriptions instead of raw rows.

create or replace function public.building_hpd_desc_counts(_building_id uuid)
returns table(nov_description text, cnt bigint)
language sql
stable
set search_path = public
as $$
  select v.nov_description, count(*)::bigint
  from public.hpd_violations v
  where v.building_id = _building_id
  group by v.nov_description
$$;

create or replace function public.building_311_type_counts(_building_id uuid)
returns table(complaint_type text, cnt bigint)
language sql
stable
set search_path = public
as $$
  select c.complaint_type, count(*)::bigint
  from public.complaints_311 c
  where c.building_id = _building_id
  group by c.complaint_type
$$;

create or replace function public.building_issue_monthly_trends(_building_id uuid, _since date)
returns table(month text, hpd bigint, dob bigint, complaints bigint, evictions bigint)
language sql
stable
set search_path = public
as $$
  with h as (
    select to_char(inspection_date, 'YYYY-MM') m, count(*)::bigint c
    from public.hpd_violations
    where building_id = _building_id and inspection_date >= _since
    group by 1
  ),
  d as (
    select to_char(issue_date, 'YYYY-MM') m, count(*)::bigint c
    from public.dob_violations
    where building_id = _building_id and issue_date >= _since
    group by 1
  ),
  c3 as (
    select to_char(created_date, 'YYYY-MM') m, count(*)::bigint c
    from public.complaints_311
    where building_id = _building_id and created_date >= _since
    group by 1
  ),
  e as (
    select to_char(executed_date, 'YYYY-MM') m, count(*)::bigint c
    from public.evictions
    where building_id = _building_id and executed_date >= _since
    group by 1
  ),
  months as (
    select m from h union select m from d union select m from c3 union select m from e
  )
  select months.m,
         coalesce(h.c, 0), coalesce(d.c, 0), coalesce(c3.c, 0), coalesce(e.c, 0)
  from months
  left join h on h.m = months.m
  left join d on d.m = months.m
  left join c3 on c3.m = months.m
  left join e on e.m = months.m
  where months.m is not null
  order by months.m
$$;

-- RPC: get_landlord_agg_stats(p_slug text, p_metro text)
-- Returns name, slug, building_count, total_violations, total_complaints
-- for a single landlord row from landlord_stats filtered by slug + metro.
-- Used by getLandlordStats() in src/lib/landlord-stats.ts.

create or replace function get_landlord_agg_stats(p_slug text, p_metro text)
returns table (
  name                text,
  slug                text,
  building_count      int,
  total_violations    int,
  total_complaints    int
)
language sql
stable
security definer
as $$
  select
    ls.name,
    ls.slug,
    ls.building_count,
    ls.total_violations,
    ls.total_complaints
  from landlord_stats ls
  where ls.slug  = p_slug
    and ls.metro = p_metro
  limit 1;
$$;

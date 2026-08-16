-- Per-zip max(updated_at) for sitemap lastmod stamps. Replaces the previous
-- approach of sampling 10K building rows through PostgREST, which silently
-- truncated: only zips present in the sample got sitemap entries, so the
-- static/hubs sitemaps' zip URL set varied run to run.
-- Function-level statement_timeout because the group-by scans ~2.5M rows and
-- the role default (8s) is too tight; runs once nightly from the sitemap job.
-- NOTE: superseded by 20260816022400 — the aggregate exceeded 120s in prod
-- and the generator now enumerates its curated ZIP_MAPS constants instead.
create or replace function public.sitemap_zip_lastmods()
returns table(zip_code text, metro text, max_updated_at timestamptz)
language sql
stable
set statement_timeout to '120s'
as $$
  select b.zip_code, b.metro, max(b.updated_at)
  from public.buildings b
  where b.zip_code is not null
    and b.metro in ('nyc', 'los-angeles', 'chicago')
  group by b.zip_code, b.metro
$$;

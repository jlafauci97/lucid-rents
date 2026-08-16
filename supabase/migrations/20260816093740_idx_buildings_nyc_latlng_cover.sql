-- Index-only bbox scans for neighborhood_risk_counts. Built against
-- production with CREATE INDEX CONCURRENTLY via pg_cron; IF NOT EXISTS makes
-- this a no-op there, and fresh databases build it plainly.
create index if not exists idx_buildings_nyc_latlng_cover
  on public.buildings (latitude, longitude) include (id)
  where metro = 'nyc' and latitude is not null and longitude is not null;

-- Full (non-partial) sort index for the borough building directory's
-- path-segment pagination (/buildings/[borough]/page/N). The existing
-- idx_buildings_metro_borough_violations is partial (violation_count > 0),
-- so the unfiltered listing query planned a scan+sort over the whole borough
-- and hit the 8s statement_timeout from offset ~2500 onward.
--
-- Built against production with CREATE INDEX CONCURRENTLY via pg_cron
-- (5m45s on 2026-08-16; role statement_timeout temporarily raised). Written
-- here without CONCURRENTLY because migrations run in a transaction;
-- IF NOT EXISTS makes it a no-op on production.
CREATE INDEX IF NOT EXISTS idx_buildings_dir_metro_borough_viol
  ON public.buildings (metro, borough, violation_count DESC NULLS LAST);

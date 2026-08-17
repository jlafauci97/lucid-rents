-- Covering replacement for the borough-directory pagination index.
--
-- The directory's /page/N routes use OFFSET pagination, and Postgres must
-- walk every skipped index entry AND heap-fetch its ~1.3KB row just to throw
-- it away: page 250 = 4.8s cold, page ~1000+ blew anon's 8s statement_timeout
-- (measured 2026-08-17; these pages dominated Search Console's average crawl
-- response time). INCLUDE (id) lets the listing's id-only page query run as
-- an index-only scan (~0.5s even at offset 37K); the 25 visible rows are then
-- fetched by primary key.
--
-- Built against production with CREATE INDEX CONCURRENTLY via pg_cron
-- (2026-08-17; role statement_timeout temporarily raised). Written here
-- without CONCURRENTLY because migrations run in a transaction; IF NOT
-- EXISTS makes it a no-op on production.
CREATE INDEX IF NOT EXISTS idx_buildings_dir_metro_borough_viol_cover
  ON public.buildings (metro, borough, violation_count DESC NULLS LAST)
  INCLUDE (id);

-- Superseded by the covering index above (same key columns).
DROP INDEX IF EXISTS public.idx_buildings_dir_metro_borough_viol;

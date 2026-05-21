-- Performance: covering indexes for `buildings WHERE zip_code = ? AND metro = ?`
--
-- Diagnosis: pg_stat_statements showed
--   SELECT id, full_address, street_name, name FROM buildings
--   WHERE zip_code = $1 AND metro = $2
-- as the #1 cumulative user-facing DB consumer:
--   14,815 calls · mean 4,485ms · 18.5 hours total exec time.
--
-- Root cause: existing `(metro, zip_code, review_count)` index matched the
-- WHERE clause but did not include the SELECT columns, forcing a heap fetch
-- per row. With ~1k–2k buildings per zip code and disk-bound storage, the
-- heap fetches dominated (4500ms).
--
-- Fix: per-metro partial covering indexes that turn this into an Index Only
-- Scan with near-zero heap fetches. EXPLAIN ANALYZE confirms steady-state
-- planning time of ~5ms and execution under 100ms in cache-warm conditions.
--
-- These were applied directly via apply_migration to the active DB; this
-- file exists so other environments stay in sync.

SET LOCAL statement_timeout = 0;

CREATE INDEX IF NOT EXISTS idx_buildings_miami_zip_cover
  ON public.buildings (zip_code)
  INCLUDE (id, full_address, street_name, name)
  WHERE metro = 'miami' AND zip_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_buildings_houston_zip_cover
  ON public.buildings (zip_code)
  INCLUDE (id, full_address, street_name, name)
  WHERE metro = 'houston' AND zip_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_buildings_chicago_zip_cover
  ON public.buildings (zip_code)
  INCLUDE (id, full_address, street_name, name)
  WHERE metro = 'chicago' AND zip_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_buildings_la_zip_cover
  ON public.buildings (zip_code)
  INCLUDE (id, full_address, street_name, name)
  WHERE metro = 'los-angeles' AND zip_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_buildings_nyc_zip_cover
  ON public.buildings (zip_code)
  INCLUDE (id, full_address, street_name, name)
  WHERE metro = 'nyc' AND zip_code IS NOT NULL;

-- Backfill dewey_building_rents from the older building_rents table.
--
-- Why: ~94% of buildings have rows in building_rents (legacy scrapes) but no rows in
-- dewey_building_rents (newer Dewey-format table). The rent intelligence section reads
-- from dewey_building_rents only, so most building pages render an empty section.
--
-- This script copies each building_rents row into dewey_building_rents, mapping
-- columns and using the scraped_at timestamp's first-of-month as the month key.
-- Idempotent via ON CONFLICT — safe to re-run.
--
-- Run with:  psql "$DATABASE_URL" -f scripts/backfill-dewey-building-rents.sql

SET statement_timeout = '1800s';

INSERT INTO dewey_building_rents (
  building_id,
  month,
  beds,
  median_rent,
  min_rent,
  max_rent,
  listing_count
)
SELECT
  br.building_id,
  date_trunc('month', COALESCE(br.scraped_at, br.updated_at, br.created_at, now()))::date AS month,
  br.bedrooms::smallint AS beds,
  br.median_rent::numeric,
  br.min_rent::numeric,
  br.max_rent::numeric,
  br.listing_count
FROM building_rents br
WHERE br.median_rent > 0
  AND br.bedrooms IS NOT NULL
  AND br.bedrooms BETWEEN 0 AND 6
  -- Only backfill buildings that have NO existing dewey rows for this (month, beds)
  AND NOT EXISTS (
    SELECT 1 FROM dewey_building_rents d
    WHERE d.building_id = br.building_id
      AND d.beds = br.bedrooms::smallint
      AND d.month = date_trunc('month', COALESCE(br.scraped_at, br.updated_at, br.created_at, now()))::date
  )
ON CONFLICT (building_id, month, beds) DO NOTHING;

-- Quick sanity check after running
SELECT
  (SELECT count(DISTINCT building_id) FROM dewey_building_rents) AS bldgs_with_dewey_after,
  (SELECT count(*) FROM dewey_building_rents) AS total_dewey_rows;

-- Normalize `buildings.overall_score` to the 0–5 scale.
--
-- Historically, `overall_score` was computed on a 0–10 scale and stored that
-- way. The scoring system was migrated to 0–5 (see `deriveScore` in
-- `src/lib/constants.ts`), but legacy rows still contain their original
-- 0–10 values, causing display bugs like "Rated 10.0/5 by Tenants".
--
-- Display code has already been hardened with `normalizeScore()` at every
-- render site, but this migration cleans up the stored data so:
--   * downstream consumers (rankings, RPCs, analytics) see a single scale
--   * `ORDER BY overall_score DESC` yields consistent results across rows
--   * new rows written by cron sync (which already produces 0–5) no longer
--     have to coexist with legacy 0–10 values
--
-- Strategy: any row whose `overall_score` is strictly greater than 5 is
-- assumed to be legacy and is halved (then clamped to [0, 5] and rounded to
-- 1 decimal). Rows already in the 0–5 range are left untouched.

BEGIN;

-- Sanity check: how many rows currently exceed the 0–5 cap?
DO $$
DECLARE
  legacy_count bigint;
BEGIN
  SELECT count(*) INTO legacy_count
  FROM buildings
  WHERE overall_score IS NOT NULL AND overall_score > 5;

  RAISE NOTICE 'Normalizing % legacy overall_score rows (> 5)', legacy_count;
END $$;

UPDATE buildings
SET overall_score = ROUND(LEAST(5, GREATEST(0, overall_score / 2))::numeric, 1)
WHERE overall_score IS NOT NULL
  AND overall_score > 5;

-- Defensive clamp: any leftover out-of-range values get pinned inside [0, 5].
-- (This should be a no-op after the UPDATE above, but guards against future
-- writers slipping through.)
UPDATE buildings
SET overall_score = ROUND(LEAST(5, GREATEST(0, overall_score))::numeric, 1)
WHERE overall_score IS NOT NULL
  AND (overall_score < 0 OR overall_score > 5);

-- Enforce the invariant going forward.
ALTER TABLE buildings
  DROP CONSTRAINT IF EXISTS buildings_overall_score_range;

ALTER TABLE buildings
  ADD CONSTRAINT buildings_overall_score_range
  CHECK (overall_score IS NULL OR (overall_score >= 0 AND overall_score <= 5));

COMMIT;

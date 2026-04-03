-- Drop indexes with 0 scans that are not used for upserts or constraints
-- Saves ~54 MB disk + write overhead on every INSERT/UPDATE

-- 30 MB — violations are always fetched by building_id, never filtered by class alone
DROP INDEX IF EXISTS idx_hpd_violations_class;

-- 24 MB — one-time Miami 311 linking index, never used for reads
DROP INDEX IF EXISTS idx_311_miami_addr;

-- Add partial index for building score count queries (was taking 107s without it)
CREATE INDEX IF NOT EXISTS idx_buildings_metro_score
ON buildings (metro) WHERE overall_score IS NOT NULL;

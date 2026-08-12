-- Building dedup unique constraints
-- Run AFTER dedup-buildings.mjs has cleaned the data and verification passes
-- Originally applied to prod with CREATE INDEX CONCURRENTLY (online build on
-- live data). CONCURRENTLY cannot run in the branch runner's pipeline, and a
-- fresh preview database is empty, so plain CREATE INDEX is equivalent here.

-- Natural key constraints (partial — only where key is populated)
CREATE UNIQUE INDEX IF NOT EXISTS idx_buildings_apn_unique
  ON buildings (apn) WHERE apn IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_buildings_pin_unique
  ON buildings (pin) WHERE pin IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_buildings_hcad_unique
  ON buildings (hcad_account) WHERE hcad_account IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_buildings_folio_unique
  ON buildings (folio_number) WHERE folio_number IS NOT NULL;

-- Slug uniqueness per metro+borough (only where borough is populated)
CREATE UNIQUE INDEX IF NOT EXISTS idx_buildings_metro_borough_slug
  ON buildings (metro, borough, slug) WHERE borough IS NOT NULL;

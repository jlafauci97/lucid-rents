-- Add slug column to buildings for SEO-friendly URLs
-- Slug format: "34-15-parsons-boulevard-queens-ny-11354"

ALTER TABLE buildings ADD COLUMN IF NOT EXISTS slug text;

-- Generate slugs from full_address
UPDATE buildings SET slug = regexp_replace(
  regexp_replace(lower(full_address), '[^a-z0-9]+', '-', 'g'),
  '(^-+|-+$)', '', 'g'
) WHERE slug IS NULL;

-- Make slug NOT NULL after backfill
ALTER TABLE buildings ALTER COLUMN slug SET NOT NULL;

-- Unique index on slug (address+zip makes each globally unique)
CREATE UNIQUE INDEX IF NOT EXISTS idx_buildings_slug ON buildings(slug);

-- Composite index for borough-scoped lookups
CREATE INDEX IF NOT EXISTS idx_buildings_borough_slug ON buildings(lower(borough), slug);

-- Index for borough directory pages sorted by violations
CREATE INDEX IF NOT EXISTS idx_buildings_borough_violations ON buildings(borough, violation_count DESC);

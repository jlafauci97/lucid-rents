-- Add metro column to reviews table (missed in multi_city_foundation migration)
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS metro text NOT NULL DEFAULT 'nyc';
CREATE INDEX IF NOT EXISTS idx_reviews_metro ON reviews(metro);

-- Backfill metro for existing reviews based on their linked building's metro
UPDATE reviews r
SET metro = b.metro
FROM buildings b
WHERE r.building_id = b.id
  AND r.metro = 'nyc'
  AND b.metro != 'nyc';

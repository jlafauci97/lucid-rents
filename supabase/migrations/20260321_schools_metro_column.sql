-- Add metro column to nearby_schools
ALTER TABLE nearby_schools ADD COLUMN IF NOT EXISTS metro text NOT NULL DEFAULT 'nyc';

-- Create index for metro-filtered queries
CREATE INDEX IF NOT EXISTS idx_nearby_schools_metro ON nearby_schools(metro);

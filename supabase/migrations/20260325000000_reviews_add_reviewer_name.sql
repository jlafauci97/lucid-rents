-- Add reviewer_name column for imported reviews (no user account)
-- Make user_id nullable so scraped reviews can exist without auth users

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS reviewer_name text;

ALTER TABLE reviews ALTER COLUMN user_id DROP NOT NULL;

-- Index for finding reviews by reviewer_name (for dedup on re-runs)
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_name ON reviews (reviewer_name) WHERE reviewer_name IS NOT NULL;

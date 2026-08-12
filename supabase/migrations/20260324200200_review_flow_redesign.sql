-- Review Flow Redesign Migration
-- Adds new columns to reviews table and creates review_photos and review_amenities tables

-- New columns on reviews
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS landlord_name text;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS would_recommend boolean;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS is_pet_friendly boolean;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS reviewer_display_preference text NOT NULL DEFAULT 'name' CHECK (reviewer_display_preference IN ('name', 'anonymous'));
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS pro_tags text[] DEFAULT '{}';
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS con_tags text[] DEFAULT '{}';

-- Review photos table
CREATE TABLE IF NOT EXISTS review_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_review_photos_review_id ON review_photos (review_id);

-- Review amenities table
CREATE TABLE IF NOT EXISTS review_amenities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  building_id uuid NOT NULL REFERENCES buildings(id),
  amenity text NOT NULL,
  category text NOT NULL,
  confirmed boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_review_amenities_building ON review_amenities (building_id, amenity);

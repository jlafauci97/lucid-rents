-- Add building name to search_vector so buildings are searchable by name
-- Also clean up junk records with unit numbers in street_name

-- Drop and recreate search_vector to include name field
ALTER TABLE buildings DROP COLUMN IF EXISTS search_vector;
ALTER TABLE buildings ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english',
      COALESCE(full_address, '') || ' ' ||
      COALESCE(borough, '') || ' ' ||
      COALESCE(zip_code, '') || ' ' ||
      COALESCE(owner_name, '') || ' ' ||
      COALESCE(name, '')
    )
  ) STORED;

-- Recreate the GIN index for full-text search
CREATE INDEX IF NOT EXISTS idx_buildings_search_vector ON buildings USING GIN (search_vector);

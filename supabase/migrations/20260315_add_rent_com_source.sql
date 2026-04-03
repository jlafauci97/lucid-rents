-- Add 'rent_com' as a valid source for building_rents and building_amenities
-- Run this in the Supabase Dashboard SQL editor

-- Drop and recreate the check constraint on building_rents
ALTER TABLE building_rents DROP CONSTRAINT IF EXISTS building_rents_source_check;
ALTER TABLE building_rents ADD CONSTRAINT building_rents_source_check
  CHECK (source IN ('streeteasy', 'zillow', 'rent_com'));

-- Drop and recreate the check constraint on building_amenities
ALTER TABLE building_amenities DROP CONSTRAINT IF EXISTS building_amenities_source_check;
ALTER TABLE building_amenities ADD CONSTRAINT building_amenities_source_check
  CHECK (source IN ('streeteasy', 'zillow', 'rent_com'));

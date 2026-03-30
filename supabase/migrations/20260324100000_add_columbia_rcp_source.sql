-- Add 'columbia_rcp' and other missing sources to all tables with source check constraints

-- building_rents
ALTER TABLE building_rents DROP CONSTRAINT IF EXISTS building_rents_source_check;
ALTER TABLE building_rents ADD CONSTRAINT building_rents_source_check
  CHECK (source IN ('streeteasy', 'zillow', 'rent_com', 'columbia_rcp', 'apartmentratings', 'redfin', 'compass', 'zumper'));

-- building_amenities
ALTER TABLE building_amenities DROP CONSTRAINT IF EXISTS building_amenities_source_check;
ALTER TABLE building_amenities ADD CONSTRAINT building_amenities_source_check
  CHECK (source IN ('streeteasy', 'zillow', 'rent_com', 'columbia_rcp', 'apartmentratings', 'redfin', 'compass', 'zumper'));

-- building_listings
ALTER TABLE building_listings DROP CONSTRAINT IF EXISTS building_listings_source_check;
ALTER TABLE building_listings ADD CONSTRAINT building_listings_source_check
  CHECK (source IN ('rent_com', 'streeteasy', 'zillow', 'columbia_rcp', 'apartmentratings', 'redfin', 'compass', 'zumper'));

-- unit_listings
DO $$
DECLARE
  cname text;
BEGIN
  SELECT c.conname INTO cname
  FROM pg_constraint c
  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
  WHERE c.conrelid = 'unit_listings'::regclass
    AND c.contype = 'c'
    AND a.attname = 'source'
  LIMIT 1;
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE unit_listings DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE unit_listings ADD CONSTRAINT unit_listings_source_check
  CHECK (source IN ('streeteasy', 'zillow', 'rent_com', 'columbia_rcp', 'apartmentratings', 'redfin', 'compass', 'zumper'));

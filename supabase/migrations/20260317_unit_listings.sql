-- Per-unit listing data scraped from Zillow/StreetEasy/Rent.com
-- Links individual apartment listings (with rent, beds, sqft) to specific units
CREATE TABLE IF NOT EXISTS unit_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  building_id uuid NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('streeteasy', 'zillow', 'rent_com')),

  -- Unit details
  unit_number text NOT NULL,
  price int,                          -- monthly rent
  bedrooms int,
  bathrooms numeric(3,1),
  sqft int,

  -- Listing link
  listing_url text,

  -- Status
  available boolean DEFAULT true,

  scraped_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One listing per unit + source
CREATE UNIQUE INDEX IF NOT EXISTS unit_listings_uniq
  ON unit_listings (unit_id, source);

CREATE INDEX IF NOT EXISTS unit_listings_building_id_idx
  ON unit_listings (building_id);

-- Allow anon reads
ALTER TABLE unit_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read" ON unit_listings
  FOR SELECT USING (true);

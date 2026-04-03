-- 1. Add latitude/longitude to buildings table
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS latitude numeric;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS longitude numeric;

-- 2. Populate from dob_permits (most buildings have at least one permit with coords)
UPDATE buildings b
SET latitude = p.lat, longitude = p.lng
FROM (
  SELECT DISTINCT ON (building_id) building_id,
    latitude::numeric AS lat, longitude::numeric AS lng
  FROM dob_permits
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL
    AND latitude::numeric BETWEEN 40.4 AND 41.0
    AND longitude::numeric BETWEEN -74.3 AND -73.6
  ORDER BY building_id, issued_date DESC NULLS LAST
) p
WHERE b.id = p.building_id AND b.latitude IS NULL;

-- 3. Fill gaps from complaints_311
UPDATE buildings b
SET latitude = c.lat, longitude = c.lng
FROM (
  SELECT DISTINCT ON (building_id) building_id,
    latitude::numeric AS lat, longitude::numeric AS lng
  FROM complaints_311
  WHERE building_id IS NOT NULL
    AND latitude IS NOT NULL AND longitude IS NOT NULL
    AND latitude::numeric BETWEEN 40.4 AND 41.0
    AND longitude::numeric BETWEEN -74.3 AND -73.6
  ORDER BY building_id, created_date DESC NULLS LAST
) c
WHERE b.id = c.building_id AND b.latitude IS NULL;

-- 4. Create transit_stops table
CREATE TABLE IF NOT EXISTS transit_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('subway', 'bus', 'citibike', 'ferry')),
  stop_id text NOT NULL,
  name text NOT NULL,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  routes text[] DEFAULT '{}',
  ada_accessible boolean,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (type, stop_id)
);

-- 5. Create indexes for spatial queries
CREATE INDEX IF NOT EXISTS idx_transit_stops_type_lat_lng
  ON transit_stops (type, latitude, longitude);

CREATE INDEX IF NOT EXISTS idx_buildings_lat_lng
  ON buildings (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- 6. Enable RLS but allow anon reads (transit data is public)
ALTER TABLE transit_stops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on transit_stops"
  ON transit_stops FOR SELECT
  USING (true);

-- Schools & colleges nearby feature
-- Source: NYC Facilities Database (ji82-xba5)

CREATE TABLE nearby_schools (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL,          -- public_school, charter_school, private_school, college
  school_id TEXT NOT NULL,     -- uid from facilities DB
  name TEXT NOT NULL,
  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,
  address TEXT,
  grades TEXT,                 -- e.g. "Elementary", "High School", "K-8", "4-Year College"
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(type, school_id)
);

CREATE INDEX idx_nearby_schools_type_lat_lng ON nearby_schools(type, latitude, longitude);

ALTER TABLE nearby_schools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON nearby_schools FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS encampments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sr_number text UNIQUE NOT NULL,
  created_date timestamptz NOT NULL,
  closed_date timestamptz,
  status text,
  request_type text,
  address text,
  zip_code text,
  latitude double precision,
  longitude double precision,
  council_district text,
  nc_name text,
  metro text NOT NULL DEFAULT 'los-angeles',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_encampments_lat_lng ON encampments(latitude, longitude) WHERE latitude IS NOT NULL;
CREATE INDEX idx_encampments_metro ON encampments(metro);
CREATE INDEX idx_encampments_created ON encampments(created_date DESC);

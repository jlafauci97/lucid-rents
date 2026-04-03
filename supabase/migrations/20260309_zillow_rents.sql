-- Zillow ZORI (Observed Rent Index) data by zip code
CREATE TABLE zillow_rents (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  zip_code    text NOT NULL,
  date        date NOT NULL,
  median_rent numeric(10,2),
  imported_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(zip_code, date)
);

CREATE INDEX idx_zillow_rents_zip_date ON zillow_rents (zip_code, date DESC);

ALTER TABLE zillow_rents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_zillow" ON zillow_rents FOR SELECT USING (true);

-- RPC: Citywide rent trend (monthly average across NYC zips)
CREATE OR REPLACE FUNCTION rent_trend_citywide()
RETURNS TABLE(date date, avg_rent numeric)
LANGUAGE sql STABLE AS $$
  SELECT zr.date, ROUND(AVG(zr.median_rent), 0) AS avg_rent
  FROM zillow_rents zr
  JOIN buildings b ON b.zip_code = zr.zip_code
  WHERE zr.median_rent IS NOT NULL
  GROUP BY zr.date
  ORDER BY zr.date;
$$;

-- RPC: Rent trend by borough (monthly)
CREATE OR REPLACE FUNCTION rent_trend_by_borough()
RETURNS TABLE(borough text, date date, avg_rent numeric)
LANGUAGE sql STABLE AS $$
  SELECT b.borough, zr.date,
         ROUND(AVG(zr.median_rent), 0) AS avg_rent
  FROM zillow_rents zr
  JOIN buildings b ON b.zip_code = zr.zip_code
  WHERE zr.median_rent IS NOT NULL
  GROUP BY b.borough, zr.date
  ORDER BY b.borough, zr.date;
$$;

-- RPC: Current median rent by zip code (latest month)
CREATE OR REPLACE FUNCTION rent_by_zip_current()
RETURNS TABLE(zip_code text, borough text, median_rent numeric, month date)
LANGUAGE sql STABLE AS $$
  SELECT zr.zip_code,
         (SELECT bb.borough FROM buildings bb WHERE bb.zip_code = zr.zip_code LIMIT 1) AS borough,
         zr.median_rent,
         zr.date AS month
  FROM zillow_rents zr
  WHERE zr.date = (SELECT MAX(date) FROM zillow_rents WHERE median_rent IS NOT NULL)
    AND zr.median_rent IS NOT NULL
  ORDER BY zr.median_rent DESC;
$$;

-- Miami city support: folio number, flood zone, 40-year recertification, condo fields

-- Folio number (Miami-Dade Property Appraiser identifier, e.g., "01-3126-032-0010")
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS folio_number text;
CREATE INDEX IF NOT EXISTS idx_buildings_folio ON buildings (folio_number) WHERE folio_number IS NOT NULL;

-- FEMA flood zone designation (AE, AH, VE, X, etc.)
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS flood_zone text;
CREATE INDEX IF NOT EXISTS idx_buildings_flood_zone ON buildings (flood_zone) WHERE flood_zone IS NOT NULL;

-- 40-year building recertification (post-Surfside mandate)
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS forty_year_recert_status text;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS forty_year_recert_due_date date;
CREATE INDEX IF NOT EXISTS idx_buildings_recert_status ON buildings (forty_year_recert_status) WHERE forty_year_recert_status IS NOT NULL;

-- Condo flag (many Miami rentals are in condo buildings)
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS is_condo boolean DEFAULT false;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS condo_association text;

-- Miami-specific aggregate counts on buildings
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS unsafe_structure_count integer DEFAULT 0;

-- Performance indexes for Miami
CREATE INDEX IF NOT EXISTS idx_buildings_metro_miami ON buildings (metro) WHERE metro = 'miami';
CREATE INDEX IF NOT EXISTS idx_buildings_miami_violations ON buildings (metro, violation_count DESC) WHERE metro = 'miami' AND violation_count > 0;
CREATE INDEX IF NOT EXISTS idx_buildings_miami_zip ON buildings (metro, zip_code) WHERE metro = 'miami';

-- Miami zip centroids
INSERT INTO zip_centroids (zip_code, latitude, longitude, borough, metro) VALUES
  ('33131', 25.7617, -80.1918, 'Brickell', 'miami'),
  ('33132', 25.7753, -80.1870, 'Downtown Miami', 'miami'),
  ('33127', 25.8100, -80.1991, 'Wynwood', 'miami'),
  ('33137', 25.8117, -80.1867, 'Edgewater', 'miami'),
  ('33139', 25.7826, -80.1341, 'South Beach', 'miami'),
  ('33140', 25.8116, -80.1298, 'Mid-Beach', 'miami'),
  ('33141', 25.8461, -80.1305, 'North Beach', 'miami'),
  ('33133', 25.7274, -80.2413, 'Coconut Grove', 'miami'),
  ('33134', 25.7493, -80.2714, 'Coral Gables', 'miami'),
  ('33125', 25.7717, -80.2353, 'Little Havana', 'miami'),
  ('33150', 25.8306, -80.1953, 'Little Haiti', 'miami'),
  ('33142', 25.8030, -80.2330, 'Allapattah', 'miami'),
  ('33136', 25.7882, -80.2063, 'Overtown', 'miami'),
  ('33129', 25.7504, -80.2018, 'Brickell', 'miami'),
  ('33144', 25.7537, -80.2895, 'Coral Way', 'miami'),
  ('33145', 25.7457, -80.2423, 'Coral Way', 'miami'),
  ('33135', 25.7665, -80.2502, 'Flagami', 'miami'),
  ('33126', 25.7632, -80.2874, 'Flagami', 'miami'),
  ('33178', 25.7904, -80.3532, 'Doral', 'miami'),
  ('33172', 25.7850, -80.3380, 'Doral', 'miami'),
  ('33166', 25.8030, -80.3171, 'Doral', 'miami'),
  ('33176', 25.6630, -80.3370, 'Kendall', 'miami'),
  ('33173', 25.6930, -80.3480, 'Kendall', 'miami'),
  ('33183', 25.6940, -80.3820, 'Kendall', 'miami'),
  ('33186', 25.6520, -80.3760, 'Kendall', 'miami'),
  ('33185', 25.7200, -80.3810, 'West Kendall', 'miami'),
  ('33182', 25.7440, -80.3950, 'West Kendall', 'miami'),
  ('33187', 25.6300, -80.4090, 'West Kendall', 'miami'),
  ('33010', 25.8576, -80.2781, 'Hialeah', 'miami'),
  ('33012', 25.8650, -80.3050, 'Hialeah', 'miami'),
  ('33013', 25.8700, -80.2750, 'Hialeah', 'miami'),
  ('33014', 25.9080, -80.3080, 'Hialeah', 'miami'),
  ('33016', 25.8870, -80.3220, 'Hialeah', 'miami'),
  ('33180', 25.9500, -80.1400, 'Aventura', 'miami'),
  ('33179', 25.9530, -80.1620, 'Aventura', 'miami'),
  ('33160', 25.9430, -80.1250, 'Sunny Isles Beach', 'miami'),
  ('33161', 25.8930, -80.1730, 'North Miami', 'miami'),
  ('33162', 25.9220, -80.1690, 'North Miami Beach', 'miami'),
  ('33167', 25.8860, -80.2140, 'North Miami', 'miami'),
  ('33168', 25.9100, -80.2230, 'Miami Gardens', 'miami'),
  ('33169', 25.9380, -80.2350, 'Miami Gardens', 'miami'),
  ('33138', 25.8260, -80.1790, 'Upper East Side', 'miami'),
  ('33149', 25.6916, -80.1629, 'Key Biscayne', 'miami'),
  ('33154', 25.8780, -80.1270, 'Surfside', 'miami'),
  ('33156', 25.6630, -80.2880, 'Pinecrest', 'miami'),
  ('33158', 25.6370, -80.3140, 'Palmetto Bay', 'miami'),
  ('33157', 25.6160, -80.3340, 'Cutler Bay', 'miami'),
  ('33143', 25.7060, -80.2950, 'South Miami', 'miami'),
  ('33146', 25.7210, -80.2810, 'Coral Gables', 'miami'),
  ('33147', 25.8350, -80.2430, 'Liberty City', 'miami'),
  ('33174', 25.7600, -80.3520, 'Sweetwater', 'miami'),
  ('33175', 25.7350, -80.3640, 'Fontainebleau', 'miami'),
  ('33184', 25.7550, -80.3950, 'Sweetwater', 'miami'),
  ('33155', 25.7320, -80.2920, 'West Miami', 'miami'),
  ('33128', 25.7770, -80.2050, 'Downtown Miami', 'miami'),
  ('33130', 25.7670, -80.2090, 'Downtown Miami', 'miami')
ON CONFLICT (zip_code) DO NOTHING;

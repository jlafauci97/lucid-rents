-- Houston city support: HCAD account number, flood-prone fields, no-zoning flag, zip centroids

-- 1. Add HCAD account number (Harris County Appraisal District identifier, e.g., "0420280000002")
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS hcad_account text;
CREATE INDEX IF NOT EXISTS idx_buildings_hcad ON buildings (hcad_account) WHERE hcad_account IS NOT NULL;

-- 2. Add Houston-specific building fields
-- Houston has NO zoning — unique among major US cities. Track land use category instead.
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS hcad_land_use text;
-- Houston is extremely flood-prone (Harvey, etc.) — track FEMA flood zone and flood history
-- (flood_zone column already exists from Miami migration, reuse it)
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS flood_claims_count integer DEFAULT 0;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS in_floodplain boolean DEFAULT false;
-- Houston super neighborhood (official city planning designation)
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS super_neighborhood text;
-- Dangerous building flag (City of Houston designation)
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS is_dangerous_building boolean DEFAULT false;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS dangerous_building_count integer DEFAULT 0;

-- 3. Performance indexes for Houston
CREATE INDEX IF NOT EXISTS idx_buildings_metro_houston ON buildings (metro) WHERE metro = 'houston';
CREATE INDEX IF NOT EXISTS idx_buildings_houston_violations ON buildings (metro, violation_count DESC) WHERE metro = 'houston' AND violation_count > 0;
CREATE INDEX IF NOT EXISTS idx_buildings_houston_zip ON buildings (metro, zip_code) WHERE metro = 'houston';
CREATE INDEX IF NOT EXISTS idx_buildings_houston_super_nbhd ON buildings (super_neighborhood) WHERE super_neighborhood IS NOT NULL AND metro = 'houston';
CREATE INDEX IF NOT EXISTS idx_buildings_houston_floodplain ON buildings (in_floodplain) WHERE metro = 'houston' AND in_floodplain = true;

-- 4. Houston zip centroids
INSERT INTO zip_centroids (zip_code, metro, avg_lat, avg_lon, sample_count) VALUES
-- Inner Loop
('77002', 'houston', 29.7544, -95.3577, 1),
('77003', 'houston', 29.7458, -95.3428, 1),
('77004', 'houston', 29.7285, -95.3622, 1),
('77005', 'houston', 29.7174, -95.4164, 1),
('77006', 'houston', 29.7418, -95.3915, 1),
('77007', 'houston', 29.7717, -95.4072, 1),
('77008', 'houston', 29.7905, -95.4136, 1),
('77009', 'houston', 29.7935, -95.3601, 1),
('77010', 'houston', 29.7590, -95.3660, 1),
('77011', 'houston', 29.7330, -95.3087, 1),
('77012', 'houston', 29.7128, -95.3195, 1),
('77019', 'houston', 29.7546, -95.4063, 1),
('77020', 'houston', 29.7631, -95.3126, 1),
('77021', 'houston', 29.7107, -95.3536, 1),
('77023', 'houston', 29.7282, -95.3286, 1),
('77025', 'houston', 29.6936, -95.4332, 1),
('77026', 'houston', 29.7856, -95.3365, 1),
('77027', 'houston', 29.7377, -95.4405, 1),
('77030', 'houston', 29.7073, -95.3997, 1),
('77046', 'houston', 29.7315, -95.4310, 1),
('77098', 'houston', 29.7325, -95.4158, 1),
-- West / Memorial / Spring Branch
('77018', 'houston', 29.8221, -95.4245, 1),
('77024', 'houston', 29.7707, -95.4805, 1),
('77035', 'houston', 29.6672, -95.4624, 1),
('77036', 'houston', 29.6958, -95.5256, 1),
('77042', 'houston', 29.7212, -95.5531, 1),
('77043', 'houston', 29.7906, -95.5110, 1),
('77055', 'houston', 29.7985, -95.4682, 1),
('77057', 'houston', 29.7434, -95.4746, 1),
('77063', 'houston', 29.7158, -95.5126, 1),
('77074', 'houston', 29.6823, -95.5107, 1),
('77077', 'houston', 29.7581, -95.5963, 1),
('77079', 'houston', 29.7695, -95.5613, 1),
('77080', 'houston', 29.8122, -95.5098, 1),
('77081', 'houston', 29.7035, -95.4987, 1),
('77082', 'houston', 29.7326, -95.5779, 1),
('77084', 'houston', 29.8171, -95.6522, 1),
('77096', 'houston', 29.6647, -95.4918, 1),
('77099', 'houston', 29.6723, -95.5570, 1),
('77401', 'houston', 29.7062, -95.4619, 1),
-- Northwest
('77014', 'houston', 29.9739, -95.3968, 1),
('77022', 'houston', 29.8189, -95.3602, 1),
('77032', 'houston', 29.9544, -95.3476, 1),
('77037', 'houston', 29.9184, -95.3701, 1),
('77038', 'houston', 29.9422, -95.3993, 1),
('77039', 'houston', 29.9280, -95.3388, 1),
('77040', 'houston', 29.8571, -95.5393, 1),
('77041', 'houston', 29.8655, -95.5797, 1),
('77060', 'houston', 29.9553, -95.3600, 1),
('77064', 'houston', 29.9132, -95.5448, 1),
('77065', 'houston', 29.9242, -95.5834, 1),
('77066', 'houston', 29.9608, -95.4955, 1),
('77067', 'houston', 29.9552, -95.4529, 1),
('77068', 'houston', 29.9733, -95.4840, 1),
('77069', 'houston', 29.9825, -95.5149, 1),
('77070', 'houston', 29.8898, -95.5686, 1),
('77086', 'houston', 29.9219, -95.4284, 1),
('77088', 'houston', 29.8615, -95.4102, 1),
('77091', 'houston', 29.8409, -95.4218, 1),
('77092', 'houston', 29.8284, -95.4573, 1),
('77093', 'houston', 29.8732, -95.3441, 1),
-- Southwest / Meyerland
('77031', 'houston', 29.6561, -95.5252, 1),
('77033', 'houston', 29.6653, -95.3714, 1),
('77045', 'houston', 29.6485, -95.4330, 1),
('77047', 'houston', 29.6218, -95.3851, 1),
('77048', 'houston', 29.6119, -95.3435, 1),
('77051', 'houston', 29.6600, -95.4148, 1),
('77053', 'houston', 29.5861, -95.5011, 1),
('77054', 'houston', 29.6901, -95.4004, 1),
('77071', 'houston', 29.6602, -95.5277, 1),
('77085', 'houston', 29.6184, -95.4664, 1),
-- Northeast
('77013', 'houston', 29.7902, -95.2751, 1),
('77015', 'houston', 29.7626, -95.2035, 1),
('77016', 'houston', 29.8472, -95.2905, 1),
('77028', 'houston', 29.8239, -95.3004, 1),
('77029', 'houston', 29.7663, -95.2551, 1),
('77044', 'houston', 29.8649, -95.1803, 1),
('77049', 'houston', 29.8344, -95.1587, 1),
('77050', 'houston', 29.8964, -95.2607, 1),
-- Southeast / Clear Lake
('77017', 'houston', 29.6762, -95.2831, 1),
('77034', 'houston', 29.6183, -95.2169, 1),
('77058', 'houston', 29.5523, -95.0957, 1),
('77059', 'houston', 29.5606, -95.1177, 1),
('77062', 'houston', 29.5698, -95.1275, 1),
('77075', 'houston', 29.6407, -95.2771, 1),
('77087', 'houston', 29.6860, -95.3308, 1),
('77089', 'houston', 29.5801, -95.2267, 1),
-- Suburbs: Sugar Land / Pearland
('77478', 'houston', 29.5928, -95.6190, 1),
('77479', 'houston', 29.5735, -95.6347, 1),
('77498', 'houston', 29.5709, -95.5873, 1),
('77581', 'houston', 29.5563, -95.2862, 1),
('77584', 'houston', 29.5229, -95.3168, 1),
-- Katy
('77449', 'houston', 29.8107, -95.7344, 1),
('77450', 'houston', 29.7758, -95.7088, 1),
('77493', 'houston', 29.7909, -95.8098, 1),
('77494', 'houston', 29.7466, -95.7689, 1),
-- Kingwood / Humble
('77338', 'houston', 29.9793, -95.2637, 1),
('77339', 'houston', 30.0451, -95.1873, 1),
('77345', 'houston', 30.0195, -95.1753, 1),
('77346', 'houston', 30.0032, -95.1558, 1),
('77396', 'houston', 29.9700, -95.2279, 1),
-- The Woodlands / Spring
('77380', 'houston', 30.1658, -95.4614, 1),
('77381', 'houston', 30.1810, -95.5065, 1),
('77382', 'houston', 30.1886, -95.4700, 1),
('77384', 'houston', 30.2086, -95.4738, 1),
('77385', 'houston', 30.1567, -95.4159, 1),
('77386', 'houston', 30.1138, -95.3923, 1),
('77388', 'houston', 30.0656, -95.4771, 1),
('77389', 'houston', 30.1043, -95.5250, 1),
-- Pasadena
('77502', 'houston', 29.6838, -95.2081, 1),
('77503', 'houston', 29.6588, -95.1831, 1),
('77504', 'houston', 29.6374, -95.1734, 1),
('77505', 'houston', 29.6684, -95.1511, 1),
('77506', 'houston', 29.6949, -95.1873, 1),
('77536', 'houston', 29.6982, -95.1196, 1)
ON CONFLICT (zip_code) DO NOTHING;

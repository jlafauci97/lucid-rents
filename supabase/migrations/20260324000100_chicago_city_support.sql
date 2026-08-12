-- Chicago City Support: PIN column, Chicago-specific building fields, zip centroids

-- 1. Add PIN column (Chicago Property Index Number - 14 digits)
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS pin text;
CREATE INDEX IF NOT EXISTS idx_buildings_pin ON buildings (pin) WHERE pin IS NOT NULL;

-- 2. Add Chicago-specific building fields
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS ward integer;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS community_area text;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS is_rlto_protected boolean DEFAULT false;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS is_scofflaw boolean DEFAULT false;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS rlto_violation_count integer DEFAULT 0;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS lead_inspection_count integer DEFAULT 0;

-- 3. Add Chicago zip centroids
INSERT INTO zip_centroids (zip_code, metro, avg_lat, avg_lon, sample_count) VALUES
('60601', 'chicago', 41.8862, -87.6186, 1),
('60602', 'chicago', 41.8827, -87.6320, 1),
('60603', 'chicago', 41.8798, -87.6269, 1),
('60604', 'chicago', 41.8782, -87.6283, 1),
('60605', 'chicago', 41.8672, -87.6176, 1),
('60606', 'chicago', 41.8825, -87.6443, 1),
('60607', 'chicago', 41.8724, -87.6556, 1),
('60608', 'chicago', 41.8521, -87.6710, 1),
('60609', 'chicago', 41.8207, -87.6538, 1),
('60610', 'chicago', 41.9033, -87.6368, 1),
('60611', 'chicago', 41.8932, -87.6177, 1),
('60612', 'chicago', 41.8802, -87.6874, 1),
('60613', 'chicago', 41.9540, -87.6568, 1),
('60614', 'chicago', 41.9218, -87.6498, 1),
('60615', 'chicago', 41.8019, -87.5984, 1),
('60616', 'chicago', 41.8424, -87.6311, 1),
('60617', 'chicago', 41.7258, -87.5481, 1),
('60618', 'chicago', 41.9464, -87.7034, 1),
('60619', 'chicago', 41.7447, -87.6062, 1),
('60620', 'chicago', 41.7416, -87.6527, 1),
('60621', 'chicago', 41.7775, -87.6404, 1),
('60622', 'chicago', 41.9012, -87.6785, 1),
('60623', 'chicago', 41.8494, -87.7189, 1),
('60624', 'chicago', 41.8801, -87.7242, 1),
('60625', 'chicago', 41.9710, -87.7013, 1),
('60626', 'chicago', 41.9966, -87.6681, 1),
('60628', 'chicago', 41.6938, -87.6244, 1),
('60629', 'chicago', 41.7790, -87.7122, 1),
('60630', 'chicago', 41.9688, -87.7610, 1),
('60631', 'chicago', 41.9893, -87.8119, 1),
('60632', 'chicago', 41.8077, -87.7088, 1),
('60634', 'chicago', 41.9462, -87.7897, 1),
('60636', 'chicago', 41.7774, -87.6676, 1),
('60637', 'chicago', 41.7825, -87.6009, 1),
('60638', 'chicago', 41.7839, -87.7682, 1),
('60639', 'chicago', 41.9204, -87.7533, 1),
('60640', 'chicago', 41.9726, -87.6617, 1),
('60641', 'chicago', 41.9456, -87.7470, 1),
('60642', 'chicago', 41.9034, -87.6607, 1),
('60643', 'chicago', 41.6988, -87.6636, 1),
('60644', 'chicago', 41.8804, -87.7493, 1),
('60645', 'chicago', 41.9976, -87.6928, 1),
('60646', 'chicago', 41.9932, -87.7578, 1),
('60647', 'chicago', 41.9203, -87.7019, 1),
('60649', 'chicago', 41.7622, -87.5692, 1),
('60651', 'chicago', 41.9005, -87.7385, 1),
('60652', 'chicago', 41.7443, -87.7114, 1),
('60653', 'chicago', 41.8169, -87.6110, 1),
('60654', 'chicago', 41.8907, -87.6353, 1),
('60655', 'chicago', 41.6944, -87.5983, 1),
('60656', 'chicago', 41.9823, -87.8403, 1),
('60657', 'chicago', 41.9399, -87.6530, 1),
('60659', 'chicago', 41.9878, -87.6911, 1),
('60660', 'chicago', 41.9904, -87.6610, 1),
('60661', 'chicago', 41.8829, -87.6507, 1)
ON CONFLICT (zip_code) DO NOTHING;

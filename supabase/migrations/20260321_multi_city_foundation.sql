-- ============================================================================
-- Multi-City Foundation: Add metro column to all tables for city partitioning
-- ============================================================================
-- "metro" distinguishes the metropolitan area (nyc, los-angeles) and avoids
-- conflicting with the existing "city" address column on buildings.

-- --------------------------------------------------------------------------
-- buildings
-- --------------------------------------------------------------------------
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS metro text NOT NULL DEFAULT 'nyc';
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS apn varchar(20);
CREATE INDEX IF NOT EXISTS idx_buildings_metro ON buildings(metro);
CREATE INDEX IF NOT EXISTS idx_buildings_metro_zip ON buildings(metro, zip_code);
CREATE INDEX IF NOT EXISTS idx_buildings_apn ON buildings(apn) WHERE apn IS NOT NULL;

-- --------------------------------------------------------------------------
-- hpd_violations
-- --------------------------------------------------------------------------
ALTER TABLE hpd_violations ADD COLUMN IF NOT EXISTS metro text NOT NULL DEFAULT 'nyc';
CREATE INDEX IF NOT EXISTS idx_hpd_violations_metro ON hpd_violations(metro);

-- --------------------------------------------------------------------------
-- complaints_311
-- --------------------------------------------------------------------------
ALTER TABLE complaints_311 ADD COLUMN IF NOT EXISTS metro text NOT NULL DEFAULT 'nyc';
CREATE INDEX IF NOT EXISTS idx_complaints_311_metro ON complaints_311(metro);

-- --------------------------------------------------------------------------
-- dob_violations
-- --------------------------------------------------------------------------
ALTER TABLE dob_violations ADD COLUMN IF NOT EXISTS metro text NOT NULL DEFAULT 'nyc';
CREATE INDEX IF NOT EXISTS idx_dob_violations_metro ON dob_violations(metro);

-- --------------------------------------------------------------------------
-- nypd_complaints
-- --------------------------------------------------------------------------
ALTER TABLE nypd_complaints ADD COLUMN IF NOT EXISTS metro text NOT NULL DEFAULT 'nyc';
CREATE INDEX IF NOT EXISTS idx_nypd_complaints_metro ON nypd_complaints(metro);

-- --------------------------------------------------------------------------
-- bedbug_reports
-- --------------------------------------------------------------------------
ALTER TABLE bedbug_reports ADD COLUMN IF NOT EXISTS metro text NOT NULL DEFAULT 'nyc';
CREATE INDEX IF NOT EXISTS idx_bedbug_reports_metro ON bedbug_reports(metro);

-- --------------------------------------------------------------------------
-- evictions
-- --------------------------------------------------------------------------
ALTER TABLE evictions ADD COLUMN IF NOT EXISTS metro text NOT NULL DEFAULT 'nyc';
CREATE INDEX IF NOT EXISTS idx_evictions_metro ON evictions(metro);

-- --------------------------------------------------------------------------
-- hpd_litigations
-- --------------------------------------------------------------------------
ALTER TABLE hpd_litigations ADD COLUMN IF NOT EXISTS metro text NOT NULL DEFAULT 'nyc';
CREATE INDEX IF NOT EXISTS idx_hpd_litigations_metro ON hpd_litigations(metro);

-- --------------------------------------------------------------------------
-- hpd_lead_violations
-- --------------------------------------------------------------------------
ALTER TABLE hpd_lead_violations ADD COLUMN IF NOT EXISTS metro text NOT NULL DEFAULT 'nyc';
CREATE INDEX IF NOT EXISTS idx_hpd_lead_violations_metro ON hpd_lead_violations(metro);

-- --------------------------------------------------------------------------
-- dob_permits
-- --------------------------------------------------------------------------
ALTER TABLE dob_permits ADD COLUMN IF NOT EXISTS metro text NOT NULL DEFAULT 'nyc';
CREATE INDEX IF NOT EXISTS idx_dob_permits_metro ON dob_permits(metro);

-- --------------------------------------------------------------------------
-- energy_benchmarks
-- --------------------------------------------------------------------------
ALTER TABLE energy_benchmarks ADD COLUMN IF NOT EXISTS metro text NOT NULL DEFAULT 'nyc';
CREATE INDEX IF NOT EXISTS idx_energy_benchmarks_metro ON energy_benchmarks(metro);

-- --------------------------------------------------------------------------
-- rent_stabilization
-- --------------------------------------------------------------------------
ALTER TABLE rent_stabilization ADD COLUMN IF NOT EXISTS metro text NOT NULL DEFAULT 'nyc';
CREATE INDEX IF NOT EXISTS idx_rent_stabilization_metro ON rent_stabilization(metro);

-- --------------------------------------------------------------------------
-- transit_stops
-- --------------------------------------------------------------------------
ALTER TABLE transit_stops ADD COLUMN IF NOT EXISTS metro text NOT NULL DEFAULT 'nyc';
CREATE INDEX IF NOT EXISTS idx_transit_stops_metro ON transit_stops(metro);

-- --------------------------------------------------------------------------
-- nyc_zip_centroids → rename to zip_centroids for multi-city use
-- --------------------------------------------------------------------------
ALTER TABLE nyc_zip_centroids RENAME TO zip_centroids;
ALTER TABLE zip_centroids ADD COLUMN IF NOT EXISTS metro text NOT NULL DEFAULT 'nyc';
CREATE INDEX IF NOT EXISTS idx_zip_centroids_metro ON zip_centroids(metro);

-- --------------------------------------------------------------------------
-- news_articles
-- --------------------------------------------------------------------------
ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS metro text NOT NULL DEFAULT 'nyc';
CREATE INDEX IF NOT EXISTS idx_news_articles_metro ON news_articles(metro);

-- --------------------------------------------------------------------------
-- nearby_schools
-- --------------------------------------------------------------------------
ALTER TABLE nearby_schools ADD COLUMN IF NOT EXISTS metro text NOT NULL DEFAULT 'nyc';
CREATE INDEX IF NOT EXISTS idx_nearby_schools_metro ON nearby_schools(metro);

-- --------------------------------------------------------------------------
-- zillow_rents
-- --------------------------------------------------------------------------
ALTER TABLE zillow_rents ADD COLUMN IF NOT EXISTS metro text NOT NULL DEFAULT 'nyc';
CREATE INDEX IF NOT EXISTS idx_zillow_rents_metro ON zillow_rents(metro);

-- --------------------------------------------------------------------------
-- sidewalk_sheds
-- --------------------------------------------------------------------------
ALTER TABLE sidewalk_sheds ADD COLUMN IF NOT EXISTS metro text NOT NULL DEFAULT 'nyc';
CREATE INDEX IF NOT EXISTS idx_sidewalk_sheds_metro ON sidewalk_sheds(metro);

-- --------------------------------------------------------------------------
-- building_amenities (if exists)
-- --------------------------------------------------------------------------
ALTER TABLE building_amenities ADD COLUMN IF NOT EXISTS metro text NOT NULL DEFAULT 'nyc';

-- --------------------------------------------------------------------------
-- unit_rent_history (if exists)
-- --------------------------------------------------------------------------
ALTER TABLE unit_rent_history ADD COLUMN IF NOT EXISTS metro text NOT NULL DEFAULT 'nyc';

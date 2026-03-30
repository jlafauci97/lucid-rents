-- Add building_id and incident_address to nypd_complaints for crime-to-building linking
ALTER TABLE nypd_complaints
  ADD COLUMN IF NOT EXISTS building_id uuid REFERENCES buildings(id),
  ADD COLUMN IF NOT EXISTS incident_address text;

CREATE INDEX IF NOT EXISTS idx_nypd_complaints_building_id ON nypd_complaints(building_id);
CREATE INDEX IF NOT EXISTS idx_nypd_complaints_metro_unlinked ON nypd_complaints(metro) WHERE building_id IS NULL;

-- Chicago Rodent Complaints (filtered from 311 data)
CREATE TABLE IF NOT EXISTS chicago_rodent_complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid REFERENCES buildings(id),
  sr_number text NOT NULL,
  service_type text,
  status text,
  created_date date,
  closed_date date,
  address text,
  zip_code text,
  ward integer,
  community_area text,
  latitude double precision,
  longitude double precision,
  imported_at timestamptz DEFAULT now(),
  metro text NOT NULL DEFAULT 'chicago',
  UNIQUE(sr_number)
);

CREATE INDEX idx_chi_rodent_building ON chicago_rodent_complaints(building_id) WHERE building_id IS NOT NULL;
CREATE INDEX idx_chi_rodent_date ON chicago_rodent_complaints(created_date DESC);
CREATE INDEX idx_chi_rodent_address ON chicago_rodent_complaints(address);

ALTER TABLE chicago_rodent_complaints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read chicago_rodent_complaints" ON chicago_rodent_complaints FOR SELECT USING (true);

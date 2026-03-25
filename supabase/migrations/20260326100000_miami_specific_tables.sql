-- Miami-specific tables: unsafe structures, 40-year recertifications, flood claims

-- Miami Unsafe Structures (condemned/unsafe buildings — critical post-Surfside)
CREATE TABLE IF NOT EXISTS miami_unsafe_structures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid REFERENCES buildings(id),
  case_number text NOT NULL,
  address text,
  violation_type text,
  violation_description text,
  case_date date,
  status text,
  case_origin text,
  latitude double precision,
  longitude double precision,
  imported_at timestamptz DEFAULT now(),
  metro text NOT NULL DEFAULT 'miami',
  UNIQUE(case_number)
);

CREATE INDEX idx_miami_unsafe_building ON miami_unsafe_structures(building_id) WHERE building_id IS NOT NULL;
CREATE INDEX idx_miami_unsafe_date ON miami_unsafe_structures(case_date DESC);
CREATE INDEX idx_miami_unsafe_status ON miami_unsafe_structures(status);
CREATE INDEX idx_miami_unsafe_metro ON miami_unsafe_structures(metro);

ALTER TABLE miami_unsafe_structures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "miami_unsafe_structures_select_public" ON miami_unsafe_structures FOR SELECT TO public USING (true);

-- Miami 40-Year Building Recertification
CREATE TABLE IF NOT EXISTS miami_forty_year_recerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid REFERENCES buildings(id),
  folio_number text,
  address text,
  process_number text,
  recertification_status text,
  due_date date,
  completion_date date,
  year_built integer,
  num_floors integer,
  total_units integer,
  engineer_name text,
  latitude double precision,
  longitude double precision,
  imported_at timestamptz DEFAULT now(),
  metro text NOT NULL DEFAULT 'miami',
  UNIQUE(COALESCE(process_number, ''), COALESCE(folio_number, ''))
);

CREATE INDEX idx_miami_recert_building ON miami_forty_year_recerts(building_id) WHERE building_id IS NOT NULL;
CREATE INDEX idx_miami_recert_due ON miami_forty_year_recerts(due_date);
CREATE INDEX idx_miami_recert_status ON miami_forty_year_recerts(recertification_status);
CREATE INDEX idx_miami_recert_folio ON miami_forty_year_recerts(folio_number) WHERE folio_number IS NOT NULL;
CREATE INDEX idx_miami_recert_metro ON miami_forty_year_recerts(metro);

ALTER TABLE miami_forty_year_recerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "miami_forty_year_recerts_select_public" ON miami_forty_year_recerts FOR SELECT TO public USING (true);

-- Miami NFIP Flood Insurance Claims (by location)
CREATE TABLE IF NOT EXISTS miami_flood_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid REFERENCES buildings(id),
  address text,
  zip_code text,
  claim_date date,
  flood_zone text,
  amount_paid numeric(12,2),
  cause_of_damage text,
  community_name text,
  latitude double precision,
  longitude double precision,
  imported_at timestamptz DEFAULT now(),
  metro text NOT NULL DEFAULT 'miami',
  UNIQUE(address, claim_date, COALESCE(amount_paid::text, ''))
);

CREATE INDEX idx_miami_flood_building ON miami_flood_claims(building_id) WHERE building_id IS NOT NULL;
CREATE INDEX idx_miami_flood_date ON miami_flood_claims(claim_date DESC);
CREATE INDEX idx_miami_flood_zone ON miami_flood_claims(flood_zone);
CREATE INDEX idx_miami_flood_metro ON miami_flood_claims(metro);

ALTER TABLE miami_flood_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "miami_flood_claims_select_public" ON miami_flood_claims FOR SELECT TO public USING (true);

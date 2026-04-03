CREATE TABLE IF NOT EXISTS proposals (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  metro text NOT NULL,
  source text NOT NULL,
  external_id text NOT NULL,
  title text NOT NULL,
  type text NOT NULL,
  status text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  borough text,
  council_district integer,
  neighborhood text,
  sponsor text,
  intro_date date NOT NULL,
  last_action_date date,
  hearing_date date,
  source_url text NOT NULL,
  latitude double precision,
  longitude double precision,
  raw_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_proposals_source_ext ON proposals(source, external_id);
CREATE INDEX idx_proposals_metro ON proposals(metro);
CREATE INDEX idx_proposals_metro_type ON proposals(metro, type);
CREATE INDEX idx_proposals_metro_status ON proposals(metro, status);
CREATE INDEX idx_proposals_metro_category ON proposals(metro, category);
CREATE INDEX idx_proposals_metro_intro ON proposals(metro, intro_date DESC);
CREATE INDEX idx_proposals_geo ON proposals(latitude, longitude) WHERE latitude IS NOT NULL;

ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "proposals_select_public" ON proposals FOR SELECT TO public USING (true);

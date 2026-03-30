CREATE TABLE IF NOT EXISTS monitored_buildings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  building_id uuid NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, building_id)
);

CREATE INDEX IF NOT EXISTS idx_monitored_buildings_user ON monitored_buildings(user_id);
CREATE INDEX IF NOT EXISTS idx_monitored_buildings_building ON monitored_buildings(building_id);

ALTER TABLE monitored_buildings ENABLE ROW LEVEL SECURITY;

CREATE POLICY monitored_buildings_select ON monitored_buildings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY monitored_buildings_insert ON monitored_buildings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY monitored_buildings_delete ON monitored_buildings FOR DELETE TO authenticated USING (auth.uid() = user_id);

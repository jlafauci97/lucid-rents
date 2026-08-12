-- Allow authenticated users to create and update units via review flow
-- (CREATE POLICY has no IF NOT EXISTS; drop-then-create instead)
DROP POLICY IF EXISTS units_insert_authenticated ON units;
CREATE POLICY units_insert_authenticated ON units FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS units_update_authenticated ON units;
CREATE POLICY units_update_authenticated ON units FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Allow authenticated users to insert rent history from reviews
DROP POLICY IF EXISTS unit_rent_history_insert_authenticated ON unit_rent_history;
CREATE POLICY unit_rent_history_insert_authenticated ON unit_rent_history FOR INSERT TO authenticated WITH CHECK (true);

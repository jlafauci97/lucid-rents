-- Allow authenticated users to create and update units via review flow
CREATE POLICY IF NOT EXISTS units_insert_authenticated ON units FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY IF NOT EXISTS units_update_authenticated ON units FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Allow authenticated users to insert rent history from reviews
CREATE POLICY IF NOT EXISTS unit_rent_history_insert_authenticated ON unit_rent_history FOR INSERT TO authenticated WITH CHECK (true);

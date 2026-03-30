-- HUD Fair Market Rent (FMR) support
-- Stores raw HUD SAFMR data by ZIP code and populates building_rents for buildings with no scraped rent data

-- 1. Raw HUD FMR lookup table
CREATE TABLE IF NOT EXISTS hud_fmr (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zip_code text NOT NULL,
  fiscal_year int NOT NULL,
  fmr_0br int,  -- studio
  fmr_1br int,
  fmr_2br int,
  fmr_3br int,
  fmr_4br int,
  imported_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(zip_code, fiscal_year)
);

CREATE INDEX IF NOT EXISTS idx_hud_fmr_zip ON hud_fmr(zip_code);

ALTER TABLE hud_fmr ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_hud_fmr" ON hud_fmr FOR SELECT USING (true);

-- 2. Add 'hud_fmr' as valid source for building_rents
ALTER TABLE building_rents DROP CONSTRAINT IF EXISTS building_rents_source_check;
ALTER TABLE building_rents ADD CONSTRAINT building_rents_source_check
  CHECK (source IN ('streeteasy', 'zillow', 'rent_com', 'columbia_rcp', 'apartmentratings', 'redfin', 'compass', 'zumper', 'openigloo', 'apartments_com', 'renthop', 'transparentcity', 'wyl', 'hud_fmr'));

-- 3. Trigger: auto-delete HUD estimate rows when real scraped data arrives
CREATE OR REPLACE FUNCTION trg_remove_hud_fmr_on_real_data()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.source <> 'hud_fmr' THEN
    DELETE FROM building_rents
    WHERE building_id = NEW.building_id
      AND source = 'hud_fmr';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER building_rents_remove_hud_fmr
  AFTER INSERT OR UPDATE ON building_rents
  FOR EACH ROW
  EXECUTE FUNCTION trg_remove_hud_fmr_on_real_data();

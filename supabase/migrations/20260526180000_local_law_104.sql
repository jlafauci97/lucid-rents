-- Local Law 104 of 2019 (NYC permit-restriction list).
--
-- NYC DOB publishes a daily-refreshed list of multifamily buildings flagged
-- for an excessive number of DOB + HPD violations per unit. These buildings
-- are restricted from receiving most construction permits until they remediate.
-- Public source: https://github.com/NYCDOB/LL104/tree/gh-pages/data
--
-- Refresh strategy: full truncate-and-insert per sync. We keep one row per BIN
-- representing the building's current standing on the list. The dataset is
-- small (~7K rows) so churn is cheap.

CREATE TABLE IF NOT EXISTS public.local_law_104 (
  bin               varchar(10) PRIMARY KEY,
  house_number      text,
  street_name       text,
  zip               varchar(10),
  borough           text,
  comm_district     integer,
  hpd_violations    integer NOT NULL DEFAULT 0,
  dob_violations    integer NOT NULL DEFAULT 0,
  total_violations  integer NOT NULL DEFAULT 0,
  dwelling_units    integer,
  vio_units_ratio   numeric(8, 2),
  latitude          numeric(10, 6),
  longitude         numeric(10, 6),
  building_id       uuid REFERENCES public.buildings (id) ON DELETE SET NULL,
  as_of_date        date NOT NULL,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_local_law_104_building_id
  ON public.local_law_104 (building_id)
  WHERE building_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_local_law_104_as_of_date
  ON public.local_law_104 (as_of_date DESC);

-- Support BIN-based joins from the LL104 sync script.
-- buildings.bin has no existing index; partial index keeps it cheap because
-- BIN only applies to NYC.
CREATE INDEX IF NOT EXISTS idx_buildings_bin
  ON public.buildings (bin)
  WHERE bin IS NOT NULL;

-- RLS: public read, service-role write (matches existing data tables).
ALTER TABLE public.local_law_104 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS local_law_104_public_read ON public.local_law_104;
CREATE POLICY local_law_104_public_read
  ON public.local_law_104
  FOR SELECT
  USING (true);

COMMENT ON TABLE  public.local_law_104     IS 'NYC DOB Local Law 104 permit-restriction list, keyed by BIN. Refreshed daily from https://github.com/NYCDOB/LL104.';
COMMENT ON COLUMN public.local_law_104.vio_units_ratio IS 'Violations-per-dwelling-unit. Triggers LL104: ≥2.0 for ≥35-unit buildings, ≥3.0 for <35-unit buildings.';
COMMENT ON COLUMN public.local_law_104.as_of_date IS 'Date the upstream NYCDOB/LL104 dataset was last refreshed (commit date on gh-pages).';

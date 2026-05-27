-- Local Law 104: store the BBL resolved via NYC GeoSearch.
--
-- The upstream LL104 dataset only carries BIN + address. Many NYC buildings
-- in our table have BBL populated but lack BIN, and addresses can differ
-- (whitespace, ordinals, abbreviations). Resolving the LL104 address through
-- the NYC GeoSearch / PAD API yields a canonical BBL, which we then match
-- against buildings.bbl (uniquely indexed) for a fast, lossless join.

ALTER TABLE public.local_law_104 ADD COLUMN IF NOT EXISTS bbl varchar(10);

CREATE INDEX IF NOT EXISTS idx_local_law_104_bbl
  ON public.local_law_104 (bbl)
  WHERE bbl IS NOT NULL;

COMMENT ON COLUMN public.local_law_104.bbl IS 'BBL resolved via NYC GeoSearch from the LL104 address. Used to match buildings.bbl when BIN/address joins fall short.';

-- /los-angeles/ellis-act queries buildings by metro + ellis_act_filing with an
-- ellis_act_date DESC order and an exact count. Without an index both the row
-- fetch and the count seq-scan the >1M-row buildings table and hit PostgREST's
-- 8s statement_timeout (57014), so the page silently renders zeros.
-- Partial index keeps it tiny: only rows with an Ellis Act filing are indexed.
CREATE INDEX IF NOT EXISTS idx_buildings_ellis_act
  ON public.buildings (metro, ellis_act_date DESC)
  WHERE ellis_act_filing = true;

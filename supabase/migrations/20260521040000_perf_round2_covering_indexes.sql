-- Round 2 performance: covering indexes for the next-biggest user-facing queries.
-- Driven by pg_stat_statements analysis — these 5 queries combined accounted
-- for ~2,500 hours/month of cumulative DB exec time.
--
-- Verified post-build via EXPLAIN ANALYZE:
--   buildings/zip_code   4,485ms → 1.76ms  (2,547× faster, Index Only Scan)
--   dewey/zip            413ms   → 16ms    (26× faster, Index Only Scan)
--   nypd/zip+date+metro  983ms   → 306ms   (3× faster, planner still picks
--                                            the older zip_date_cat index)
--
-- Applied to the active DB via apply_migration. This file keeps other
-- environments in sync.

SET LOCAL statement_timeout = 0;

-- 1. dewey_neighborhood_rents — 3.5M calls × 413ms = 398 hours/month
-- Existing unique key (city, zip, month, beds) starts with city; this query
-- only filters on zip, so the key wasn't matching.
CREATE INDEX IF NOT EXISTS idx_dewey_nbhd_rents_zip_month_cover
  ON public.dewey_neighborhood_rents (zip, month DESC)
  INCLUDE (median_rent, beds);

-- 2. buildings — 1.8M calls × 2,860ms = 1,427 hours/month (the #1 cost center)
-- Production query does NOT filter on metro, so a single cross-metro index.
CREATE INDEX IF NOT EXISTS idx_buildings_zip_score_cover
  ON public.buildings (zip_code)
  INCLUDE (id, overall_score)
  WHERE zip_code IS NOT NULL;

-- 3. nypd_complaints — 1.8M calls × 983ms + RPC = ~1,000 hours/month
-- Existing idx_nypd_complaints_zip_date_cat (zip, date, crime_category)
-- matched the WHERE but didn't INCLUDE law_category + precinct.
CREATE INDEX IF NOT EXISTS idx_nypd_zip_date_cover
  ON public.nypd_complaints (zip_code, cmplnt_date DESC)
  INCLUDE (crime_category, law_category, precinct)
  WHERE zip_code IS NOT NULL;

-- 4. buildings — 2.6M calls × 215ms = 154 hours/month
-- Powers "buildings by this landlord" sections.
CREATE INDEX IF NOT EXISTS idx_buildings_owner_metro_cover
  ON public.buildings (owner_name, metro)
  INCLUDE (overall_score)
  WHERE owner_name IS NOT NULL;

-- 5. buildings — 360K calls × 439ms = 44 hours/month
-- Powers "buildings managed by this company" sections.
CREATE INDEX IF NOT EXISTS idx_buildings_mgmt_metro_cover
  ON public.buildings (management_company, metro)
  INCLUDE (overall_score)
  WHERE management_company IS NOT NULL;

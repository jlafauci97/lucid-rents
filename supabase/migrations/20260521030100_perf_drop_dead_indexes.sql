-- Performance: drop dead and rarely-used indexes.
--
-- pg_stat_user_indexes showed these had idx_scan = 0 (or ≤ 1) across months
-- of production traffic — pure write-overhead with no read benefit. Dropping
-- speeds up every INSERT/UPDATE on these tables and reclaims ~600 MB.
--
-- These were applied directly via apply_migration to the active DB; this
-- file exists so other environments stay in sync.

-- 0 scans — never used
DROP INDEX IF EXISTS public.idx_nypd_complaints_unlinked;
DROP INDEX IF EXISTS public.idx_lahd_violation_summary_unique;
DROP INDEX IF EXISTS public.idx_sheds_address_lookup;
DROP INDEX IF EXISTS public.idx_buildings_houston_fulladdr_pattern;
DROP INDEX IF EXISTS public.idx_lahd_ccris_unique;
DROP INDEX IF EXISTS public.idx_reviews_metro_date;
DROP INDEX IF EXISTS public.idx_oath_hearings_agency;
DROP INDEX IF EXISTS public.idx_mdo_dor;
DROP INDEX IF EXISTS public.idx_hpd_contacts_last_name;
DROP INDEX IF EXISTS public.idx_hpd_contacts_metro;
DROP INDEX IF EXISTS public.idx_hpd_contacts_corporation_name;
DROP INDEX IF EXISTS public.idx_buildings_metro_lead;
DROP INDEX IF EXISTS public.idx_buildings_metro_stabilized_units;
DROP INDEX IF EXISTS public.idx_buildings_houston_market_value;
DROP INDEX IF EXISTS public.idx_nypd_null_zip;

-- ≤ 1 scan — effectively unused
DROP INDEX IF EXISTS public.idx_landlord_canon_metro_name_lower;
DROP INDEX IF EXISTS public.idx_buildings_metro_owner_null;
DROP INDEX IF EXISTS public.idx_cco_class;

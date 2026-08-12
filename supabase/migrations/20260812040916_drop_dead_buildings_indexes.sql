-- Applied to prod 2026-08-12 via MCP; this file mirrors the recorded
-- migration (version 20260812040916) so `db push` sees it as applied.
--
-- Cost cleanup: drop dead indexes on buildings (~1.3 GB).
-- Two groups:
--   1. Miami/Houston partial indexes — metros removed from product 2026-07-26.
--   2. Generic indexes with zero scans since the 2026-07-27 stats reset, each
--      structurally covered by a heavily-used sibling (slug lookups use
--      idx_buildings_slug; address matching uses the *_norm / *_trgm partials;
--      management_company is covered by idx_buildings_mgmt_metro_cover).
set local lock_timeout = '10s';

-- Miami/Houston partials
drop index if exists public.idx_buildings_houston_zip_cover;
drop index if exists public.idx_buildings_houston_addr_trgm;
drop index if exists public.idx_buildings_houston_fulladdr;
drop index if exists public.idx_buildings_houston_addr;
drop index if exists public.idx_buildings_houston_norm;
drop index if exists public.idx_buildings_houston_zip;
drop index if exists public.idx_buildings_houston_violations;
drop index if exists public.idx_buildings_houston_state_class;
drop index if exists public.idx_buildings_houston_floodplain;
drop index if exists public.idx_buildings_metro_houston;
drop index if exists public.idx_buildings_hcad_unique;
drop index if exists public.idx_buildings_miami_addr_trgm;
drop index if exists public.idx_buildings_miami_zip_cover;
drop index if exists public.idx_buildings_miami_addr;
drop index if exists public.idx_buildings_miami_norm;
drop index if exists public.idx_buildings_miami_zip;
drop index if exists public.idx_buildings_miami_violations;
drop index if exists public.idx_buildings_metro_miami;
drop index if exists public.idx_buildings_folio_unique;

-- Zero-scan generics covered elsewhere
drop index if exists public.idx_buildings_borough_slug;
drop index if exists public.idx_buildings_metro_fulladdr;
drop index if exists public.idx_buildings_metro_upper_addr;
drop index if exists public.idx_buildings_owner_null_state;
drop index if exists public.idx_buildings_management_company;

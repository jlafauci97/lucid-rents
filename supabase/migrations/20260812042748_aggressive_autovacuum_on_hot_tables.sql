-- Applied to prod 2026-08-12 via MCP; this file mirrors the recorded
-- migration (version 20260812042748) so `db push` sees it as applied.
--
-- The daily-upsert tables accumulate dead tuples far faster than default
-- autovacuum (20% of a multi-million-row table) keeps up with, which is where
-- several GB of bloat came from. Vacuum at 2% instead.
set local lock_timeout = '10s';

alter table public.complaints_311_nyc set (autovacuum_vacuum_scale_factor = 0.02, autovacuum_analyze_scale_factor = 0.02);
alter table public.complaints_311_chicago set (autovacuum_vacuum_scale_factor = 0.02, autovacuum_analyze_scale_factor = 0.02);
alter table public.complaints_311_la set (autovacuum_vacuum_scale_factor = 0.02, autovacuum_analyze_scale_factor = 0.02);
alter table public.hpd_violations set (autovacuum_vacuum_scale_factor = 0.02, autovacuum_analyze_scale_factor = 0.02);
alter table public.dob_violations set (autovacuum_vacuum_scale_factor = 0.02, autovacuum_analyze_scale_factor = 0.02);
alter table public.dob_permits set (autovacuum_vacuum_scale_factor = 0.02, autovacuum_analyze_scale_factor = 0.02);
alter table public.building_rents set (autovacuum_vacuum_scale_factor = 0.02, autovacuum_analyze_scale_factor = 0.02);
alter table public.unit_rent_history set (autovacuum_vacuum_scale_factor = 0.02, autovacuum_analyze_scale_factor = 0.02);
alter table public.nypd_complaints set (autovacuum_vacuum_scale_factor = 0.02, autovacuum_analyze_scale_factor = 0.02);
alter table public.buildings set (autovacuum_vacuum_scale_factor = 0.02, autovacuum_analyze_scale_factor = 0.02);

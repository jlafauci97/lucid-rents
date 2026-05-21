-- supabase/migrations/20260521000000_neighborhood_risks_rls_security_definer.sql
--
-- Supabase auto-enables RLS on new tables. Our Neighborhood Risks tables
-- (nearby_concerns, nearby_concerns_overrides, calm_score_baselines) were
-- created without explicit SELECT policies, so anon couldn't read them
-- through the regular REST API or through STABLE SQL functions that run
-- with the caller's privileges.
--
-- Fix: mark the RPCs SECURITY DEFINER so they read the underlying tables
-- with the function-owner's privileges, regardless of caller's RLS rules.
-- This keeps the tables locked down (no arbitrary SELECT from anon) while
-- exposing the controlled radius-bounded RPC surface for the page.
--
-- For calm_score_baselines, add a public read policy — it's intentionally
-- public (just rolled-up medians, no per-building data) and is read via
-- the supabase-js .from() builder, not an RPC.

ALTER FUNCTION nearby_concerns_within_radius(double precision, double precision, int) SECURITY DEFINER;
ALTER FUNCTION count_311_noise_near(double precision, double precision, int) SECURITY DEFINER;
ALTER FUNCTION count_rats_near(double precision, double precision, int) SECURITY DEFINER;
ALTER FUNCTION count_bedbugs_near(double precision, double precision, int) SECURITY DEFINER;
-- count_sex_offenders_near is already SECURITY DEFINER from its original migration.

DROP POLICY IF EXISTS calm_score_baselines_read ON calm_score_baselines;
CREATE POLICY calm_score_baselines_read
  ON calm_score_baselines
  FOR SELECT
  TO anon, authenticated
  USING (true);

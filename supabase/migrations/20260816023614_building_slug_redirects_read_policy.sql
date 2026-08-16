-- building_slug_redirects has had RLS enabled since the baseline with ZERO
-- policies — anon reads silently returned nothing, which is part of why the
-- table was never wired up. The building page's miss handler now reads it
-- (old_slug → new_slug, 308 redirect), so grant public SELECT. Writes stay
-- service-role-only (no INSERT/UPDATE/DELETE policies).
create policy "public read" on public.building_slug_redirects
  for select using (true);

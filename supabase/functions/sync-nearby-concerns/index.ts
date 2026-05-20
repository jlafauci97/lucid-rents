import { getSupabaseAdmin } from "shared/supabase-admin.ts";
import { syncSirensFdny } from "./modules/sirens-fdny.ts";
import { syncDsnyGarages } from "./modules/dsny-garages.ts";

/**
 * Module registry. Add new modules here as they ship.
 *
 * Deferred (not yet implemented — see docs/superpowers/plans/2026-05-20-neighborhood-risks.md):
 *   - shelters-nyc-opendata  (NYC shelter dataset IDs from original plan are stale/404 — re-source needed)
 *   - shelters-coalition     (Coalition for the Homeless directory scrape)
 *   - shelters-win-camba-brc (WIN / CAMBA / BRC contractor directory scrapes)
 *   - shelters-faithbased    (Bowery Mission, Father's Heart, etc.)
 *   - migrant-herrc          (NYC Mayor press releases + THE CITY tracker)
 *   - methadone-oasas        (NYS OASAS web-only directory — requires scrape)
 *   - halfway-houses         (Federal BOP + NYS DOCCS)
 *   - sirens-nypd            (no public point dataset — needs nyc.gov scrape)
 *   - sirens-hospitals       (DOHMH hospital list with ER bay filter)
 *   - env-brownfield         (EPA Envirofacts + NYS DEC remediation sites)
 *   - rail-highway-points    (NYC LION + FHWA NHS shapefile, one-shot seed)
 *   - active-construction    (derive from existing dob_jobs table)
 *   - sex-offender-nys       (NYS DCJS scrape → restricted-table writes only)
 */
const MODULES = {
  "sirens-fdny": syncSirensFdny,
  "dsny-garages": syncDsnyGarages,
} as const;

type ModuleName = keyof typeof MODULES;

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const requested = url.searchParams.get("source") ?? "all";
  const supabase = getSupabaseAdmin();

  const moduleNames: ModuleName[] =
    requested === "all"
      ? (Object.keys(MODULES) as ModuleName[])
      : [requested as ModuleName];

  const results: Record<
    string,
    { synced: number; errors: string[] } | { error: string }
  > = {};

  for (const name of moduleNames) {
    if (!(name in MODULES)) {
      results[name] = { error: "unknown module" };
      continue;
    }
    try {
      results[name] = await MODULES[name](supabase);
    } catch (e) {
      results[name] = { error: (e as Error).message };
    }
  }

  return new Response(JSON.stringify({ ok: true, requested, results }, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
});

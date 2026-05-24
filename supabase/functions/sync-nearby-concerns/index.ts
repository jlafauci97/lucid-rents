import { getSupabaseAdmin } from "shared/supabase-admin.ts";
import { syncSirensFdny } from "./modules/sirens-fdny.ts";
import { syncSirensHospitals } from "./modules/sirens-hospitals.ts";
import { syncDsnyGarages } from "./modules/dsny-garages.ts";
import { syncActiveConstruction } from "./modules/active-construction.ts";

/**
 * Module registry. Add new modules here as they ship.
 *
 * Deferred (not yet implemented — each requires either scraping arbitrary
 * web pages, parsing binary shapefiles, or sourcing data that isn't publicly
 * indexed. Tracked as follow-up work):
 *
 *   - shelters-nyc-opendata  (original Socrata IDs from plan are stale/404 — re-source needed)
 *   - shelters-coalition     (Coalition for the Homeless directory scrape)
 *   - shelters-win-camba-brc (WIN / CAMBA / BRC contractor directory scrapes)
 *   - shelters-faithbased    (Bowery Mission, Father's Heart, etc.)
 *   - migrant-herrc          (NYC Mayor press releases + THE CITY tracker scrape)
 *   - methadone-oasas        (NYS OASAS web-only directory — requires scrape)
 *   - halfway-houses         (Federal BOP RRC + NYS DOCCS — BOP JSON endpoint deprecated)
 *   - sirens-nypd            (no public point dataset — needs nyc.gov scrape)
 *   - sirens-hospitals-private (private hospitals not in HHC feed — use Facilities Database 2fpa-bnsx)
 *   - env-brownfield         (NYS DEC env remediation API spotty, EPA Envirofacts needs query work)
 *   - rail-highway-points    (NYC LION + FHWA NHS shapefile, one-shot seed script)
 *   - sex-offender-nys       (NYS DCJS scrape → restricted-table writes only)
 */
const MODULES = {
  "sirens-fdny": syncSirensFdny,
  "sirens-hospitals": syncSirensHospitals,
  "dsny-garages": syncDsnyGarages,
  "active-construction": syncActiveConstruction,
  // Schools are NOT synced into nearby_concerns — they live in their own
  // `nearby_schools` table (synced via the `sync-schools` edge function),
  // which has broader coverage (public + charter + private + colleges)
  // across multiple metros. The Neighborhood Risks query layer reads
  // from `nearby_schools` directly and synthesizes school concerns on
  // the fly. See src/lib/neighborhood-risks/queries.ts.
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

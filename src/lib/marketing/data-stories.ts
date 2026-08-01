import { createAdminClient } from "@/lib/supabase/admin";
import { VALID_CITIES, CITY_META, type City } from "@/lib/cities";
import { buildingUrl, landlordUrl, neighborhoodUrl, canonicalUrl } from "@/lib/seo";
import { getNeighborhoodNameByCity, getAllNeighborhoodsByCity } from "@/lib/neighborhoods";

/**
 * Ranked, sourced datasets built from our own records.
 *
 * Shared by the Reddit self-post generator and the monthly rankings pages so a
 * number quoted on Reddit and the same number on the site cannot drift apart.
 *
 * On methodology: raw violation counts rank by building size, not by how badly
 * a place is run — the worst offenders by raw count are large affordable-housing
 * complexes. Where unit counts exist we rank per unit and say so; where they
 * don't we fall back to raw totals and label it. Publishing "worst landlord"
 * lists without that distinction is how a data project loses its credibility
 * the first time a reporter checks.
 */

export interface RankedBuilding {
  rank: number;
  address: string;
  url: string;
  violations: number;
  units: number | null;
  violationsPerUnit: number | null;
  owner: string | null;
}

export interface RankedLandlord {
  rank: number;
  owner: string;
  url: string;
  buildings: number;
  violations: number;
  worstBuilding: { address: string; url: string; violations: number } | null;
}

export interface StoryMeta {
  city: City;
  cityName: string;
  /** "per unit" or "total" — must be surfaced wherever the ranking is shown. */
  basis: "per-unit" | "per-building" | "total";
  generatedAt: string;
  sourceNote: string;
}

const MIN_UNITS_FOR_RATE = 6;
const MIN_VIOLATIONS = 10;

/**
 * Owner names arrive from HPD registration files in fixed-width, all-caps form
 * ("FLATBUSH GARDENS HOUSING DEVELOPMENT FUN D CORPORAT"). Title-casing them
 * reads far better in a published ranking.
 *
 * This only ever changes the label. URLs are built from the raw name, because
 * the landlord slug is derived from it — cleaning the string before generating
 * the link would produce a slug that resolves to nothing.
 */
function displayOwnerName(raw: string): string {
  const SMALL = new Set(["of", "and", "the", "at", "for", "de", "la"]);
  return raw
    .toLowerCase()
    .split(/\s+/)
    .map((word, i) => {
      // Keep entity suffixes and initialisms uppercase.
      const bare = word.replace(/[.,]/g, "");
      if (["llc", "lp", "llp", "inc", "hdfc", "hp", "co", "corp"].includes(bare)) {
        return word.toUpperCase();
      }
      if (i > 0 && SMALL.has(bare)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

function sourceNoteFor(city: City): string {
  if (city === "nyc") return "NYC HPD violation records";
  if (city === "los-angeles") return "LA Housing Department (LAHD) records";
  return "Chicago building violation records";
}

/**
 * Worst buildings in a city, or in one ZIP when `zipCode` is given.
 *
 * Ranks per unit where unit counts are available for enough of the sample,
 * otherwise by raw totals.
 */
export async function worstBuildings(
  city: City,
  options: { zipCode?: string; limit?: number } = {}
): Promise<{ meta: StoryMeta; rows: RankedBuilding[] }> {
  const limit = options.limit ?? 10;
  const supabase = createAdminClient();

  let query = supabase
    .from("buildings")
    .select("full_address, slug, borough, violation_count, residential_units, owner_name")
    .eq("metro", city)
    .gt("violation_count", MIN_VIOLATIONS)
    .not("slug", "is", null)
    .order("violation_count", { ascending: false, nullsFirst: false })
    .limit(500);

  if (options.zipCode) query = query.eq("zip_code", options.zipCode);

  const { data, error } = await query;
  if (error) throw error;

  const candidates = (data ?? []).map((b) => {
    const units = (b.residential_units as number) ?? null;
    const violations = (b.violation_count as number) ?? 0;
    return {
      address: b.full_address as string,
      url: canonicalUrl(
        buildingUrl({ borough: b.borough as string, slug: b.slug as string }, city)
      ),
      violations,
      units: units && units > 0 ? units : null,
      violationsPerUnit:
        units && units >= MIN_UNITS_FOR_RATE ? violations / units : null,
      owner: b.owner_name ? displayOwnerName(b.owner_name as string) : null,
    };
  });

  // Only rank per unit if most of the sample actually has unit counts —
  // otherwise the ranking silently becomes "buildings we happen to have data
  // for", which is a different list than the one the headline claims.
  const withRate = candidates.filter((c) => c.violationsPerUnit !== null);
  const usePerUnit = withRate.length >= Math.max(limit, candidates.length * 0.5);

  const pool = usePerUnit ? withRate : candidates;
  pool.sort((a, b) =>
    usePerUnit
      ? (b.violationsPerUnit ?? 0) - (a.violationsPerUnit ?? 0)
      : b.violations - a.violations
  );

  return {
    meta: {
      city,
      cityName: CITY_META[city].name,
      basis: usePerUnit ? "per-unit" : "total",
      generatedAt: new Date().toISOString(),
      sourceNote: sourceNoteFor(city),
    },
    rows: pool.slice(0, limit).map((c, i) => ({ rank: i + 1, ...c })),
  };
}

/** Owners with the most violations across their portfolio. */
export async function worstLandlords(
  city: City,
  limit = 10
): Promise<{ meta: StoryMeta; rows: RankedLandlord[] }> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("buildings")
    .select("owner_name, full_address, slug, borough, violation_count")
    .eq("metro", city)
    .not("owner_name", "is", null)
    .gt("violation_count", MIN_VIOLATIONS)
    .order("violation_count", { ascending: false, nullsFirst: false })
    .limit(2000);

  if (error) throw error;

  const byOwner = new Map<
    string,
    { violations: number; buildings: number; worst: RankedLandlord["worstBuilding"] }
  >();

  for (const b of data ?? []) {
    const owner = (b.owner_name as string).trim();
    if (!owner) continue;
    const violations = (b.violation_count as number) ?? 0;
    const entry = byOwner.get(owner) ?? { violations: 0, buildings: 0, worst: null };
    entry.violations += violations;
    entry.buildings += 1;
    if (b.slug && (!entry.worst || violations > entry.worst.violations)) {
      entry.worst = {
        address: b.full_address as string,
        url: canonicalUrl(
          buildingUrl({ borough: b.borough as string, slug: b.slug as string }, city)
        ),
        violations,
      };
    }
    byOwner.set(owner, entry);
  }

  const rows = [...byOwner.entries()]
    .sort((a, b) => b[1].violations - a[1].violations)
    .slice(0, limit)
    .map(([owner, v], i) => ({
      rank: i + 1,
      // URL from the raw name, label from the cleaned one — see displayOwnerName.
      owner: displayOwnerName(owner),
      url: canonicalUrl(landlordUrl(owner, city)),
      buildings: v.buildings,
      violations: v.violations,
      worstBuilding: v.worst,
    }));

  return {
    meta: {
      city,
      cityName: CITY_META[city].name,
      basis: "total",
      generatedAt: new Date().toISOString(),
      sourceNote: sourceNoteFor(city),
    },
    rows,
  };
}

export interface RankedNeighborhood {
  rank: number;
  name: string;
  zipCode: string;
  url: string;
  buildings: number;
  violations: number;
  violationsPerBuilding: number;
}

/** Neighborhoods ranked by violations per tracked building. */
export async function worstNeighborhoods(
  city: City,
  limit = 10
): Promise<{ meta: StoryMeta; rows: RankedNeighborhood[] }> {
  const supabase = createAdminClient();

  // Aggregate one ZIP at a time.
  //
  // The obvious version — select 5000 rows and group them in memory — does not
  // work: PostgREST returns a contiguous chunk in physical order, so for
  // Chicago those 5000 rows covered just 5 distinct ZIPs. The ranking was
  // computed from an arbitrary slice of the city rather than the city.
  const zipCodes = [
    ...new Set(getAllNeighborhoodsByCity(city).map((n) => n.zipCode)),
  ];

  const byZip = new Map<string, { violations: number; buildings: number }>();
  const CONCURRENCY = 8;

  for (let i = 0; i < zipCodes.length; i += CONCURRENCY) {
    const batch = zipCodes.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (zip) => {
        const { data, error } = await supabase
          .from("buildings")
          .select("violation_count")
          .eq("metro", city)
          .eq("zip_code", zip)
          .gt("violation_count", 0)
          .limit(5000);

        if (error || !data || data.length === 0) return;
        byZip.set(zip, {
          buildings: data.length,
          violations: data.reduce(
            (sum, r) => sum + (((r.violation_count as number) ?? 0) || 0),
            0
          ),
        });
      })
    );
  }

  // Several ZIPs can share a neighborhood name (the Loop spans 60602, 60603
  // and 60604). Merge them, or the published list repeats "Loop" three times
  // and reads like a bug.
  const byName = new Map<
    string,
    { violations: number; buildings: number; zipCode: string }
  >();
  for (const [zipCode, v] of byZip) {
    const name = getNeighborhoodNameByCity(zipCode, city) ?? `ZIP ${zipCode}`;
    const entry = byName.get(name) ?? { violations: 0, buildings: 0, zipCode };
    entry.violations += v.violations;
    entry.buildings += v.buildings;
    // Link the ZIP carrying the most buildings — the most representative page.
    if (v.buildings > (byZip.get(entry.zipCode)?.buildings ?? 0)) {
      entry.zipCode = zipCode;
    }
    byName.set(name, entry);
  }

  const rows = [...byName.entries()]
    // A handful of buildings produces a meaningless rate.
    .filter(([, v]) => v.buildings >= 20)
    .map(([name, v]) => ({
      zipCode: v.zipCode,
      name,
      url: canonicalUrl(neighborhoodUrl(v.zipCode, city)),
      buildings: v.buildings,
      violations: v.violations,
      violationsPerBuilding: Math.round((v.violations / v.buildings) * 10) / 10,
    }))
    .sort((a, b) => b.violationsPerBuilding - a.violationsPerBuilding)
    .slice(0, limit)
    .map((r, i) => ({ rank: i + 1, ...r }));

  return {
    meta: {
      city,
      cityName: CITY_META[city].name,
      basis: "per-building",
      generatedAt: new Date().toISOString(),
      sourceNote: sourceNoteFor(city),
    },
    rows,
  };
}

export const STORY_CITIES = VALID_CITIES;

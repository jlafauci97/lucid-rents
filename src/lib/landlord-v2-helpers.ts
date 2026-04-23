import type { City } from "@/lib/cities";
import type { PortfolioBuildingRow } from "@/app/[city]/landlord/[name]/_data";
import { normalizeScore } from "@/lib/constants";
import { getAllNeighborhoodsByCity } from "@/lib/neighborhoods";

// ─────────────────────────────────────────────────────────────────────────────
// GradeDistribution
// ─────────────────────────────────────────────────────────────────────────────

export type GradeDistribution = { A: number; B: number; C: number; D: number; F: number };

/**
 * Normalise a raw overall_score value to the 0-5 display scale.
 *
 * The existing `normalizeScore` from @/lib/constants handles the 0-10 → 0-5
 * migration (divides by 2 when score > 5). For true legacy 0-100 scores
 * (score > 10) we pre-scale to the 0-5 range (÷20) before delegating to
 * normalizeScore, which then acts as a passthrough clamp.
 */
function scaleScore(raw: number): number {
  if (raw > 10) {
    return normalizeScore(raw / 20);
  }
  return normalizeScore(raw);
}

/**
 * Given a list of buildings with `overall_score` (0-5 or legacy 0-100),
 * returns the count of buildings that fall in each letter bucket.
 *
 * Thresholds (after normalization to 0-5):
 *   A  when s >= 3.65
 *   B  when s >= 3.0
 *   C  when s >= 2.3
 *   D  when s >= 1.0
 *   F  when s < 1.0 or null
 */
export function computeGradeDistribution(
  buildings: Array<Pick<PortfolioBuildingRow, "overall_score">>
): GradeDistribution {
  const dist: GradeDistribution = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  for (const b of buildings) {
    if (b.overall_score == null) {
      dist.F++;
      continue;
    }
    const s = scaleScore(b.overall_score);
    if (s >= 3.65) dist.A++;
    else if (s >= 3.0) dist.B++;
    else if (s >= 2.3) dist.C++;
    else if (s >= 1.0) dist.D++;
    else dist.F++;
  }
  return dist;
}

// ─────────────────────────────────────────────────────────────────────────────
// PeerCandidate / pickPeerLandlords
// ─────────────────────────────────────────────────────────────────────────────

/** Candidate landlord for peer comparison. Field names mirror landlord_stats row. */
export type PeerCandidate = {
  name: string;
  slug: string;
  metro: City;
  buildingCount: number;
  unitCount: number;
  avgScore: number | null;
};

/**
 * Filter candidates to same metro, building_count within ±40% of `current`,
 * exclude self, sort by ABS(avgScore - currentAvgScore) ascending
 * (null avgScore ranks last), return top 4.
 */
export function pickPeerLandlords(
  current: PeerCandidate,
  candidates: PeerCandidate[]
): PeerCandidate[] {
  const bandSize = current.buildingCount * 0.4;

  const eligible = candidates.filter(
    (c) =>
      c.metro === current.metro &&
      c.slug !== current.slug &&
      Math.abs(c.buildingCount - current.buildingCount) <= bandSize
  );

  const currentAvg = current.avgScore;

  const distance = (c: PeerCandidate): number => {
    if (c.avgScore == null) return Infinity;
    if (currentAvg == null) return Infinity;
    return Math.abs(c.avgScore - currentAvg);
  };

  return eligible.sort((a, b) => distance(a) - distance(b)).slice(0, 4);
}

// ─────────────────────────────────────────────────────────────────────────────
// RegionAggregate / aggregateRegions
// ─────────────────────────────────────────────────────────────────────────────

export type RegionAggregate = {
  name: string;
  count: number;
  share: number;          // 0-1
  topConcern: string | null;  // most common HPD category in that region, or null
};

/**
 * Group buildings by their region (borough for NYC, neighborhood/area for other cities).
 * For Phase 1 `topConcern` is not computed here — it is always null.
 *
 * Region name is resolved by looking up the zip code in the city's zip→region map
 * (borough for NYC, area for LA/Chicago/Miami/Houston). Falls back to the
 * building's `borough` field when the zip code is null or unmapped.
 *
 * Returns sorted by count desc, share computed against total count.
 */
export function aggregateRegions(
  buildings: Array<{ zip_code: string | null; borough: string | null }>,
  city: City
): RegionAggregate[] {
  if (buildings.length === 0) return [];

  // Build a zip → region lookup for this city once
  const zipToRegion = new Map<string, string>();
  for (const entry of getAllNeighborhoodsByCity(city)) {
    zipToRegion.set(entry.zipCode, entry.region);
  }

  const counts = new Map<string, number>();

  for (const b of buildings) {
    let regionName: string;
    if (b.zip_code && zipToRegion.has(b.zip_code)) {
      regionName = zipToRegion.get(b.zip_code)!;
    } else {
      regionName = b.borough ?? "Unknown";
    }
    counts.set(regionName, (counts.get(regionName) ?? 0) + 1);
  }

  const total = buildings.length;

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({
      name,
      count,
      share: count / total,
      topConcern: null,
    }));
}

/**
 * Landlord NL Summary — generates a data-grounded portfolio paragraph per
 * landlord, mirroring lucidiq-summary.ts (buildings).
 *
 * Safety gate: requires ≥3 unique data points sourced from the landlord's
 * aggregated stats. If the gate fails, returns null (the caller renders
 * nothing — better than boilerplate that trips Google's scaled-content
 * policy). Every sentence references a real field; no rephrased templates.
 *
 * All inputs are available synchronously on the landlord page shell
 * (getLandlordStats + loadLandlordTenantVoice + loadLandlordNeighborhoods),
 * so the paragraph lands in the initial SSR response — crawlers and AI
 * systems read it without having to consume the streamed sections.
 */

import { CITY_SHORT_NAME, CITY_META, type City } from "./cities";
import { normalizeScore } from "./constants";

export interface LandlordSummaryInput {
  name: string;
  city: City;
  buildingCount: number;
  totalViolations: number;
  totalComplaints: number;
  /** Portfolio LucidIQ average — raw score; normalized to 0–5 here. */
  avgScore: number | null;
  worstBuildingAddress: string | null;
  worstBuildingViolations: number | null;
  /** Published tenant reviews across the portfolio. */
  totalReviews: number;
  /** Average tenant review rating (already 0–5). */
  avgRating: number;
  /** Neighborhoods the portfolio spans, sorted by building count desc. */
  neighborhoods: Array<{ name: string; buildingCount: number }>;
}

function plural(n: number, singular: string, pluralForm?: string): string {
  return `${n.toLocaleString("en-US")} ${n === 1 ? singular : (pluralForm ?? `${singular}s`)}`;
}

function streetOf(full: string): string {
  return full.split(",")[0]?.trim() ?? full;
}

/**
 * Count data points that resolve to real, renderable facts. A lone
 * neighborhood is NOT counted — for a single-building owner it's the same
 * fact as the building itself, so counting both would let a clean
 * single-building landlord clear the gate on two redundant signals and emit
 * near-duplicate "owns 1 building, scores 5/5" boilerplate across thousands
 * of pages. Requiring ≥2 neighborhoods (or a real issue/review signal) keeps
 * the paragraph to landlords with something distinctive to say.
 */
function countDataPoints(b: LandlordSummaryInput, lucidIq: number): number {
  const points: boolean[] = [
    b.buildingCount > 0,
    lucidIq > 0,
    b.totalViolations > 0,
    b.totalComplaints > 0,
    !!b.worstBuildingAddress && (b.worstBuildingViolations ?? 0) > 0,
    b.totalReviews > 0,
    b.neighborhoods.length >= 2,
  ];
  return points.filter(Boolean).length;
}

/**
 * Construct a per-landlord portfolio paragraph from real aggregates. Each
 * sentence is conditional on the data — no rephrased boilerplate.
 *
 * Returns null when fewer than 3 data points are available (safety gate).
 */
export function buildLandlordNLSummary(input: LandlordSummaryInput): string | null {
  const lucidIq = normalizeScore(input.avgScore);
  if (countDataPoints(input, lucidIq) < 3) return null;

  const cityShort = CITY_SHORT_NAME[input.city] ?? CITY_META[input.city].name;
  const single = input.buildingCount === 1;
  const sentences: string[] = [];

  // Intro: portfolio size + geographic spread + city.
  let where: string;
  if (!single && input.neighborhoods.length >= 2) {
    where = `across ${plural(input.neighborhoods.length, "neighborhood")} in ${cityShort}`;
  } else if (input.neighborhoods.length >= 1) {
    where = `in ${input.neighborhoods[0].name}, ${cityShort}`;
  } else {
    where = `in ${cityShort}`;
  }
  const portfolioPhrase = single
    ? "owns a single building"
    : `owns a portfolio of ${plural(input.buildingCount, "building")}`;
  sentences.push(`${input.name} ${portfolioPhrase} ${where}.`);

  // LucidIQ score (only when we have a real, non-zero score).
  if (lucidIq > 0) {
    sentences.push(
      single
        ? `The building holds a LucidIQ score of ${lucidIq.toFixed(1)} out of 5.`
        : `The portfolio holds an average LucidIQ score of ${lucidIq.toFixed(1)} out of 5.`
    );
  }

  // Issues & complaints.
  const issuesParts: string[] = [];
  if (input.totalViolations > 0) issuesParts.push(plural(input.totalViolations, "open violation"));
  if (input.totalComplaints > 0) issuesParts.push(plural(input.totalComplaints, "complaint"));
  if (issuesParts.length > 0) {
    sentences.push(`Public records show ${issuesParts.join(" and ")} on file.`);
  }

  // Most-cited building — only meaningful for a multi-building portfolio.
  const worstVio = input.worstBuildingViolations ?? 0;
  if (!single && input.worstBuildingAddress && worstVio > 0) {
    sentences.push(
      `Their most-cited building, ${streetOf(input.worstBuildingAddress)}, accounts for ${plural(worstVio, "violation")} on its own.`
    );
  }

  // Tenant reviews.
  if (input.totalReviews > 0) {
    const avg = Math.max(0, Math.min(5, input.avgRating));
    const avgClause = avg > 0 ? `, averaging ${avg.toFixed(1)} out of 5` : "";
    const scope = single ? "on this building" : "across this portfolio";
    sentences.push(`Lucid Rents has ${plural(input.totalReviews, "verified tenant review")} ${scope}${avgClause}.`);
  }

  const text = sentences.join(" ");
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (wordCount < 20) return null;
  return text;
}

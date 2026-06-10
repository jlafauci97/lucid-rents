import { deriveScore } from "@/lib/constants";

/**
 * Shared "verdict" logic for a building — used by both the building page's
 * verdict/report-card section (DeferredVerdictSection) and the public
 * /api/buildings/[buildingId]/verdict endpoint so UI and API stay in sync.
 */

/**
 * The 0–5 score the verdict is based on: the stored overall_score when
 * present, otherwise derived from public-record violation/complaint counts.
 */
export function verdictScore(
  overallScore: number | null | undefined,
  violationCount: number,
  complaintCount: number
): number {
  return overallScore ?? deriveScore(violationCount, complaintCount);
}

/**
 * One-sentence plain-English verdict for a building, keyed off the same
 * thresholds the report card uses.
 */
export function verdictSummary(score: number): string {
  if (score >= 4) return "Excellent building — top-rated by tenants with minimal issues.";
  if (score >= 3) return "Good building with responsive management and moderate concerns.";
  if (score >= 2) return "Decent building but has room for improvement in some areas.";
  if (score >= 1) return "Below average — tenants report significant concerns.";
  return "Poor conditions — multiple serious issues reported by tenants.";
}

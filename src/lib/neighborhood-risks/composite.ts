import { getLetterGrade, type LetterGrade } from "@/lib/constants";

/**
 * Composite neighborhood "Livability Risk Grade".
 *
 * Pure, unit-testable scoring that composites the per-neighborhood risk
 * signals the neighborhood page already loads (crime summary, building
 * violation/complaint aggregates, and — when available — nearby-concern
 * counts). No I/O happens here; callers pass the aggregates they already
 * fetched.
 *
 * All component scores are 0–100 where HIGHER = LOWER risk (an "A"
 * neighborhood scores near 100). Rates are normalized per tracked building
 * so dense and sparse ZIPs are comparable.
 */

export interface RiskGradeCrimeInput {
  /** Total incidents over the trailing 12 months. */
  total: number;
  violent: number;
  property: number;
  quality_of_life: number;
}

export interface RiskGradeInput {
  /** Buildings tracked in the ZIP — used as the density denominator. */
  buildingCount: number;
  /** Aggregate HPD violations across the ZIP (null/undefined = unknown). */
  totalViolations?: number | null;
  /** Aggregate housing complaints across the ZIP (null/undefined = unknown). */
  totalComplaints?: number | null;
  /** 12-month crime summary for the ZIP (null/undefined = no crime data). */
  crime?: RiskGradeCrimeInput | null;
  /**
   * Optional count of nearby concerns (POIs from the Neighborhood Risks
   * tool). When absent we fall back to quality-of-life crime incidents as
   * the concern-density proxy, since both capture street-level nuisance.
   */
  concernCount?: number | null;
}

export interface RiskGradeComponent {
  key: "crime" | "violations" | "complaints" | "concerns";
  label: string;
  /** 0–100, higher = lower risk. */
  score: number;
  /** Effective (renormalized) weight; all components sum to 1. */
  weight: number;
}

export interface NeighborhoodRiskGrade {
  grade: LetterGrade;
  /** Weighted composite, 0–100, higher = lower risk. */
  score: number;
  components: RiskGradeComponent[];
}

/**
 * Base weights (before renormalization for missing components).
 *
 * - crime (0.40): violent crime is the strongest livability signal.
 * - violations (0.30): open building violations per building — housing stock
 *   condition and landlord neglect.
 * - complaints (0.15): housing complaints per building — tenant friction and
 *   responsiveness.
 * - concerns (0.15): nearby-concern density (or quality-of-life incidents as
 *   a proxy) — street-level nuisance.
 *
 * When a component's underlying data is missing for a neighborhood, its
 * weight is redistributed proportionally across the present components so
 * missing data never reads as bad data.
 */
const BASE_WEIGHTS: Record<RiskGradeComponent["key"], number> = {
  crime: 0.4,
  violations: 0.3,
  complaints: 0.15,
  concerns: 0.15,
};

const LABELS: Record<RiskGradeComponent["key"], string> = {
  crime: "Violent crime",
  violations: "Building violations",
  complaints: "Housing complaints",
  concerns: "Nearby concerns",
};

/**
 * Per-building rate at which a component bottoms out at 0. Chosen to align
 * with the page's existing sub-grade thresholds (getSubGrade buckets), e.g.
 * >10 violent crimes per building is already an F there.
 */
const CEILING_RATES: Record<RiskGradeComponent["key"], number> = {
  crime: 12, // violent incidents per building
  violations: 25, // violations per building
  complaints: 18, // complaints per building
  concerns: 30, // QoL incidents / concerns per building
};

/**
 * Maps a per-building rate to a 0–100 score on a log curve (heavy-tailed
 * counts shouldn't crater the score linearly). rate=0 → 100; rate>=ceiling → 0.
 */
export function rateToScore(rate: number, ceiling: number): number {
  if (!Number.isFinite(rate) || rate <= 0) return 100;
  const t = Math.log10(1 + rate) / Math.log10(1 + ceiling);
  const score = 100 * (1 - Math.min(1, Math.max(0, t)));
  return Math.round(score * 10) / 10;
}

function isCount(v: number | null | undefined): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0;
}

/**
 * Computes the composite Livability Risk Grade for a neighborhood.
 * Returns null when there is nothing meaningful to grade (no tracked
 * buildings, or every signal missing).
 */
export function computeNeighborhoodRiskGrade(
  input: RiskGradeInput,
): NeighborhoodRiskGrade | null {
  const buildings = input.buildingCount;
  if (!Number.isFinite(buildings) || buildings <= 0) return null;

  const raw: Array<{ key: RiskGradeComponent["key"]; score: number }> = [];

  if (input.crime && isCount(input.crime.violent)) {
    raw.push({
      key: "crime",
      score: rateToScore(input.crime.violent / buildings, CEILING_RATES.crime),
    });
  }

  if (isCount(input.totalViolations)) {
    raw.push({
      key: "violations",
      score: rateToScore(input.totalViolations / buildings, CEILING_RATES.violations),
    });
  }

  if (isCount(input.totalComplaints)) {
    raw.push({
      key: "complaints",
      score: rateToScore(input.totalComplaints / buildings, CEILING_RATES.complaints),
    });
  }

  const concernSignal = isCount(input.concernCount)
    ? input.concernCount
    : input.crime && isCount(input.crime.quality_of_life)
      ? input.crime.quality_of_life
      : null;
  if (concernSignal !== null) {
    raw.push({
      key: "concerns",
      score: rateToScore(concernSignal / buildings, CEILING_RATES.concerns),
    });
  }

  if (raw.length === 0) return null;

  // Renormalize weights across present components so missing data doesn't
  // drag the composite toward zero.
  const weightSum = raw.reduce((sum, c) => sum + BASE_WEIGHTS[c.key], 0);
  const components: RiskGradeComponent[] = raw.map((c) => ({
    key: c.key,
    label: LABELS[c.key],
    score: c.score,
    weight: Math.round((BASE_WEIGHTS[c.key] / weightSum) * 1000) / 1000,
  }));

  const score =
    Math.round(
      raw.reduce((sum, c) => sum + c.score * (BASE_WEIGHTS[c.key] / weightSum), 0) * 10,
    ) / 10;

  // getLetterGrade expects the site's 0–5 scale (its normalizeScore treats
  // >5 as a 0–10 score), so map 0–100 → 0–5 explicitly.
  const grade = getLetterGrade(score / 20);

  return { grade, score, components };
}

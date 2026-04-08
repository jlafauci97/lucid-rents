import type { CrimeCategory } from "./crime-categories";

/** Safety grade thresholds (percentile-based) */
export type SafetyGrade = "A" | "B" | "C" | "D" | "F";

export interface ZipCrimeRanked {
  zip_code: string;
  borough: string;
  total: number;
  violent: number;
  property: number;
  quality_of_life: number;
  grade: SafetyGrade;
  rank: number;
  percentile: number;
  yoy_total_pct: number | null;
  yoy_violent_pct: number | null;
  yoy_property_pct: number | null;
  dominant_category: CrimeCategory;
  neighborhood: string | null;
}

export interface CityStats {
  total_crimes: number;
  total_violent: number;
  total_property: number;
  total_qol: number;
  zip_count: number;
  avg_per_zip: number;
  avg_violent_per_zip: number;
  avg_property_per_zip: number;
  avg_qol_per_zip: number;
}

/**
 * Assign a safety grade based on percentile rank.
 * Lower crime = better grade. Percentile 0 = least crime.
 */
export function safetyGrade(percentile: number): SafetyGrade {
  if (percentile <= 20) return "A";
  if (percentile <= 40) return "B";
  if (percentile <= 60) return "C";
  if (percentile <= 80) return "D";
  return "F";
}

/**
 * Calculate YoY percentage change. Returns null if prior is 0.
 */
export function yoyPct(current: number, prior: number): number | null {
  if (prior === 0) return current > 0 ? 100 : null;
  return Math.round(((current - prior) / prior) * 100);
}

/**
 * Determine which crime category dominates in a zip.
 */
export function dominantCategory(
  violent: number,
  property: number,
  qol: number
): CrimeCategory {
  if (violent >= property && violent >= qol) return "violent";
  if (property >= violent && property >= qol) return "property";
  return "quality_of_life";
}

/**
 * Rank zips by total crime (ascending = safest first) and assign grades.
 */
export function rankZips(
  zips: { zip_code: string; borough: string; total: number; violent: number; property: number; quality_of_life: number }[],
  yoyData: Map<string, { current_year_total: number; prior_year_total: number; current_violent: number; prior_violent: number; current_property: number; prior_property: number }>,
  getNeighborhood: (zip: string) => string | null
): ZipCrimeRanked[] {
  const sorted = [...zips].sort((a, b) => a.total - b.total);
  const count = sorted.length;

  return sorted.map((z, i) => {
    const percentile = count > 1 ? Math.round((i / (count - 1)) * 100) : 50;
    const yoy = yoyData.get(z.zip_code);
    return {
      zip_code: z.zip_code,
      borough: z.borough,
      total: z.total,
      violent: z.violent,
      property: z.property,
      quality_of_life: z.quality_of_life,
      grade: safetyGrade(percentile),
      rank: i + 1,
      percentile,
      yoy_total_pct: yoy ? yoyPct(yoy.current_year_total, yoy.prior_year_total) : null,
      yoy_violent_pct: yoy ? yoyPct(yoy.current_violent, yoy.prior_violent) : null,
      yoy_property_pct: yoy ? yoyPct(yoy.current_property, yoy.prior_property) : null,
      dominant_category: dominantCategory(z.violent, z.property, z.quality_of_life),
      neighborhood: getNeighborhood(z.zip_code),
    };
  });
}

/**
 * Generate a human-readable safety verdict string.
 */
export function safetyVerdict(
  grade: SafetyGrade,
  neighborhoodName: string,
  yoyTotalPct: number | null,
  totalCrimes: number,
  cityAvg: number,
  violentVsCityAvg: number
): string {
  const gradeLabels: Record<SafetyGrade, string> = {
    A: "Very Safe",
    B: "Moderately Safe",
    C: "Average Safety",
    D: "Below Average Safety",
    F: "High Crime Area",
  };

  const label = gradeLabels[grade];
  const vsAvg = totalCrimes < cityAvg
    ? `${Math.round(((cityAvg - totalCrimes) / cityAvg) * 100)}% less total crime than the city average`
    : `${Math.round(((totalCrimes - cityAvg) / cityAvg) * 100)}% more total crime than the city average`;

  const violentNote = violentVsCityAvg < -10
    ? "Violent crime is well below average."
    : violentVsCityAvg > 10
      ? "Violent crime is above average."
      : "Violent crime is near the city average.";

  const trendNote = yoyTotalPct !== null
    ? yoyTotalPct < -5
      ? `Crime has been declining ${Math.abs(yoyTotalPct)}% year-over-year.`
      : yoyTotalPct > 5
        ? `Crime has increased ${yoyTotalPct}% year-over-year.`
        : "Crime has been relatively stable year-over-year."
    : "";

  return `${neighborhoodName} has ${vsAvg}. ${violentNote}${trendNote ? " " + trendNote : ""}`;
}

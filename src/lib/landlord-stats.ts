/** Landlord grade thresholds (percentile-based on avg_score) */
export type LandlordGrade = "A" | "B" | "C" | "D" | "F";

export interface LandlordRanked {
  name: string;
  slug: string;
  building_count: number;
  total_violations: number;
  total_complaints: number;
  total_litigations: number;
  total_dob_violations: number;
  avg_score: number;
  grade: LandlordGrade;
  rank: number;
  percentile: number;
  worst_building_address: string | null;
  worst_building_violations: number;
  /** violations per building — normalized metric */
  violations_per_building: number;
}

export interface LandlordCityStats {
  total_landlords: number;
  total_buildings: number;
  total_violations: number;
  avg_score: number;
  avg_violations_per_landlord: number;
}

/**
 * Assign a landlord grade based on percentile of avg_score.
 * Higher score = better grade. Percentile 0 = worst score.
 */
export function landlordGrade(percentile: number): LandlordGrade {
  if (percentile >= 80) return "A";
  if (percentile >= 60) return "B";
  if (percentile >= 40) return "C";
  if (percentile >= 20) return "D";
  return "F";
}

/**
 * Rank landlords by avg_score descending (best first) and assign grades.
 */
export function rankLandlords(
  landlords: {
    name: string;
    slug: string;
    building_count: number;
    total_violations: number;
    total_complaints: number;
    total_litigations: number;
    total_dob_violations: number;
    avg_score: number;
    worst_building_address: string | null;
    worst_building_violations: number;
  }[]
): LandlordRanked[] {
  const sorted = [...landlords].sort((a, b) => b.avg_score - a.avg_score);
  const count = sorted.length;

  return sorted.map((l, i) => {
    const percentile =
      count > 1 ? Math.round(((count - 1 - i) / (count - 1)) * 100) : 50;
    return {
      ...l,
      grade: landlordGrade(percentile),
      rank: i + 1,
      percentile,
      violations_per_building:
        l.building_count > 0
          ? Math.round(l.total_violations / l.building_count)
          : 0,
    };
  });
}

/**
 * Generate a human-readable landlord verdict string.
 */
export function landlordVerdict(
  grade: LandlordGrade,
  name: string,
  avgScore: number,
  cityAvgScore: number,
  totalViolations: number,
  buildingCount: number,
  totalLitigations: number
): string {
  const gradeLabels: Record<LandlordGrade, string> = {
    A: "Excellent",
    B: "Above Average",
    C: "Average",
    D: "Below Average",
    F: "Poor",
  };

  const label = gradeLabels[grade];
  const vsAvg =
    avgScore > cityAvgScore
      ? `scores ${((avgScore - cityAvgScore) / cityAvgScore * 100).toFixed(0)}% above the city average`
      : avgScore < cityAvgScore
        ? `scores ${((cityAvgScore - avgScore) / cityAvgScore * 100).toFixed(0)}% below the city average`
        : "scores at the city average";

  const violationsPerBuilding =
    buildingCount > 0 ? Math.round(totalViolations / buildingCount) : 0;
  const violationNote =
    violationsPerBuilding > 50
      ? `Averaging ${violationsPerBuilding} violations per building — significantly above normal.`
      : violationsPerBuilding > 20
        ? `Averaging ${violationsPerBuilding} violations per building.`
        : `Averaging ${violationsPerBuilding} violations per building — relatively low.`;

  const litigationNote =
    totalLitigations > 10
      ? ` ${totalLitigations} active or recent litigations.`
      : totalLitigations > 0
        ? ` ${totalLitigations} litigation${totalLitigations !== 1 ? "s" : ""} on record.`
        : "";

  return `${name} is rated "${label}" and ${vsAvg}. ${violationNote}${litigationNote}`;
}

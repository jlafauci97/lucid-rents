interface ScoringInput {
  reviewAvg: number | null;
  reviewCount: number;
  hpdViolations: { class: string; status: string }[];
  dobViolations: { issue_date: string }[];
  complaints311Count: number;
  crimesInZip?: number;
}

export function computeBuildingScore(input: ScoringInput): number {
  const reviewScore = input.reviewAvg ? input.reviewAvg * 2 : 5.0;
  const reviewWeight = Math.min(input.reviewCount / 10, 1.0);

  let publicPenalty = 0;

  // HPD Class C (immediately hazardous) open violations
  const openClassC = input.hpdViolations.filter(
    (v) => v.class === "C" && v.status === "Open"
  ).length;
  publicPenalty += Math.min(openClassC * 0.5, 3.0);

  // HPD Class B (hazardous) open violations
  const openClassB = input.hpdViolations.filter(
    (v) => v.class === "B" && v.status === "Open"
  ).length;
  publicPenalty += Math.min(openClassB * 0.2, 1.5);

  // Recent 311 complaints
  publicPenalty += Math.min(input.complaints311Count * 0.1, 1.5);

  // DOB violations
  publicPenalty += Math.min(input.dobViolations.length * 0.3, 1.0);

  // Area crime (zip-level, intentionally light since not building-specific)
  if (input.crimesInZip) {
    publicPenalty += Math.min(input.crimesInZip * 0.001, 0.5);
  }

  publicPenalty = Math.min(publicPenalty, 5.0);

  const publicDataWeight = 1 - reviewWeight * 0.5;
  const score =
    reviewScore * (reviewWeight * 0.6 + 0.4) - publicPenalty * publicDataWeight;

  return Math.max(0, Math.min(10, Math.round(score * 10) / 10));
}

export function computeCategoryScore(
  ratings: number[],
  publicDataPenalty: number = 0
): number {
  if (ratings.length === 0) return 5.0;
  const avg = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
  const scaled = avg * 2;
  return Math.max(0, Math.min(10, Math.round((scaled - publicDataPenalty) * 10) / 10));
}

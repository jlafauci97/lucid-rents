export interface CalmScoreInput {
  poiPenalties: Record<
    "public_safety" | "noise" | "environmental",
    { close: number; far: number }
  >;
  blockLevel: { noise_311: number; rats: number; bedbugs: number };
  baselines: { noise_311: number; rats: number; bedbugs: number };
}

export interface CalmScoreResult {
  score: number;
  breakdown: Array<{ reason: string; penalty: number }>;
}

const W = {
  public_safety: { close: -0.5, far: -0.2 },
  noise:         { close: -0.4, far: -0.15 },
  environmental: { close: -0.6, far: -0.2 },
} as const;

const POI_LABELS = {
  public_safety: "public-safety",
  noise: "noise",
  environmental: "environmental",
} as const;

const BLOCK_LABELS = {
  noise_311: "311 noise complaints",
  rats: "rat failures",
  bedbugs: "bedbug filings",
} as const;

/**
 * Computes a 0-10 "calm score" by starting at 10 and applying penalties
 * based on proximity-weighted POI counts and block-level density ratios.
 * Returns the rounded score plus a per-reason breakdown for UI display.
 */
export function computeCalmScore(input: CalmScoreInput): CalmScoreResult {
  let score = 10.0;
  const breakdown: Array<{ reason: string; penalty: number }> = [];

  for (const cat of ["public_safety", "noise", "environmental"] as const) {
    const { close, far } = input.poiPenalties[cat];
    if (close > 0) {
      const p = close * W[cat].close;
      score += p;
      breakdown.push({
        reason: `${close} ${POI_LABELS[cat]} POIs within 0.25 mi`,
        penalty: round1(p),
      });
    }
    if (far > 0) {
      const p = far * W[cat].far;
      score += p;
      breakdown.push({
        reason: `${far} ${POI_LABELS[cat]} POIs within 0.75 mi`,
        penalty: round1(p),
      });
    }
  }

  for (const key of ["noise_311", "rats", "bedbugs"] as const) {
    const ratio = input.blockLevel[key] / Math.max(1, input.baselines[key]);
    if (ratio >= 3.0) {
      score -= 1.0;
      breakdown.push({
        reason: `${BLOCK_LABELS[key]} ≥ 3× NYC median`,
        penalty: -1.0,
      });
    } else if (ratio >= 1.5) {
      score -= 0.5;
      breakdown.push({
        reason: `${BLOCK_LABELS[key]} ≥ 1.5× NYC median`,
        penalty: -0.5,
      });
    }
  }

  return {
    score: round1(Math.max(0, Math.min(10, score))),
    breakdown,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * LucidIQ — multi-signal building score
 *
 * Combines six weighted sub-scores into a single 0-5 rating with letter grade.
 * Sub-scores that lack data return null and are skipped; remaining weights are
 * renormalized so partial-data buildings still get a fair score.
 *
 * Weights (sum to 1.0):
 *   30% Tenant Reviews        (review_count + avg_rating)
 *   25% Building Health       (HPD/DOB violations, complaints, litigations)
 *   15% Rent Fairness         (building median vs neighborhood median)
 *   10% Tenant Protection     (rent stabilized, ellis, evictions, buyouts)
 *   10% Habitability Issues   (bedbugs, lead, rodents, dangerous flags)
 *   10% City-specific Risk    (scofflaw, fire/flood zones, sea level, recert)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScoreInputs {
  building: {
    metro: string;
    total_units: number | null;
    violation_count: number | null;
    dob_violation_count: number | null;
    complaint_count: number | null;
    litigation_count: number | null;
    eviction_count: number | null;
    bedbug_report_count: number | null;
    is_rent_stabilized: boolean | null;
    ellis_act_filing: boolean | null;
    buyout_count: number | null;
    is_scofflaw: boolean | null;
    is_rlto_protected: boolean | null;
    rodent_complaint_count: number | null;
    is_soft_story: boolean | null;
    soft_story_status: string | null;
    fire_hazard_zone: string | null;
    fair_plan_risk: boolean | null;
    sea_level_risk_feet: number | null;
    forty_year_recert_status: string | null;
    unsafe_structure_count: number | null;
    in_floodplain: boolean | null;
    flood_claims_count: number | null;
    dangerous_building_count: number | null;
  };
  reviewCount: number;
  avgRating: number | null; // 0-5
  buildingMedianRent: number | null;
  neighborhoodMedianRent: number | null;
  leadInspectionFailures: number; // Chicago
  industrialProximityClosestMi: number | null; // Houston
}

export interface SubScore {
  score: number | null;
  weight: number;
  reason: string;
}

export interface ScoreOutput {
  score: number | null; // 0-5, 1 decimal — null when building is unscoreable
  grade: string; // A+/A/A-/B+/B/B-/C+/C/C-/D+/D/D-/F or "—"
  confidence: "high" | "medium" | "low" | "none"; // based on # of evidence-backed sub-scores
  evidenceCount: number; // number of sub-scores backed by real data signals (0-6)
  breakdown: {
    reviews: SubScore;
    health: SubScore;
    rentFairness: SubScore;
    protection: SubScore;
    habitability: SubScore;
    cityRisk: SubScore;
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WEIGHTS = {
  reviews: 0.30,
  health: 0.25,
  rentFairness: 0.15,
  protection: 0.10,
  habitability: 0.10,
  cityRisk: 0.10,
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function num(n: number | null | undefined): number {
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

/**
 * Weighted average that ignores entries with score=null and renormalizes the
 * remaining weights so they sum to 1.0. Returns 2.5 (neutral midpoint) if no
 * sub-scores are available.
 */
function weightedAverage(parts: SubScore[]): number {
  const present = parts.filter((p) => p.score !== null);
  if (present.length === 0) return 2.5;
  const totalWeight = present.reduce((sum, p) => sum + p.weight, 0);
  if (totalWeight === 0) return 2.5;
  const sum = present.reduce(
    (acc, p) => acc + (p.score as number) * (p.weight / totalWeight),
    0
  );
  return sum;
}

/** Map a 0-5 score to a letter grade. */
export function scoreToGrade(score: number): string {
  if (score >= 4.7) return "A+";
  if (score >= 4.3) return "A";
  if (score >= 4.0) return "A-";
  if (score >= 3.7) return "B+";
  if (score >= 3.3) return "B";
  if (score >= 3.0) return "B-";
  if (score >= 2.7) return "C+";
  if (score >= 2.3) return "C";
  if (score >= 2.0) return "C-";
  if (score >= 1.7) return "D+";
  if (score >= 1.3) return "D";
  if (score >= 1.0) return "D-";
  return "F";
}

// ---------------------------------------------------------------------------
// Sub-score calculators
// ---------------------------------------------------------------------------

function reviewsSubScore(inputs: ScoreInputs): SubScore {
  const { reviewCount, avgRating } = inputs;
  if (reviewCount <= 0 || avgRating === null) {
    return { score: null, weight: WEIGHTS.reviews, reason: "no published reviews" };
  }
  const confidence = Math.min(1, reviewCount / 5);
  // Blend toward neutral (2.5) when confidence is low; full weight at 5+ reviews.
  const blended = avgRating * confidence + 2.5 * (1 - confidence);
  const score = clamp(blended, 0, 5);
  return {
    score,
    weight: WEIGHTS.reviews,
    reason: `${reviewCount} review(s), avg ${avgRating.toFixed(2)}/5`,
  };
}

function healthSubScore(inputs: ScoreInputs): SubScore {
  const b = inputs.building;
  const violations = num(b.violation_count);
  const dob = num(b.dob_violation_count);
  const complaints = num(b.complaint_count);
  const litigations = num(b.litigation_count);
  const units = Math.max(1, num(b.total_units));
  const incidents = violations + dob + complaints + litigations * 3;
  const perUnit = incidents / units;
  const score = clamp(5 - Math.log10(perUnit + 1) * 2.5, 0, 5);
  return {
    score,
    weight: WEIGHTS.health,
    reason: `${incidents} weighted incidents over ${units} unit(s) (${perUnit.toFixed(2)}/unit)`,
  };
}

function rentFairnessSubScore(inputs: ScoreInputs): SubScore {
  const { buildingMedianRent, neighborhoodMedianRent } = inputs;
  if (
    !buildingMedianRent ||
    !neighborhoodMedianRent ||
    buildingMedianRent <= 0 ||
    neighborhoodMedianRent <= 0
  ) {
    return {
      score: null,
      weight: WEIGHTS.rentFairness,
      reason: "no rent comparison data",
    };
  }
  const ratio = buildingMedianRent / neighborhoodMedianRent;
  const pct = (ratio - 1) * 100;
  let score: number;
  if (ratio < 0.85) score = 5;
  else if (ratio < 0.95) score = 4.5;
  else if (ratio <= 1.05) score = 4;
  else if (ratio <= 1.15) score = 3;
  else if (ratio <= 1.2) score = 2;
  else score = 1;
  return {
    score,
    weight: WEIGHTS.rentFairness,
    reason: `building rent ${pct >= 0 ? "+" : ""}${pct.toFixed(1)}% vs neighborhood median`,
  };
}

function protectionSubScore(inputs: ScoreInputs): SubScore {
  const b = inputs.building;
  let score = 3;
  const notes: string[] = [];
  if (b.is_rent_stabilized) {
    score += 1.5;
    notes.push("rent stabilized");
  }
  if (b.ellis_act_filing) {
    score -= 1;
    notes.push("ellis act filing");
  }
  const evictions = num(b.eviction_count);
  if (evictions > 0) {
    const penalty = Math.min(evictions * 0.5, 1.5);
    score -= penalty;
    notes.push(`${evictions} eviction(s)`);
  }
  const buyouts = num(b.buyout_count);
  if (buyouts > 5) {
    score -= 0.5;
    notes.push(`${buyouts} buyouts`);
  }
  return {
    score: clamp(score, 0, 5),
    weight: WEIGHTS.protection,
    reason: notes.length ? notes.join(", ") : "no protection signals",
  };
}

function habitabilitySubScore(inputs: ScoreInputs): SubScore {
  const b = inputs.building;
  let score = 5;
  const notes: string[] = [];
  const bedbugs = num(b.bedbug_report_count);
  if (bedbugs > 0) {
    const penalty = Math.min(bedbugs * 0.5, 2.5);
    score -= penalty;
    notes.push(`${bedbugs} bedbug report(s)`);
  }
  const leadFails = num(inputs.leadInspectionFailures);
  if (leadFails > 0) {
    const penalty = Math.min(leadFails * 0.5, 1);
    score -= penalty;
    notes.push(`${leadFails} lead inspection failure(s)`);
  }
  const rodents = num(b.rodent_complaint_count);
  if (rodents > 5) {
    score -= 0.5;
    notes.push(`${rodents} rodent complaints`);
  }
  if (b.dangerous_building_count && b.dangerous_building_count > 0) {
    score -= 2;
    notes.push("dangerous building flagged");
  }
  if (b.unsafe_structure_count && b.unsafe_structure_count > 0) {
    score -= 0.5;
    notes.push("unsafe structure flagged");
  }
  return {
    score: clamp(score, 0, 5),
    weight: WEIGHTS.habitability,
    reason: notes.length ? notes.join(", ") : "no habitability flags",
  };
}

function cityRiskSubScore(inputs: ScoreInputs): SubScore {
  const b = inputs.building;
  const metro = (b.metro || "").toLowerCase();
  let score = 5;
  const notes: string[] = [];

  if (metro === "nyc" || metro === "new-york" || metro === "new_york") {
    if (b.is_soft_story) {
      const status = (b.soft_story_status || "").toLowerCase();
      if (!status.includes("retrofit") && !status.includes("complete")) {
        score -= 1;
        notes.push("unretrofitted soft-story");
      }
    }
  } else if (metro === "la" || metro === "los-angeles" || metro === "los_angeles") {
    const fz = (b.fire_hazard_zone || "").toLowerCase();
    if (fz.includes("very high") || fz === "high" || fz.includes("high")) {
      score -= 1;
      notes.push(`fire hazard zone: ${b.fire_hazard_zone}`);
    }
    if (b.fair_plan_risk) {
      score -= 1;
      notes.push("FAIR plan insurance risk");
    }
  } else if (metro === "chicago") {
    if (b.is_scofflaw) {
      score -= 2;
      notes.push("scofflaw landlord");
    }
    if (b.is_rlto_protected === false) {
      score -= 0.5;
      notes.push("not RLTO protected");
    }
  } else if (metro === "miami") {
    const slr = num(b.sea_level_risk_feet);
    if (slr > 0) {
      const penalty = Math.min(slr * 0.5, 2);
      score -= penalty;
      notes.push(`${slr}ft sea level risk`);
    }
    if ((b.forty_year_recert_status || "").toLowerCase() === "overdue") {
      score -= 1;
      notes.push("40-year recert overdue");
    }
  } else if (metro === "houston") {
    if (b.in_floodplain) {
      score -= 1;
      notes.push("in floodplain");
    }
    const ind = inputs.industrialProximityClosestMi;
    if (typeof ind === "number" && ind >= 0 && ind < 0.5) {
      score -= 0.5;
      notes.push(`industrial site ${ind.toFixed(2)}mi away`);
    }
  }

  return {
    score: clamp(score, 0, 5),
    weight: WEIGHTS.cityRisk,
    reason: notes.length ? notes.join(", ") : `no ${metro || "city"} risk flags`,
  };
}

// ---------------------------------------------------------------------------
// Public entry
// ---------------------------------------------------------------------------

/**
 * Determine which sub-scores are backed by real data signals (not just defaults).
 * A sub-score with "no negative signals" still gets max score, but that's only
 * meaningful evidence if we know the data was actually checked.
 */
function countEvidence(inputs: ScoreInputs): number {
  const b = inputs.building;
  let count = 0;
  // reviews: real evidence if any reviews exist
  if (inputs.reviewCount > 0) count++;
  // health: real evidence if any incidents OR if total_units is known (means we have building data)
  const incidents = num(b.violation_count) + num(b.dob_violation_count) + num(b.complaint_count) + num(b.litigation_count);
  if (incidents > 0) count++;
  // rent fairness: real evidence if both building & neighborhood rent exist
  if (inputs.buildingMedianRent && inputs.neighborhoodMedianRent) count++;
  // protection: real evidence if any protection signal is set (rent stab, ellis, evictions, buyouts)
  if (b.is_rent_stabilized || b.ellis_act_filing || num(b.eviction_count) > 0 || num(b.buyout_count) > 0) count++;
  // habitability: real evidence if any negative signal
  if (num(b.bedbug_report_count) > 0 || inputs.leadInspectionFailures > 0 || num(b.rodent_complaint_count) > 5 || num(b.dangerous_building_count) > 0 || num(b.unsafe_structure_count) > 0) count++;
  // city risk: real evidence if any city-specific risk flag is set
  if (b.is_soft_story || b.fire_hazard_zone || b.fair_plan_risk || b.is_scofflaw || (b.sea_level_risk_feet ?? 0) > 0 || b.in_floodplain || (b.forty_year_recert_status || "").toLowerCase() === "overdue") count++;
  return count;
}

export function computeLucidIQ(inputs: ScoreInputs): ScoreOutput {
  const breakdown = {
    reviews: reviewsSubScore(inputs),
    health: healthSubScore(inputs),
    rentFairness: rentFairnessSubScore(inputs),
    protection: protectionSubScore(inputs),
    habitability: habitabilitySubScore(inputs),
    cityRisk: cityRiskSubScore(inputs),
  };

  const all: SubScore[] = [
    breakdown.reviews,
    breakdown.health,
    breakdown.rentFairness,
    breakdown.protection,
    breakdown.habitability,
    breakdown.cityRisk,
  ];

  const evidenceCount = countEvidence(inputs);

  // Skip unscoreable buildings: zero evidence = no signals at all
  if (evidenceCount === 0) {
    return {
      score: null,
      grade: "\u2014",
      confidence: "none",
      evidenceCount: 0,
      breakdown,
    };
  }

  const raw = weightedAverage(all);

  // Confidence factor — softer than before. Only meaningfully penalize
  // very thin evidence, and cap the penalty at 0.75 points off the raw score.
  let confidenceFactor: number;
  let confidence: "high" | "medium" | "low" | "none";
  if (evidenceCount >= 3) {
    confidenceFactor = 1.0;
    confidence = "high";
  } else if (evidenceCount === 2) {
    confidenceFactor = 0.9;
    confidence = "medium";
  } else {
    confidenceFactor = 0.75;
    confidence = "low";
  }

  // Pull score toward neutral 2.5 by (1 - confidenceFactor),
  // but cap the total adjustment at 0.75 points so good buildings with
  // thin evidence aren't unfairly knocked down.
  const idealAdjusted = 2.5 + (raw - 2.5) * confidenceFactor;
  const delta = idealAdjusted - raw;
  const cappedDelta = Math.sign(delta) * Math.min(Math.abs(delta), 0.75);
  const adjusted = raw + cappedDelta;
  const score = Math.round(clamp(adjusted, 0, 5) * 10) / 10;

  return {
    score,
    grade: scoreToGrade(score),
    confidence,
    evidenceCount,
    breakdown,
  };
}

// ---------------------------------------------------------------------------
// Quick self-test (commented out — uncomment to run)
// ---------------------------------------------------------------------------

// console.log(
//   JSON.stringify(
//     computeLucidIQ({
//       building: {
//         metro: "nyc",
//         total_units: 40,
//         violation_count: 12,
//         dob_violation_count: 2,
//         complaint_count: 8,
//         litigation_count: 1,
//         eviction_count: 2,
//         bedbug_report_count: 1,
//         is_rent_stabilized: true,
//         ellis_act_filing: false,
//         buyout_count: 0,
//         is_scofflaw: null,
//         is_rlto_protected: null,
//         rodent_complaint_count: null,
//         is_soft_story: false,
//         soft_story_status: null,
//         fire_hazard_zone: null,
//         fair_plan_risk: null,
//         sea_level_risk_feet: null,
//         forty_year_recert_status: null,
//         unsafe_structure_count: null,
//         in_floodplain: null,
//         flood_claims_count: null,
//         dangerous_building_count: null,
//       },
//       reviewCount: 8,
//       avgRating: 4.1,
//       buildingMedianRent: 3200,
//       neighborhoodMedianRent: 3100,
//       leadInspectionFailures: 0,
//       industrialProximityClosestMi: null,
//     }),
//     null,
//     2
//   )
// );

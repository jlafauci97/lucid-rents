/**
 * LucidIQ Reasoning — generates a unique, data-grounded reasoning sentence
 * per building. Used in the building hero in place of templated copy.
 *
 * Each building hits a different subset of findings, and findings include
 * comparative claims ("worst on block", "above portfolio average", "rents
 * 18% over neighborhood median") so no two buildings get the same sentence.
 */

import { normalizeScore } from "./constants";

export interface ReasoningInput {
  building: {
    metro: string;
    borough: string;
    year_built: number | null;
    total_units: number | null;
    overall_score: number | null;
    violation_count: number;
    dob_violation_count: number;
    complaint_count: number;
    eviction_count: number;
    litigation_count: number;
    bedbug_report_count: number;
    rodent_complaint_count: number;
    is_rent_stabilized: boolean;
    stabilized_units: number | null;
    is_soft_story: boolean;
    soft_story_status: string | null;
    fire_hazard_zone: string | null;
    fair_plan_risk: boolean;
    is_scofflaw: boolean;
    sea_level_risk_feet: number | null;
    forty_year_recert_status: string | null;
    in_floodplain: boolean;
    dangerous_building_count: number;
    buyout_count: number;
    ellis_act_filing: boolean;
  };
  reviewCount: number;
  avgRating: number | null; // 0-5
  ownerName: string | null;
  portfolioSize: number;
  portfolioAvgScore: number | null; // 0-5
  neighborhoodAvgScore: number | null; // 0-5
  neighborhoodBuildingCount: number;
  neighborhoodMedian1BR: number | null;
  buildingMedian1BR: number | null;
}

interface Finding {
  text: string;
  magnitude: number; // 0-10
  polarity: "good" | "bad" | "neutral";
}

function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

function plural(n: number, singular: string, pluralForm?: string): string {
  return `${n} ${n === 1 ? singular : (pluralForm ?? `${singular}s`)}`;
}

export function generateFindings(input: ReasoningInput): Finding[] {
  const b = input.building;
  const findings: Finding[] = [];
  const units = b.total_units ?? 0;

  // ── Safety / building health ──────────────────────────────────
  const totalViolations = b.violation_count + b.dob_violation_count;
  if (totalViolations > 0) {
    if (units > 0) {
      const perUnit = totalViolations / units;
      if (perUnit >= 2) {
        findings.push({
          text: `${totalViolations.toLocaleString()} open violations across ${plural(units, "unit")} (${perUnit.toFixed(1)}/unit)`,
          magnitude: Math.min(10, 4 + perUnit),
          polarity: "bad",
        });
      } else if (perUnit >= 0.5) {
        findings.push({
          text: `${totalViolations.toLocaleString()} open ${totalViolations === 1 ? "violation" : "violations"} on file`,
          magnitude: 3 + perUnit * 2,
          polarity: "bad",
        });
      } else {
        findings.push({
          text: `${plural(totalViolations, "violation")} on file`,
          magnitude: 2,
          polarity: "neutral",
        });
      }
    } else {
      // No unit count — fall back to absolute magnitude
      const magnitude = totalViolations >= 100 ? 9 : totalViolations >= 25 ? 7 : totalViolations >= 5 ? 4 : 2;
      findings.push({
        text: `${totalViolations.toLocaleString()} open ${totalViolations === 1 ? "violation" : "violations"} on file`,
        magnitude,
        polarity: totalViolations >= 5 ? "bad" : "neutral",
      });
    }
  } else if (units > 5 && totalViolations === 0) {
    findings.push({
      text: "no open violations on file",
      magnitude: 4,
      polarity: "good",
    });
  }

  // 311 complaints — independent absolute signal
  if (b.complaint_count > 0) {
    const magnitude = b.complaint_count >= 500 ? 8 : b.complaint_count >= 100 ? 6 : b.complaint_count >= 20 ? 4 : 2;
    findings.push({
      text: `${b.complaint_count.toLocaleString()} 311 ${b.complaint_count === 1 ? "complaint" : "complaints"} on record`,
      magnitude,
      polarity: b.complaint_count >= 20 ? "bad" : "neutral",
    });
  }

  // Litigations — independent signal
  if (b.litigation_count > 0) {
    findings.push({
      text: `${plural(b.litigation_count, "active litigation matter")}`,
      magnitude: Math.min(8, 3 + b.litigation_count / 10),
      polarity: "bad",
    });
  }

  // ── Tenant treatment ─────────────────────────────────────────
  if (b.eviction_count > 0) {
    findings.push({
      text: `${plural(b.eviction_count, "eviction")} filed`,
      magnitude: Math.min(10, 3 + b.eviction_count),
      polarity: "bad",
    });
  }
  if (b.buyout_count > 0) {
    findings.push({
      text: `${plural(b.buyout_count, "tenant buyout")} disclosed`,
      magnitude: Math.min(8, 3 + b.buyout_count * 0.5),
      polarity: "bad",
    });
  }
  if (b.ellis_act_filing) {
    findings.push({
      text: "Ellis Act filing on record",
      magnitude: 8,
      polarity: "bad",
    });
  }

  // ── Habitability flags ───────────────────────────────────────
  if (b.bedbug_report_count > 0) {
    findings.push({
      text: `${plural(b.bedbug_report_count, "bedbug report")}`,
      magnitude: Math.min(9, 4 + b.bedbug_report_count),
      polarity: "bad",
    });
  }
  if (b.dangerous_building_count > 0) {
    findings.push({
      text: "flagged as a dangerous building",
      magnitude: 10,
      polarity: "bad",
    });
  }
  if (b.is_soft_story && !/retrofit|complete/i.test(b.soft_story_status ?? "")) {
    findings.push({
      text: "unretrofitted soft-story (earthquake risk)",
      magnitude: 7,
      polarity: "bad",
    });
  }

  // ── Financial / protection ───────────────────────────────────
  if (b.is_rent_stabilized) {
    const su = b.stabilized_units ?? 0;
    findings.push({
      text: su > 0 ? `rent-stabilized with ${plural(su, "stabilized unit")}` : "rent-stabilized",
      magnitude: 6,
      polarity: "good",
    });
  }
  if (input.buildingMedian1BR != null && input.neighborhoodMedian1BR != null && input.neighborhoodMedian1BR > 0) {
    const ratio = input.buildingMedian1BR / input.neighborhoodMedian1BR;
    const deltaPct = Math.round((ratio - 1) * 100);
    if (Math.abs(deltaPct) >= 8) {
      findings.push({
        text: `1BR rents ${deltaPct >= 0 ? "+" : ""}${deltaPct}% vs neighborhood median`,
        magnitude: Math.min(7, 3 + Math.abs(deltaPct) / 10),
        polarity: deltaPct >= 15 ? "bad" : deltaPct <= -10 ? "good" : "neutral",
      });
    }
  }

  // ── Ownership context ────────────────────────────────────────
  if (input.ownerName && input.portfolioSize > 1) {
    if (input.portfolioAvgScore != null && b.overall_score != null) {
      const portfolioScore = normalizeScore(input.portfolioAvgScore);
      const ownScore = normalizeScore(b.overall_score);
      const delta = ownScore - portfolioScore;
      if (delta <= -0.5) {
        findings.push({
          text: `worst-performing building in ${input.ownerName}'s ${plural(input.portfolioSize, "building")} portfolio`,
          magnitude: 7,
          polarity: "bad",
        });
      } else if (delta >= 0.5) {
        findings.push({
          text: `top performer in ${input.ownerName}'s ${plural(input.portfolioSize, "building")} portfolio`,
          magnitude: 6,
          polarity: "good",
        });
      } else if (input.portfolioSize >= 5) {
        findings.push({
          text: `${input.ownerName} owns ${plural(input.portfolioSize, "building")} across ${b.metro === "nyc" ? "NYC" : "the metro"}`,
          magnitude: 4,
          polarity: "neutral",
        });
      }
    }
  }

  // ── Comparative vs neighborhood ──────────────────────────────
  if (input.neighborhoodAvgScore != null && b.overall_score != null && input.neighborhoodBuildingCount >= 5) {
    const own = normalizeScore(b.overall_score);
    const nbh = normalizeScore(input.neighborhoodAvgScore);
    const delta = own - nbh;
    if (delta >= 0.5) {
      findings.push({
        text: `scores above the neighborhood average across ${plural(input.neighborhoodBuildingCount, "tracked building")}`,
        magnitude: 5,
        polarity: "good",
      });
    } else if (delta <= -0.5) {
      const percentileBucket = delta <= -1 ? "bottom quartile" : "below average";
      findings.push({
        text: `${percentileBucket} for ${b.borough} buildings tracked`,
        magnitude: 6,
        polarity: "bad",
      });
    }
  }

  // ── Community / reviews ──────────────────────────────────────
  if (input.reviewCount > 0 && input.avgRating != null) {
    const stars = input.avgRating.toFixed(1);
    findings.push({
      text: `${stars}/5 across ${plural(input.reviewCount, "tenant review")}`,
      magnitude: input.reviewCount >= 10 ? 6 : 4,
      polarity: input.avgRating >= 4 ? "good" : input.avgRating <= 2.5 ? "bad" : "neutral",
    });
  }

  // ── Climate / city-specific ──────────────────────────────────
  if ((b.sea_level_risk_feet ?? 0) > 0) {
    findings.push({
      text: `${b.sea_level_risk_feet}ft sea-level rise exposure`,
      magnitude: Math.min(7, 4 + (b.sea_level_risk_feet ?? 0)),
      polarity: "bad",
    });
  }
  if (b.in_floodplain) {
    findings.push({ text: "located in a floodplain", magnitude: 5, polarity: "bad" });
  }
  if (/very high|high/i.test(b.fire_hazard_zone ?? "")) {
    findings.push({
      text: `${b.fire_hazard_zone?.toLowerCase()} fire hazard zone`,
      magnitude: 6,
      polarity: "bad",
    });
  }
  if (b.is_scofflaw) {
    findings.push({ text: "registered as a scofflaw landlord", magnitude: 8, polarity: "bad" });
  }
  if ((b.forty_year_recert_status ?? "").toLowerCase() === "overdue") {
    findings.push({ text: "40-year recertification overdue", magnitude: 6, polarity: "bad" });
  }

  // ── Building character (low magnitude — only used as filler) ─
  if (b.year_built) {
    const age = new Date().getFullYear() - b.year_built;
    const era =
      b.year_built < 1929 ? "prewar" :
      b.year_built < 1960 ? "mid-century" :
      b.year_built < 1990 ? "late-20th-century" :
      b.year_built < 2010 ? "modern" : "new-construction";
    findings.push({
      text: `${era} ${b.year_built >= 2010 ? "build" : "building"} (${b.year_built}${age > 0 ? `, ${age} years old` : ""})`,
      magnitude: 1.5,
      polarity: "neutral",
    });
  }

  return findings;
}

/**
 * Compose a unique reasoning sentence from the top-magnitude findings.
 * Returns null if fewer than 2 findings exist (caller should fall back).
 */
export function formatReasoning(findings: Finding[]): string | null {
  if (findings.length < 2) return null;
  const ranked = [...findings].sort((a, b) => b.magnitude - a.magnitude);
  const top = ranked.slice(0, 3);

  const phrases = top.map((f) => f.text);
  const overallTone = top.filter((f) => f.polarity === "bad").length >= 2 ? "bad" : top.filter((f) => f.polarity === "good").length >= 2 ? "good" : "mixed";

  const lead = phrases[0][0].toUpperCase() + phrases[0].slice(1);
  if (phrases.length === 2) {
    const joiner = overallTone === "mixed" ? " — though " : " and ";
    return `${lead}${joiner}${phrases[1]}.`;
  }
  // 3 phrases — middle joiner depends on polarity contrast
  const midJoiner = top[1].polarity !== top[0].polarity ? "though " : "";
  const tailJoiner = top[2].polarity !== top[1].polarity ? " — but " : ", and ";
  return `${lead}; ${midJoiner}${phrases[1]}${tailJoiner}${phrases[2]}.`;
}

export function buildingReasoning(input: ReasoningInput): string | null {
  const findings = generateFindings(input);
  return formatReasoning(findings);
}

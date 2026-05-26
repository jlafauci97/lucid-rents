/**
 * LucidIQ NL Summary — generates a 60–120 word, data-grounded paragraph per
 * building.
 *
 * Safety gate: requires ≥3 unique data points sourced from the building row.
 * If the gate fails, returns null (the caller should render nothing — better
 * than boilerplate that violates Google's scaled-content policy).
 *
 * Every sentence references a real field; no rephrased templates.
 */

import { CITY_SHORT_NAME, type City } from "./cities";

export interface SummaryInput {
  building: {
    metro: City;
    full_address: string;
    borough: string;
    year_built: number | null;
    num_floors: number | null;
    total_units: number | null;
    owner_name: string | null;
    management_company: string | null;
    violation_count: number;
    dob_violation_count: number;
    complaint_count: number;
    litigation_count: number;
    eviction_count: number;
    buyout_count: number;
    bedbug_report_count: number;
    rodent_complaint_count: number;
    is_rent_stabilized: boolean;
    stabilized_units: number | null;
    stabilized_year: number | null;
    is_soft_story: boolean;
    soft_story_status: string | null;
    fire_hazard_zone: string | null;
    fair_plan_risk: boolean;
    is_scofflaw: boolean;
    sea_level_risk_feet: number | null;
    forty_year_recert_status: string | null;
    in_floodplain: boolean;
    dangerous_building_count: number;
    ellis_act_filing: boolean;
    review_count: number;
    bbl: string | null;
    bin: string | null;
    apn: string | null;
  };
  neighborhood: string;
}

function plural(n: number, singular: string, pluralForm?: string): string {
  return `${n.toLocaleString("en-US")} ${n === 1 ? singular : (pluralForm ?? `${singular}s`)}`;
}

function era(year: number): string {
  if (year < 1929) return "prewar";
  if (year < 1960) return "mid-century";
  if (year < 1990) return "late-20th-century";
  if (year < 2010) return "modern";
  return "new-construction";
}

function streetOf(full: string): string {
  return full.split(",")[0]?.trim() ?? full;
}

interface DataPoint {
  ok: boolean;
}

function countDataPoints(b: SummaryInput["building"]): number {
  const points: DataPoint[] = [
    { ok: b.year_built != null },
    { ok: (b.total_units ?? 0) > 0 },
    { ok: b.num_floors != null },
    { ok: !!b.owner_name || !!b.management_company },
    { ok: b.violation_count > 0 },
    { ok: b.dob_violation_count > 0 },
    { ok: b.complaint_count > 0 },
    { ok: b.litigation_count > 0 },
    { ok: b.eviction_count > 0 },
    { ok: b.buyout_count > 0 },
    { ok: b.bedbug_report_count > 0 },
    { ok: b.rodent_complaint_count > 5 },
    { ok: b.is_rent_stabilized },
    { ok: (b.stabilized_units ?? 0) > 0 },
    { ok: b.is_soft_story },
    { ok: !!b.fire_hazard_zone },
    { ok: b.fair_plan_risk },
    { ok: b.is_scofflaw },
    { ok: (b.sea_level_risk_feet ?? 0) > 0 },
    { ok: (b.forty_year_recert_status ?? "").toLowerCase() === "overdue" },
    { ok: b.in_floodplain },
    { ok: b.dangerous_building_count > 0 },
    { ok: b.ellis_act_filing },
    { ok: b.review_count > 0 },
    { ok: !!b.bbl || !!b.bin || !!b.apn },
  ];
  return points.filter((p) => p.ok).length;
}

/**
 * Construct a per-building paragraph from real fields. Each sentence is
 * conditional on the data — no rephrased boilerplate.
 *
 * Returns null when fewer than 3 data points are available (safety gate).
 */
export function buildNLSummary(input: SummaryInput): string | null {
  const b = input.building;
  const dp = countDataPoints(b);
  if (dp < 3) return null;

  const cityShort = CITY_SHORT_NAME[b.metro] ?? b.borough;
  const street = streetOf(b.full_address);
  const sentences: string[] = [];

  // Intro: ground in year + units + locale (varies by available fields)
  const introBits: string[] = [];
  if (b.year_built) {
    const e = era(b.year_built);
    introBits.push(`a ${e} ${b.year_built} building`);
  }
  if (b.num_floors && b.num_floors >= 5) {
    introBits.push(`${b.num_floors} floors`);
  }
  if (b.total_units && b.total_units > 0) {
    introBits.push(`${plural(b.total_units, "unit")}`);
  }
  if (introBits.length === 0) {
    introBits.push("a rental building");
  }
  sentences.push(`${street} is ${introBits.join(", ")} in ${input.neighborhood}, ${cityShort}.`);

  // Ownership / portfolio
  const owner = b.owner_name ?? b.management_company;
  if (owner) {
    const mgmt = b.management_company && b.management_company !== b.owner_name ? `, managed by ${b.management_company}` : "";
    sentences.push(`Owned by ${owner}${mgmt}.`);
  }

  // Issues & complaints
  const issuesParts: string[] = [];
  const totalVio = b.violation_count + b.dob_violation_count;
  if (totalVio > 0) {
    issuesParts.push(`${plural(totalVio, "open violation")}`);
  }
  if (b.complaint_count > 0) {
    issuesParts.push(`${plural(b.complaint_count, "311 complaint")}`);
  }
  if (b.litigation_count > 0) {
    issuesParts.push(`${plural(b.litigation_count, "active litigation matter")}`);
  }
  if (issuesParts.length > 0) {
    sentences.push(`Public records show ${issuesParts.join(", ")} on file.`);
  }

  // Tenant treatment
  const treatmentParts: string[] = [];
  if (b.eviction_count > 0) treatmentParts.push(`${plural(b.eviction_count, "eviction")}`);
  if (b.buyout_count > 0) treatmentParts.push(`${plural(b.buyout_count, "tenant buyout")} disclosed`);
  if (b.ellis_act_filing) treatmentParts.push("an Ellis Act filing");
  if (treatmentParts.length > 0) {
    sentences.push(`Tenant-impact history includes ${treatmentParts.join(", ")}.`);
  }

  // Habitability / structural flags
  const flagParts: string[] = [];
  if (b.bedbug_report_count > 0) flagParts.push(`${plural(b.bedbug_report_count, "bedbug report")}`);
  if (b.rodent_complaint_count > 5) flagParts.push(`${plural(b.rodent_complaint_count, "rodent complaint")}`);
  if (b.dangerous_building_count > 0) flagParts.push("a dangerous-building flag");
  if (b.is_soft_story && !/retrofit|complete/i.test(b.soft_story_status ?? "")) {
    flagParts.push("unretrofitted soft-story construction");
  }
  if (/very high|high/i.test(b.fire_hazard_zone ?? "")) {
    flagParts.push(`${b.fire_hazard_zone?.toLowerCase()} fire hazard zoning`);
  }
  if ((b.sea_level_risk_feet ?? 0) > 0) {
    flagParts.push(`${b.sea_level_risk_feet}ft sea-level rise exposure`);
  }
  if (b.in_floodplain) flagParts.push("a floodplain location");
  if ((b.forty_year_recert_status ?? "").toLowerCase() === "overdue") {
    flagParts.push("an overdue 40-year recertification");
  }
  if (flagParts.length > 0) {
    sentences.push(`Risk signals: ${flagParts.join(", ")}.`);
  }

  // Protections / financial
  if (b.is_rent_stabilized) {
    const su = b.stabilized_units ?? 0;
    if (su > 0) {
      sentences.push(`Rent stabilization on file covers ${plural(su, "unit")}${b.stabilized_year ? ` (registered ${b.stabilized_year})` : ""}.`);
    } else {
      sentences.push("The building is rent-stabilized.");
    }
  }

  // Reviews context (only if any exist)
  if (b.review_count > 0) {
    sentences.push(`Lucid Rents has ${plural(b.review_count, "verified tenant review")} on this building.`);
  }

  const text = sentences.join(" ");
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (wordCount < 30) return null;
  return text;
}

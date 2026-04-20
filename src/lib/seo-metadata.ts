import type { City } from "./cities";
import { CITY_SHORT_NAME, CITY_META } from "./cities";

const TITLE_MAX = 70;
const DESCRIPTION_MAX = 155;

export interface BuildingTitleInput {
  shortAddress: string;
  neighborhood: string;
  city: City;
}

export function buildBuildingTitle(input: BuildingTitleInput): string {
  const cityShort = CITY_SHORT_NAME[input.city];
  const full = `${input.shortAddress}: Reviews, Violations & Score | ${input.neighborhood}, ${cityShort}`;
  if (full.length <= TITLE_MAX) return full;

  const noViolations = `${input.shortAddress}: Reviews & Score | ${input.neighborhood}, ${cityShort}`;
  if (noViolations.length <= TITLE_MAX) return noViolations;

  const noCity = `${input.shortAddress}: Reviews & Score | ${input.neighborhood}`;
  if (noCity.length <= TITLE_MAX) return noCity;

  // Last resort: truncate with ellipsis
  return noCity.slice(0, TITLE_MAX - 1) + "…";
}

export interface BuildingDescriptionInput {
  shortAddress: string;
  neighborhood: string;
  issues: number;
  reviewCount: number;
  overallScore: number | null;
}

export function buildBuildingDescription(input: BuildingDescriptionInput): string {
  const issuesFormatted = input.issues.toLocaleString("en-US");
  const firstClause = `${input.shortAddress} in ${input.neighborhood}: ${issuesFormatted} issues filed`;

  const reviewsClause =
    input.reviewCount > 0
      ? `${input.reviewCount.toLocaleString("en-US")} tenant reviews`
      : "0 reviews yet";

  const scoreClause =
    input.overallScore != null ? `LucidIQ ${input.overallScore.toFixed(1)}/5` : null;

  const closer = "Free rent intelligence.";

  const parts = [firstClause, reviewsClause];
  if (scoreClause) parts.push(scoreClause);
  const full = `${parts.join(", ")}. ${closer}`;
  if (full.length <= DESCRIPTION_MAX) return full;

  // Step 1: drop closer
  const noCloser = `${parts.join(", ")}.`;
  if (noCloser.length <= DESCRIPTION_MAX) return noCloser;

  // Step 2: drop LucidIQ
  const noScore = [firstClause, reviewsClause].join(", ") + ".";
  if (noScore.length <= DESCRIPTION_MAX) return noScore;

  // Step 3: drop reviews
  const firstOnly = `${firstClause}.`;
  if (firstOnly.length <= DESCRIPTION_MAX) return firstOnly;

  // Step 4: truncate
  return firstClause.slice(0, DESCRIPTION_MAX - 1) + "…";
}

export function buildBuildingH1(input: BuildingTitleInput): string {
  const cityShort = CITY_SHORT_NAME[input.city];
  return `${input.shortAddress} — Rent Intelligence for ${input.neighborhood}, ${cityShort}`;
}

export interface BuildingLeadParagraphInput {
  fullAddress: string;
  neighborhood: string;
  city: City;
  totalUnits: number | null;
}

export function buildBuildingLeadParagraph(input: BuildingLeadParagraphInput): string {
  const cityShort = CITY_SHORT_NAME[input.city];
  const unitPrefix = input.totalUnits ? `${input.totalUnits.toLocaleString("en-US")}-unit ` : "";
  return `${input.fullAddress} is a ${unitPrefix}rental building in ${input.neighborhood}, ${cityShort}. See every violation, 311 complaint, tenant review, and the LucidIQ score — before you sign a lease.`;
}

export interface LandlordTitleInput {
  name: string;
  buildingCount: number;
  totalIssues: number;
  city: City;
}

export function buildLandlordTitle(input: LandlordTitleInput): string {
  const cityShort = CITY_SHORT_NAME[input.city];
  return `${input.name}: ${input.buildingCount.toLocaleString("en-US")} Buildings, ${input.totalIssues.toLocaleString("en-US")} Issues Filed & Tenant Reviews | ${cityShort}`;
}

export function buildLandlordDescription(input: LandlordTitleInput): string {
  const cityLong = CITY_META[input.city].fullName;
  return `See every one of ${input.name}'s ${input.buildingCount.toLocaleString("en-US")} ${cityLong} buildings, all ${input.totalIssues.toLocaleString("en-US")} violations + 311 complaints filed against them, and real tenant reviews. Free rent intelligence.`;
}

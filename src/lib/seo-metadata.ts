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
  const bc = input.buildingCount.toLocaleString("en-US");
  const ti = input.totalIssues.toLocaleString("en-US");

  const full = `${input.name}: ${bc} Buildings, ${ti} Issues Filed & Tenant Reviews | ${cityShort}`;
  if (full.length <= TITLE_MAX) return full;

  const noReviews = `${input.name}: ${bc} Buildings, ${ti} Issues Filed | ${cityShort}`;
  if (noReviews.length <= TITLE_MAX) return noReviews;

  const noFiled = `${input.name}: ${bc} Buildings, ${ti} Issues | ${cityShort}`;
  if (noFiled.length <= TITLE_MAX) return noFiled;

  const noIssues = `${input.name}: ${bc} Buildings | ${cityShort}`;
  if (noIssues.length <= TITLE_MAX) return noIssues;

  const noCity = `${input.name}: ${bc} Buildings`;
  if (noCity.length <= TITLE_MAX) return noCity;

  return noCity.slice(0, TITLE_MAX - 1) + "…";
}

export function buildLandlordDescription(input: LandlordTitleInput): string {
  const cityLong = CITY_META[input.city].fullName;
  const bc = input.buildingCount.toLocaleString("en-US");
  const ti = input.totalIssues.toLocaleString("en-US");

  // Full form
  const full = `See every one of ${input.name}'s ${bc} ${cityLong} buildings, all ${ti} violations + 311 complaints filed against them, and real tenant reviews. Free rent intelligence.`;
  if (full.length <= DESCRIPTION_MAX) return full;

  // Step 1: drop " Free rent intelligence."
  const noCloser = `See every one of ${input.name}'s ${bc} ${cityLong} buildings, all ${ti} violations + 311 complaints filed against them, and real tenant reviews.`;
  if (noCloser.length <= DESCRIPTION_MAX) return noCloser;

  // Step 2: drop "and real tenant reviews"
  const noReviews = `See every one of ${input.name}'s ${bc} ${cityLong} buildings, all ${ti} violations + 311 complaints filed against them.`;
  if (noReviews.length <= DESCRIPTION_MAX) return noReviews;

  // Step 3: drop " + 311 complaints"
  const noComplaints = `See every one of ${input.name}'s ${bc} ${cityLong} buildings, all ${ti} violations filed.`;
  if (noComplaints.length <= DESCRIPTION_MAX) return noComplaints;

  // Step 4: truncate with ellipsis
  return noComplaints.slice(0, DESCRIPTION_MAX - 1) + "…";
}

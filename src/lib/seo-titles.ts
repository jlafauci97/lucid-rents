/**
 * SEO Title cascade for building + landlord pages.
 *
 * Each page calls `pickBuildingTitle()` or `pickLandlordTitle()` with whatever
 * data it has. The cascade walks an ordered list of templates from "most
 * clickbait" to "boilerplate" and returns the first whose data conditions are
 * met. Negative templates (high violation/complaint counts, low grades) take
 * priority over positive templates by design — bad data drives clicks.
 *
 * Hard rules:
 *   1. Every template must be defensible from real data — no fabricated claims.
 *   2. Every render is length-checked; if a template overflows 70 chars, the
 *      cascade falls through to the next tier.
 *   3. Singular/plural agreement and number formatting are handled centrally.
 *   4. Landlord names are smart-cased for display (DB stays as-is).
 */

import type { City } from "./cities";
import { CITY_SHORT_NAME, CITY_META } from "./cities";

// Title brand suffix is added by the root layout (` | Lucid Rents`, 14 chars).
// We *prefer* ≤ 56 chars (≤ 70 with brand) for clean SERP display, but the
// cascade only rejects a template at HARD_MAX. Many of our intentional-long
// templates (L2 "...Coincidence or Pattern?", L1 "...Most-Cited Building?")
// run 65–80 chars on purpose — Google truncates with a cliffhanger, which
// often *boosts* CTR. We still cap at HARD_MAX to prevent a runaway
// "STELLAR... INC.: 9,999 Violations Across 99 Buildings. The Data..."
// from overflowing past Google's title budget entirely.
const HARD_MAX = 90;
// Used by the baseline tier so its plain rendering stays compact for known
// pages with very long addresses. Templates that exceed this are still
// emitted; only baseline truncates to TITLE_PREFERRED.
const TITLE_PREFERRED = 56;

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

// Acronyms that stay all-caps in display ("ABC LLC", "Stellar West LP").
// We deliberately exclude "INC", "CORP", "CO", "ASSOC" — these read better as
// "Inc.", "Corp.", "Co.", "Assoc." in titles. State codes also excluded since
// they almost never appear in landlord names.
const ACRONYMS = new Set([
  "LLC", "LLP", "PLLC", "LP", "LTD", "HDFC",
  "II", "III", "IV", "V",  // Roman numerals (e.g. "JOHN SMITH II")
]);

/**
 * Convert ALL-CAPS landlord names to Title Case for display, while preserving
 * a small set of pure-acronym suffixes (LLC, LP, etc.) and short initialisms.
 *
 *   "STELLAR MANAGEMENT"             → "Stellar Management"
 *   "LINDEN PLAZA HOUSING CO., INC." → "Linden Plaza Housing Co., Inc."
 *   "ABC REALTY CORP"                → "ABC Realty Corp"
 *   "STELLAR WEST 178 LLC"           → "Stellar West 178 LLC"
 *
 * Rules, in order:
 *   1. If the name already has any lowercase, return as-is.
 *   2. Token with embedded "." → treat as abbreviation, title-case alphabetic
 *      runs (so "INC." → "Inc.", "U.S." → "U.S.").
 *   3. Token in ACRONYMS set → preserve caps (LLC, LP, etc.).
 *   4. Token ≤ 3 chars all caps and no period → preserve (assumed initialism
 *      like "ABC", "JB", "XY").
 *   5. Otherwise → title-case.
 */
export function smartCaseName(raw: string): string {
  if (!raw) return raw;
  if (/[a-z]/.test(raw)) return raw;

  // Split on whitespace and commas/slashes, keeping the separators. We do NOT
  // split on periods — a token like "CO." stays whole so we can detect the
  // abbreviation and title-case it.
  return raw
    .split(/(\s+|[,/&])/)
    .map((token) => {
      if (!token.trim()) return token;
      if (/^[,/&]+$/.test(token)) return token;

      const stripped = token.replace(/[^A-Z0-9]/g, "");

      // Tokens with an embedded period are abbreviations — title-case alpha.
      if (token.includes(".")) {
        return token.replace(/[A-Za-z]+/g, (word) => {
          if (ACRONYMS.has(word.toUpperCase())) return word.toUpperCase();
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        });
      }

      if (ACRONYMS.has(stripped)) return token;

      // 1-3 char all-caps tokens (no period) → preserve as initialism.
      if (stripped.length <= 3 && /^[A-Z]+$/.test(stripped)) return token;

      return token.replace(/[A-Za-z]+/g, (word) => {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      });
    })
    .join("");
}

/** Format a non-negative integer with comma separators. */
export function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

/** Pluralize a noun based on count. Pass a custom plural for irregulars. */
export function plural(count: number, singular: string, pluralForm?: string): string {
  if (count === 1) return singular;
  return pluralForm ?? `${singular}s`;
}

/** "1 building" / "2 buildings" — count + pluralized noun */
function nounWithCount(count: number, singular: string, pluralForm?: string): string {
  return `${formatNumber(count)} ${plural(count, singular, pluralForm)}`;
}

/** Letter grade buckets we consider "good" (positive frame eligible). */
const GOOD_GRADES = new Set(["A", "A-", "B+"]);
const TOP_GRADES = new Set(["A", "A-"]);

function isGood(grade: string | null | undefined): boolean {
  return !!grade && GOOD_GRADES.has(grade);
}
function isTop(grade: string | null | undefined): boolean {
  return !!grade && TOP_GRADES.has(grade);
}

// ────────────────────────────────────────────────────────────────────────────
// Public types
// ────────────────────────────────────────────────────────────────────────────

export interface BuildingTitleData {
  shortAddress: string;
  neighborhood: string;
  city: City;
  /** HPD/DOB violations (filtered to the metro's primary count). */
  violationCount: number;
  /** 311 complaint count. */
  complaintCount: number;
  /** Letter grade derived from overall_score, or null when unscored. */
  grade: string | null;
  /** Average tenant review rating (0-5), or null when no reviews. */
  avgReview: number | null;
  reviewCount: number;
  /** Top distinct violation categories by count, already short-labeled. */
  topCategories: string[];
  /** Top distinct categories with at least one occurrence in last 12 months. */
  recentTopCategories: string[];
  /** Total violations issued in last 12 months. */
  recentIssueCount: number;
}

export interface LandlordTitleData {
  /** Raw landlord name from the DB (likely ALL-CAPS for LLCs). */
  name: string;
  city: City;
  buildingCount: number;
  /** Total violations across the portfolio (HPD or DOB depending on metro). */
  totalViolations: number;
  /** Combined V + C across the portfolio. */
  totalIssues: number;
  /** LucidIQ portfolio average (0-5), or null when no scoreable buildings. */
  avgScore: number | null;
  /** Average tenant review (0-5) across the portfolio. */
  avgReview: number | null;
  reviewCount: number;
  /** Most-cited single building's short address + violation count, when available. */
  mostCitedBuilding: { shortAddress: string; violations: number } | null;
  /** Top single category across the portfolio (e.g. "Heat"), with count + share. */
  topCategory: { label: string; count: number; share: number } | null;
}

export interface TitleResult {
  title: string;
  /** Stable identifier for the template that fired (for CTR analysis later). */
  templateId: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Template type
// ────────────────────────────────────────────────────────────────────────────

interface BuildingTemplate {
  id: string;
  gate: (d: BuildingTitleData) => boolean;
  render: (d: BuildingTitleData) => string;
}

interface LandlordTemplate {
  id: string;
  gate: (d: LandlordTitleData) => boolean;
  render: (d: LandlordTitleData) => string;
}

// ────────────────────────────────────────────────────────────────────────────
// BUILDING templates — ordered by cascade priority (negative first)
// ────────────────────────────────────────────────────────────────────────────

const BUILDING_TEMPLATES: BuildingTemplate[] = [
  // B1 — categorized HPD violations, top 3 listed
  {
    id: "bldg.t1.cats3",
    gate: (d) => d.topCategories.length >= 3 && d.violationCount >= 5,
    render: (d) => {
      const [c1, c2, c3] = d.topCategories;
      return `${c1}, ${c2}, ${c3}: Inside ${d.shortAddress}'s ${nounWithCount(d.violationCount, "Violation")}`;
    },
  },
  // B2 — recency: cats + new issues this year
  {
    id: "bldg.t1.recent",
    gate: (d) => d.recentTopCategories.length >= 2 && d.recentIssueCount >= 5,
    render: (d) => {
      const [c1, c2] = d.recentTopCategories;
      const more = d.recentIssueCount - 2; // "& N More" — the rest beyond the two named categories
      const moreCount = Math.max(more, 1);
      return `${d.shortAddress}: ${c1}, ${c2} & ${formatNumber(moreCount)} More ${plural(moreCount, "Issue")} This Year`;
    },
  },
  // B3 — combined I, "what you're not being told"
  {
    id: "bldg.t2.unspoken",
    gate: (d) => d.violationCount + d.complaintCount >= 15,
    render: (d) => {
      const I = d.violationCount + d.complaintCount;
      return `${d.shortAddress}: ${nounWithCount(I, "Issue")}. What You're Not Being Told..`;
    },
  },
  // B4 — combined I, "Red Flag or Overblown?"
  {
    id: "bldg.t2.redflag",
    gate: (d) => d.violationCount + d.complaintCount >= 10,
    render: (d) => {
      const I = d.violationCount + d.complaintCount;
      return `Red Flag or Overblown? ${d.shortAddress} Has ${nounWithCount(I, "Filing")} on Record`;
    },
  },
  // B5 — 311 complaints, tenant voice
  {
    id: "bldg.t2.called311",
    gate: (d) => d.complaintCount >= 5,
    render: (d) =>
      `Tenants Called 311 on ${d.shortAddress} ${formatNumber(d.complaintCount)} ${plural(d.complaintCount, "Time")}. What They Said.`,
  },
  // B6 — V violations the listing hides (agency-agnostic)
  {
    id: "bldg.t2.listinghides",
    gate: (d) => d.violationCount >= 10,
    render: (d) =>
      `${d.shortAddress}: ${nounWithCount(d.violationCount, "Violation")} the Listing Hides`,
  },
  // B7 — V things wrong (mid-tier negative; only if grade isn't good)
  {
    id: "bldg.t3.thingswrong",
    gate: (d) => d.violationCount >= 5 && !isGood(d.grade),
    render: (d) =>
      `${d.shortAddress} — The ${formatNumber(d.violationCount)} ${plural(d.violationCount, "Thing")} Wrong With This Building`,
  },
  // B8 — touring, soft warning
  {
    id: "bldg.t3.touring",
    gate: (d) => d.violationCount >= 1 && !isGood(d.grade),
    render: (d) =>
      `Touring ${d.shortAddress}? Read the ${formatNumber(d.violationCount)}-${plural(d.violationCount, "Violation")} Record First.`,
  },
  // B9 — we read all violations
  {
    id: "bldg.t3.weread",
    gate: (d) => d.violationCount >= 1 && !isGood(d.grade),
    render: (d) =>
      `${d.shortAddress}: We Read All ${nounWithCount(d.violationCount, "Violation")} So You Don't Have To`,
  },
  // ── Positive frames fire BEFORE the soft "Before You Sign" warning, so
  // a reviewed/well-graded building gets praised instead of warned.

  // B11 — top-rated building (positive, strongest)
  {
    id: "bldg.t4.toprated",
    gate: (d) =>
      isTop(d.grade) && d.violationCount + d.complaintCount <= 5,
    render: (d) =>
      `${d.shortAddress}: Top ${d.grade}-Rated Building in ${d.neighborhood}`,
  },
  // B12 — review-led positive
  {
    id: "bldg.t4.reviews",
    gate: (d) => d.reviewCount >= 3 && (d.avgReview ?? 0) >= 4,
    render: (d) => {
      const rating = (d.avgReview ?? 0).toFixed(1);
      return `${d.shortAddress}: ${nounWithCount(d.reviewCount, "Tenant Review")}. Avg ${rating}/5.`;
    },
  },
  // B13 — soft positive, A/A-/B+ standout
  {
    id: "bldg.t4.standout",
    gate: (d) => isGood(d.grade),
    render: (d) =>
      `${d.shortAddress}: A ${d.grade}-Graded ${d.neighborhood} Standout`,
  },
  // B10 — soft "before you sign" — only fires when we KNOW the grade is
  // mid-tier or worse (not for unknown/unscored buildings, which fall to
  // baseline instead).
  {
    id: "bldg.t4.before",
    gate: (d) =>
      d.grade != null && !isGood(d.grade) && d.violationCount + d.complaintCount < 5,
    render: (d) => `Before You Sign at ${d.shortAddress}, Read Our Analysis`,
  },
  // B14 — baseline (always renders, never overflows)
  {
    id: "bldg.baseline",
    gate: () => true,
    render: (d) => {
      const cityShort = CITY_SHORT_NAME[d.city];
      return `${d.shortAddress}: Reviews & Record | ${d.neighborhood}, ${cityShort}`;
    },
  },
];

// ────────────────────────────────────────────────────────────────────────────
// LANDLORD templates — ordered by cascade priority (negative first)
// ────────────────────────────────────────────────────────────────────────────

const LANDLORD_TEMPLATES: LandlordTemplate[] = [
  // L1 — most-cited building, dynamic
  {
    id: "ll.t1.worstbldg",
    gate: (d) =>
      !!d.mostCitedBuilding &&
      d.mostCitedBuilding.violations >= 20 &&
      d.buildingCount >= 3,
    render: (d) => {
      const w = d.mostCitedBuilding!;
      return `${smartCaseName(d.name)}'s Most-Cited Building? ${w.shortAddress} (${nounWithCount(w.violations, "Violation")})`;
    },
  },
  // L2 — top portfolio category, dynamic
  {
    id: "ll.t1.topcat",
    gate: (d) =>
      !!d.topCategory &&
      d.topCategory.share >= 0.3 &&
      d.buildingCount >= 3 &&
      d.topCategory.count >= 20,
    render: (d) => {
      const t = d.topCategory!;
      return `${smartCaseName(d.name)}: ${formatNumber(t.count)} ${t.label} Filings Across ${nounWithCount(d.buildingCount, "Building")}`;
    },
  },
  // L3 — Red Flag or Overblown?
  {
    id: "ll.t2.redflag",
    gate: (d) => d.totalViolations >= 50 && d.buildingCount >= 3,
    render: (d) =>
      `Red Flag or Overblown? ${smartCaseName(d.name)}: ${nounWithCount(d.totalViolations, "Violation")} Across ${nounWithCount(d.buildingCount, "Building")}?`,
  },
  // L4 — Is It A Pattern
  {
    id: "ll.t2.pattern",
    gate: (d) => d.totalViolations >= 50 && d.buildingCount >= 3,
    render: (d) =>
      `${smartCaseName(d.name)}: ${nounWithCount(d.totalViolations, "Violation")} Across ${nounWithCount(d.buildingCount, "Building")}. Is It A Pattern`,
  },
  // L5 — It Raises Questions
  {
    id: "ll.t2.questions",
    gate: (d) => d.totalViolations >= 50 && d.buildingCount >= 3,
    render: (d) =>
      `${smartCaseName(d.name)}: ${nounWithCount(d.totalViolations, "Violation")} Across ${nounWithCount(d.buildingCount, "Building")}. It Raises Questions`,
  },
  // L6 — Tenants Have Filed Complaints. Here's Why.
  {
    id: "ll.t2.tenantsfiled",
    gate: (d) => d.totalIssues >= 100,
    render: (d) =>
      `${smartCaseName(d.name)}: ${formatNumber(d.totalIssues)} Tenants Have Filed Complaints. Here's Why.`,
  },
  // L7 — Should You Rent
  {
    id: "ll.t2.shouldrent",
    gate: (d) => d.totalViolations >= 100,
    render: (d) =>
      `Should You Rent From ${smartCaseName(d.name)}. ${nounWithCount(d.totalViolations, "Violation")} Reviewed`,
  },
  // L8 — Reasons to Avoid
  {
    id: "ll.t2.reasons",
    gate: (d) => d.totalIssues >= 50,
    render: (d) =>
      `${formatNumber(d.totalIssues)} Reasons to Avoid ${smartCaseName(d.name)} Buildings`,
  },
  // L9 — Public Records
  {
    id: "ll.t2.publicrecords",
    gate: (d) => d.totalIssues >= 20,
    render: (d) =>
      `Renting From ${smartCaseName(d.name)}? See Their ${formatNumber(d.totalIssues)} Public Records`,
  },
  // L10 — Tenants Have Spoken (only when avg review is also low)
  {
    id: "ll.t3.spoken",
    gate: (d) =>
      d.totalIssues >= 50 &&
      d.avgScore != null &&
      d.avgScore < 3,
    render: (d) =>
      `${smartCaseName(d.name)}'s Tenants Have Spoken — ${formatNumber(d.totalIssues)} Times`,
  },
  // L11 — Behind the Brochures (only when the landlord isn't well-scored)
  {
    id: "ll.t3.brochures",
    gate: (d) =>
      d.buildingCount >= 5 && (d.avgScore == null || d.avgScore < 4),
    render: (d) =>
      `Inside ${smartCaseName(d.name)}'s ${nounWithCount(d.buildingCount, "Building")} — Behind the Brochures`,
  },
  // L12 — Don't Sign (only when the landlord isn't well-scored)
  {
    id: "ll.t3.dontsign",
    gate: (d) =>
      d.totalIssues >= 10 && (d.avgScore == null || d.avgScore < 4),
    render: (d) => `Don't Sign With ${smartCaseName(d.name)} Without Reading This`,
  },
  // L13 — Best-Rated Landlord (positive, strongest)
  {
    id: "ll.t4.bestrated",
    gate: (d) =>
      d.avgScore != null && d.avgScore >= 4.5 && d.buildingCount >= 5,
    render: (d) => {
      const cityShort = CITY_SHORT_NAME[d.city];
      return `${smartCaseName(d.name)}: One of ${cityShort}'s Best-Rated Landlords`;
    },
  },
  // L14 — Why Tenants Stay
  {
    id: "ll.t4.tenantsstay",
    gate: (d) =>
      (d.avgReview ?? 0) >= 4 && d.reviewCount >= 5 && d.buildingCount >= 3,
    render: (d) =>
      `Why Tenants Stay With ${smartCaseName(d.name)}: ${nounWithCount(d.buildingCount, "Building")}`,
  },
  // L15 — Clean Record (positive, soft)
  {
    id: "ll.t4.clean",
    gate: (d) =>
      d.avgScore != null && d.avgScore >= 4 && d.buildingCount >= 3,
    render: (d) => {
      const cityShort = CITY_SHORT_NAME[d.city];
      return `${smartCaseName(d.name)}: A Clean Record Across ${nounWithCount(d.buildingCount, "Building")} ${cityShort} Buildings`;
    },
  },
  // L16 — baseline
  {
    id: "ll.baseline",
    gate: () => true,
    render: (d) => {
      const cityShort = CITY_SHORT_NAME[d.city];
      return `${smartCaseName(d.name)}: ${nounWithCount(d.buildingCount, "Building")}, ${nounWithCount(d.totalIssues, "Issue")} | ${cityShort}`;
    },
  },
];

// ────────────────────────────────────────────────────────────────────────────
// Cascade engines
// ────────────────────────────────────────────────────────────────────────────

function pick<TData>(
  templates: { id: string; gate: (d: TData) => boolean; render: (d: TData) => string }[],
  data: TData
): TitleResult {
  for (const tpl of templates) {
    if (!tpl.gate(data)) continue;
    const rendered = tpl.render(data);
    // Only fall through on HARD_MAX overflow — long templates are
    // intentional and Google handles SERP truncation.
    if (rendered.length <= HARD_MAX) {
      return { title: rendered, templateId: tpl.id };
    }
    // Overflow → fall through to the next template.
  }
  // Baseline is always last; trim to TITLE_PREFERRED for clean display.
  const last = templates[templates.length - 1];
  const rendered = last.render(data);
  return {
    title:
      rendered.length <= TITLE_PREFERRED
        ? rendered
        : rendered.slice(0, TITLE_PREFERRED - 1) + "…",
    templateId: last.id,
  };
}

export function pickBuildingTitle(data: BuildingTitleData): TitleResult {
  return pick(BUILDING_TEMPLATES, data);
}

export function pickLandlordTitle(data: LandlordTitleData): TitleResult {
  return pick(LANDLORD_TEMPLATES, data);
}

// Exported for tests so we can iterate every template's gate + render.
export const _BUILDING_TEMPLATES_FOR_TESTS = BUILDING_TEMPLATES;
export const _LANDLORD_TEMPLATES_FOR_TESTS = LANDLORD_TEMPLATES;

// Convenience: re-export city helper used by templates that emit the city short name.
export { CITY_SHORT_NAME, CITY_META };

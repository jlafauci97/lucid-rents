/**
 * Server-only data fetchers that produce the inputs for the SEO title
 * cascade in seo-titles.ts. Kept separate so the cascade engine itself
 * stays pure (renderable + testable in any runtime).
 *
 * RPC graceful fallback: if a Phase-2 RPC isn't deployed yet, the helper
 * returns the corresponding fields as empty/null and the cascade simply
 * skips the templates that depend on them.
 */

import { createClient } from "@/lib/supabase/server";
import { buildingNeighborhood } from "@/lib/neighborhoods";
import { normalizeScore } from "@/lib/constants";
import type { City } from "@/lib/cities";
import { smartCaseName, type BuildingTitleData, type LandlordTitleData } from "@/lib/seo-titles";
import type { LandlordStats } from "@/lib/landlord-stats";

// Match the page.tsx scoreToGrade helper but local to avoid circular import.
function scoreToGrade(score: number | null): string | null {
  if (score == null) return null;
  const s = normalizeScore(score);
  if (s >= 4.5) return "A";
  if (s >= 4.0) return "A-";
  if (s >= 3.65) return "B+";
  if (s >= 3.3) return "B";
  if (s >= 3.0) return "B-";
  if (s >= 2.65) return "C+";
  if (s >= 2.3) return "C";
  if (s >= 2.0) return "C-";
  if (s >= 1.0) return "D";
  return "F";
}

function shortAddress(b: { full_address: string }): string {
  const street = b.full_address.split(",")[0]?.trim() || b.full_address;
  return smartCaseName(street);
}

/**
 * Categories we don't want to surface in SERP titles, even though they're real.
 *
 *   "Paint"  — peeling paint is by far the most-cited HPD violation type, so
 *              every title would read "Paint, Pests, Mold...". (Lead Paint,
 *              the actual health-risk category, is *not* filtered.)
 *   "Doors"  — usually broken doorknobs / lockboxes; HPD writes a separate
 *              violation per defective door, so it dominates top-3 lists
 *              without scaring any renter.
 *   "Windows" — usually peeling window paint or missing window guards; same
 *              pattern as Doors — administrative volume, not a visceral
 *              signal renters click on.
 *
 * Filtering at the display boundary keeps the underlying counts intact while
 * letting more visceral categories (Pests, Mold, Heat, Lead Paint, Leaks)
 * surface in titles.
 */
const TITLE_CATEGORY_BLOCKLIST = new Set<string>(["Paint", "Doors", "Windows"]);

function filterDisplayCategories(labels: string[]): string[] {
  return labels.filter((label) => !TITLE_CATEGORY_BLOCKLIST.has(label));
}

// ────────────────────────────────────────────────────────────────────────────
// Building title data
// ────────────────────────────────────────────────────────────────────────────

interface BuildingMinimal {
  id: string;
  full_address: string;
  borough: string;
  zip_code: string | null;
  violation_count: number | null;
  dob_violation_count?: number | null;
  complaint_count: number | null;
  review_count: number | null;
  overall_score: number | null;
  /** Per-building average review (0-5), if computed and surfaced. May be null. */
  avg_review?: number | null;
}

export async function getBuildingTitleData(
  building: BuildingMinimal,
  city: City
): Promise<BuildingTitleData> {
  const supabase = await createClient();
  const isAltMetro = city === "chicago" || city === "miami" || city === "houston";
  const violationCount = isAltMetro
    ? (building.dob_violation_count ?? 0)
    : (building.violation_count ?? 0);
  const complaintCount = building.complaint_count ?? 0;

  const { name: neighborhood } = buildingNeighborhood(
    { zip_code: building.zip_code, borough: building.borough },
    city
  );

  // Phase 2 RPC — graceful fallback to empty arrays.
  let topCategories: string[] = [];
  let recentTopCategories: string[] = [];
  let recentIssueCount = 0;
  try {
    const { data: cats, error } = await supabase.rpc("building_top_categories", {
      _building_id: building.id,
    });
    if (!error && Array.isArray(cats)) {
      const rows = cats as Array<{
        category_label: string;
        total_count: number;
        recent_count: number;
      }>;
      topCategories = filterDisplayCategories(
        rows
          .filter((r) => r.total_count > 0)
          .map((r) => r.category_label)
      ).slice(0, 5);
      const recentRows = rows
        .filter((r) => r.recent_count > 0)
        .sort((a, b) => b.recent_count - a.recent_count);
      recentTopCategories = filterDisplayCategories(
        recentRows.map((r) => r.category_label)
      ).slice(0, 3);
      // recentIssueCount tracks the SUM across all categories (including ones
      // we don't surface in the title) — so the "& N more issues" number stays
      // honest about how many recent issues are on file.
      recentIssueCount = recentRows.reduce((sum, r) => sum + r.recent_count, 0);
    }
  } catch {
    // RPC not deployed yet — cascade will fall through past B1/B2.
  }

  return {
    shortAddress: shortAddress(building),
    neighborhood,
    city,
    violationCount,
    complaintCount,
    grade: scoreToGrade(building.overall_score),
    avgReview: building.avg_review ?? null,
    reviewCount: building.review_count ?? 0,
    topCategories,
    recentTopCategories,
    recentIssueCount,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Landlord title data
// ────────────────────────────────────────────────────────────────────────────

export async function getLandlordTitleData(
  stats: LandlordStats,
  city: City,
  /** Optional: pass the already-loaded tenantVoice so we don't re-fetch. */
  tenantVoice?: { avgRating: number; totalReviews: number }
): Promise<LandlordTitleData> {
  const supabase = await createClient();

  // Phase 2 RPC — graceful fallback.
  let topCategory: LandlordTitleData["topCategory"] = null;
  try {
    const { data, error } = await supabase.rpc("landlord_top_category", {
      _slug: stats.slug,
      _metro: city,
    });
    if (!error && Array.isArray(data) && data.length > 0) {
      // RPC returns top 5 categories ordered by count; pick the first one
      // that isn't in our display blocklist (so we skip "Paint" and surface
      // the next-most-common category instead).
      const rows = data as Array<{
        category_label: string;
        category_count: number;
        total_violations: number;
        share: number | string;
      }>;
      const row = rows.find((r) => !TITLE_CATEGORY_BLOCKLIST.has(r.category_label));
      if (row) {
        topCategory = {
          label: row.category_label,
          count: Number(row.category_count) || 0,
          share: Number(row.share) || 0,
        };
      }
    }
  } catch {
    // RPC not deployed — cascade will skip L2.
  }

  const mostCitedBuilding =
    stats.worstBuildingAddress && stats.worstBuildingViolations != null
      ? {
          shortAddress: smartCaseName(
            stats.worstBuildingAddress.split(",")[0]?.trim() || stats.worstBuildingAddress
          ),
          violations: stats.worstBuildingViolations,
        }
      : null;

  return {
    name: stats.name,
    city,
    buildingCount: stats.buildingCount,
    totalViolations: stats.totalViolations,
    totalIssues: stats.totalIssues,
    avgScore: stats.avgScore,
    avgReview: tenantVoice?.avgRating ?? null,
    reviewCount: tenantVoice?.totalReviews ?? 0,
    mostCitedBuilding,
    topCategory,
  };
}

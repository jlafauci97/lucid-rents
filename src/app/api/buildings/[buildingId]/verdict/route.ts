import { NextRequest, NextResponse } from "next/server";
import { createCacheClient } from "@/lib/supabase/cache-client";
import { checkRateLimit } from "@/lib/rate-limit";
import { getLetterGrade, normalizeScore } from "@/lib/constants";
import { verdictScore, verdictSummary } from "@/lib/building/verdict";
import { buildingUrl, canonicalUrl } from "@/lib/seo";
import { VALID_CITIES, type City } from "@/lib/cities";

const CACHE_CONTROL = "public, s-maxage=3600, stale-while-revalidate=86400";

interface BuildingRow {
  id: string;
  name: string | null;
  full_address: string;
  metro: string | null;
  borough: string;
  slug: string;
  overall_score: number | null;
  review_count: number | null;
  violation_count: number | null;
  complaint_count: number | null;
  is_rent_stabilized: boolean | null;
  year_built: number | null;
  total_units: number | null;
}

/**
 * GET /api/buildings/[buildingId]/verdict
 *
 * Public, no-auth JSON answer to "should I rent in this building?" —
 * letter grade, score, review/violation counts, and a one-sentence verdict.
 * Uses the same grade thresholds and verdict wording as the building page.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ buildingId: string }> }
) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "anonymous";
  const rl = await checkRateLimit(`verdict:${ip}`);
  if (rl.limited) return rl.response;

  const { buildingId } = await params;
  const supabase = createCacheClient();

  const { data } = await supabase
    .from("buildings")
    .select(
      "id, name, full_address, metro, borough, slug, overall_score, review_count, violation_count, complaint_count, is_rent_stabilized, year_built, total_units"
    )
    .eq("id", buildingId)
    .single();

  if (!data) {
    return NextResponse.json({ error: "Building not found" }, { status: 404 });
  }
  const building = data as BuildingRow;

  // Average published-review rating (same source the building page uses).
  const { data: reviewRows } = await supabase
    .from("reviews")
    .select("overall_rating")
    .eq("building_id", building.id)
    .eq("status", "published");
  const ratings = ((reviewRows ?? []) as Array<{ overall_rating: number | null }>)
    .map((r) => r.overall_rating)
    .filter((n): n is number => typeof n === "number");
  const avgRating = ratings.length
    ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
    : null;

  const city = (VALID_CITIES.includes(building.metro as City) ? building.metro : "nyc") as City;
  const score = verdictScore(
    building.overall_score,
    building.violation_count ?? 0,
    building.complaint_count ?? 0
  );

  return NextResponse.json(
    {
      id: building.id,
      name: building.name,
      address: building.full_address,
      city,
      borough: building.borough,
      slug: building.slug,
      url: canonicalUrl(buildingUrl(building, city)),
      grade: getLetterGrade(score),
      score: normalizeScore(score),
      review_count: building.review_count ?? 0,
      avg_rating: avgRating,
      violation_count: building.violation_count ?? 0,
      complaint_count: building.complaint_count ?? 0,
      is_rent_stabilized: building.is_rent_stabilized ?? false,
      year_built: building.year_built,
      total_units: building.total_units,
      verdict: verdictSummary(score),
    },
    { headers: { "Cache-Control": CACHE_CONTROL } }
  );
}

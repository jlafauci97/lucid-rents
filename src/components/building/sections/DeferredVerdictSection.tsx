import { createCacheClient } from "@/lib/supabase/cache-client";
import { VerdictBanner } from "@/components/building/VerdictBanner";
import { ReportCard } from "@/components/building/ReportCard";
import { getLetterGrade, deriveScore } from "@/lib/constants";
import type { Building, ReviewWithDetails } from "@/types";

const safe = <T,>(promise: PromiseLike<{ data: T | null; error: unknown }>, fallback: T): Promise<T> =>
  Promise.resolve(promise).then(({ data, error }) => {
    if (error) console.error("Supabase query error:", error);
    return data ?? fallback;
  }).catch((err: unknown) => {
    console.error("Supabase query exception:", err);
    return fallback;
  });

interface Props {
  building: Building;
  buildingId: string;
}

export async function DeferredVerdictSection({ building, buildingId }: Props) {
  const supabase = createCacheClient();

  const reviews = await safe(
    supabase
      .from("reviews")
      .select(`*, profile:profiles(id, display_name, avatar_url), category_ratings:review_category_ratings(*, category:review_categories(slug, name, icon)), unit:units(unit_number)`)
      .eq("building_id", buildingId)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(10),
    [],
  ) as ReviewWithDetails[];

  const recommendPct = reviews.length > 0
    ? Math.round((reviews.filter(r => (r.overall_rating ?? 0) >= 3).length / reviews.length) * 100)
    : 0;

  const dateFmt = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  const reviewsWithBody = reviews.filter(r => r.body && r.body.trim().length > 0);
  const sorted = [...reviewsWithBody].sort((a, b) => (b.overall_rating ?? 0) - (a.overall_rating ?? 0));

  const bestPositiveReview = sorted.length > 0 ? sorted[0] : null;
  const bestCriticalReview = sorted.length > 1 ? sorted[sorted.length - 1] : null;

  const bestPositive = bestPositiveReview
    ? { text: bestPositiveReview.body!.slice(0, 150), author: bestPositiveReview.profile?.display_name || "Anonymous", date: dateFmt(bestPositiveReview.created_at) }
    : null;
  const bestCritical = bestCriticalReview
    ? { text: bestCriticalReview.body!.slice(0, 150), author: bestCriticalReview.profile?.display_name || "Anonymous", date: dateFmt(bestCriticalReview.created_at) }
    : null;

  // Report card
  const categoryScores = new Map<string, { total: number; count: number; name: string }>();
  for (const review of reviews) {
    for (const cr of review.category_ratings || []) {
      const slug = cr.category?.slug || "unknown";
      const name = cr.category?.name || slug;
      const existing = categoryScores.get(slug) || { total: 0, count: 0, name };
      existing.total += cr.rating;
      existing.count += 1;
      categoryScores.set(slug, existing);
    }
  }
  const gradeDimensions = [...categoryScores.entries()]
    .map(([, { total, count, name }]) => {
      const avg = total / count;
      const grade = getLetterGrade(avg);
      return { label: name, grade, score: Math.round(avg * 10) / 10 };
    })
    .sort((a, b) => b.score - a.score);

  const rcOverallScore = building.overall_score ?? deriveScore(building.violation_count || 0, building.complaint_count || 0);
  const rcOverallGrade = getLetterGrade(rcOverallScore);
  const summaryText = rcOverallScore >= 4 ? "Excellent building — top-rated by tenants with minimal issues."
    : rcOverallScore >= 3 ? "Good building with responsive management and moderate concerns."
    : rcOverallScore >= 2 ? "Decent building but has room for improvement in some areas."
    : rcOverallScore >= 1 ? "Below average — tenants report significant concerns."
    : "Poor conditions — multiple serious issues reported by tenants.";

  return (
    <>
      <VerdictBanner
        recommendPct={recommendPct}
        reviewCount={reviews.length}
        bestPositive={bestPositive}
        bestCritical={bestCritical}
      />
      <ReportCard
        overallGrade={rcOverallGrade}
        overallScore={rcOverallScore}
        summary={summaryText}
        grades={gradeDimensions}
      />
    </>
  );
}

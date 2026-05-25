import { createCacheClient } from "@/lib/supabase/cache-client";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ReviewSection } from "@/components/review/ReviewSection";
import { SaveButton } from "@/components/building/SaveButton";
import { ShareButton } from "@/components/building/ShareButton";
import { canonicalUrl, buildingUrl } from "@/lib/seo";
import type { City } from "@/lib/cities";
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
  city: City;
}

export async function DeferredReviewsSection({ building, buildingId, city }: Props) {
  // Anonymous cache client only — keeps this section ISR-cacheable. Saved/monitored
  // initial state is fetched client-side by SaveButton/MonitorButton themselves.
  const supabase = createCacheClient();

  const reviews = (await safe(
    supabase
      .from("reviews")
      .select(`*, profile:profiles(id, display_name, avatar_url), category_ratings:review_category_ratings(*, category:review_categories(slug, name, icon)), unit:units(unit_number)`)
      .eq("building_id", buildingId)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(5),
    [],
  )) as ReviewWithDetails[];

  const shortAddress = building.full_address.split(",")[0]?.trim() || building.full_address;
  const href = buildingUrl(building, city);

  return (
    <>
      <ReviewSection
        reviews={reviews}
        buildingId={buildingId}
        cityPath={`/${city}`}
        headerActions={
          <>
            <SaveButton buildingId={buildingId} />
            <ShareButton address={shortAddress} url={canonicalUrl(href)} />
          </>
        }
      />
      {building.review_count > reviews.length && (
        <div className="mt-4 text-center">
          <Link
            href={`${href}/reviews`}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#3B82F6] hover:text-[#1d4ed8] transition-colors"
          >
            See all {building.review_count.toLocaleString()} reviews
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </>
  );
}

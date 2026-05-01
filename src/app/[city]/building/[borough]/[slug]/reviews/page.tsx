import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ReviewSection } from "@/components/review/ReviewSection";
import { SaveButton } from "@/components/building/SaveButton";
import { ShareButton } from "@/components/building/ShareButton";
import { regionFromSlug, buildingUrl, canonicalUrl } from "@/lib/seo";
import { CITY_META, VALID_CITIES, type City } from "@/lib/cities";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { cache } from "react";
import type { Building, ReviewWithDetails } from "@/types";
import type { Metadata } from "next";

export const revalidate = 3600; // 1h ISR — review pages are SEO-traffic dominated

const PAGE_SIZE = 10;

interface ReviewsPageProps {
  params: Promise<{ city: string; borough: string; slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

const getBuilding = cache(async (boroughSlug: string, slug: string, metro?: string) => {
  const city = (metro || "nyc") as City;
  const borough = regionFromSlug(boroughSlug, city);

  const supabase = await createClient();
  let query = supabase
    .from("buildings")
    .select("*")
    .eq("slug", slug)
    .ilike("borough", borough);

  if (metro) {
    query = query.eq("metro", metro);
  }

  const { data } = await query.limit(1);

  if (!data || data.length === 0) return null;
  return data[0] as Building;
});

function metroToCity(metro: string | null): City {
  if (metro && VALID_CITIES.includes(metro as City)) return metro as City;
  return "nyc";
}

export async function generateMetadata({
  params,
}: ReviewsPageProps): Promise<Metadata> {
  const { city: cityParam, borough, slug } = await params;
  const building = await getBuilding(borough, slug, cityParam);

  if (!building) {
    return { title: "Building Not Found" };
  }

  const city = metroToCity(building.metro);
  const shortAddress = building.full_address.split(",")[0]?.trim() || building.full_address;
  const title = `Tenant Reviews for ${shortAddress}`;
  const description = `Read all ${building.review_count || 0} tenant reviews for ${building.full_address}. Sort by most recent, highest rated, lowest rated, or most helpful.`;
  const url = canonicalUrl(`${buildingUrl(building, city)}/reviews`);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "Lucid Rents",
      type: "article",
      locale: "en_US",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

const safe = <T,>(promise: PromiseLike<{ data: T | null; error: unknown }>, fallback: T): Promise<T> =>
  Promise.resolve(promise).then(({ data, error }) => {
    if (error) console.error("Supabase query error:", error);
    return data ?? fallback;
  }).catch((err: unknown) => {
    console.error("Supabase query exception:", err);
    return fallback;
  });

export default async function BuildingReviewsPage({ params, searchParams }: ReviewsPageProps) {
  const { city: cityParam, borough, slug } = await params;
  const { page: pageParam } = await searchParams;
  const currentPage = Math.max(1, parseInt(pageParam || "1", 10));
  const offset = (currentPage - 1) * PAGE_SIZE;

  const building = await getBuilding(borough, slug, cityParam);

  if (!building) notFound();

  const city = metroToCity(building.metro);
  const cityMeta = CITY_META[city];
  const supabase = await createClient();

  const totalReviews = building.review_count || 0;
  const totalPages = Math.ceil(totalReviews / PAGE_SIZE);

  const [reviews, authStatus] = await Promise.all([
    safe(
      supabase
        .from("reviews")
        .select(`*, profile:profiles(id, display_name, avatar_url), category_ratings:review_category_ratings(*, category:review_categories(slug, name, icon)), unit:units(unit_number)`)
        .eq("building_id", building.id)
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1),
      [],
    ) as Promise<ReviewWithDetails[]>,
    (async (): Promise<{ monitored: boolean; saved: boolean }> => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { monitored: false, saved: false };
        const [monitorRes, saveRes] = await Promise.all([
          supabase.from("monitored_buildings").select("id").eq("user_id", user.id).eq("building_id", building.id).single(),
          supabase.from("saved_buildings").select("id").eq("user_id", user.id).eq("building_id", building.id).single(),
        ]);
        return { monitored: !!monitorRes.data, saved: !!saveRes.data };
      } catch {
        return { monitored: false, saved: false };
      }
    })(),
  ]);

  const shortAddress = building.full_address.split(",")[0]?.trim() || building.full_address;
  const bUrl = buildingUrl(building, city);
  const reviewsBase = `${bUrl}/reviews`;

  const breadcrumbs = [
    { label: cityMeta?.name || "NYC", href: `/${city}` },
    { label: shortAddress, href: bUrl },
    { label: "Reviews", href: reviewsBase },
  ];

  return (
    <main className="min-h-screen bg-[#FAFBFD]">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Breadcrumbs items={breadcrumbs} />

        <Link
          href={bUrl}
          className="inline-flex items-center gap-1.5 text-sm text-[#64748B] hover:text-[#1E293B] transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to building
        </Link>

        <h1 className="text-2xl font-bold text-[#1E293B] mb-1">
          Tenant Reviews for {shortAddress}
        </h1>
        <p className="text-sm text-[#64748B] mb-8">
          Showing {offset + 1}&ndash;{Math.min(offset + PAGE_SIZE, totalReviews)} of {totalReviews.toLocaleString()} review{totalReviews !== 1 ? "s" : ""}
          {currentPage > 1 && ` \u00b7 Page ${currentPage}`}
        </p>

        <ReviewSection
          reviews={reviews}
          buildingId={building.id}
          isMonitored={authStatus.monitored}
          cityPath={`/${city}`}
          headerActions={
            <>
              <SaveButton buildingId={building.id} initialSaved={authStatus.saved} />
              <ShareButton address={shortAddress} url={canonicalUrl(reviewsBase)} />
            </>
          }
        />

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-[#e2e8f0]">
            <span className="text-xs text-[#64748b]">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              {currentPage > 1 ? (
                <Link
                  href={`${reviewsBase}?page=${currentPage - 1}`}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#e2e8f0] text-[#334155] hover:bg-[#f8fafc] transition-colors"
                >
                  <ChevronLeft className="w-3 h-3" /> Previous
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#e2e8f0] text-[#334155] opacity-40 cursor-not-allowed">
                  <ChevronLeft className="w-3 h-3" /> Previous
                </span>
              )}
              {currentPage < totalPages ? (
                <Link
                  href={`${reviewsBase}?page=${currentPage + 1}`}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#e2e8f0] text-[#334155] hover:bg-[#f8fafc] transition-colors"
                >
                  Next <ChevronRight className="w-3 h-3" />
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#e2e8f0] text-[#334155] opacity-40 cursor-not-allowed">
                  Next <ChevronRight className="w-3 h-3" />
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

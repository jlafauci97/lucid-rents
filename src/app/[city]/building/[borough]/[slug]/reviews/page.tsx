import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createCacheClient } from "@/lib/supabase/cache-client";
import { regionFromSlug, boroughIlikePattern, buildingUrl, canonicalUrl } from "@/lib/seo";
import { CITY_META, VALID_CITIES, type City } from "@/lib/cities";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { cache } from "react";
import type { Building } from "@/types";
import type { Metadata } from "next";
import { ReviewsClient } from "./ReviewsClient";

export const revalidate = 3600; // 1h ISR — review pages are SEO-traffic dominated

// Enable on-demand ISR for unbounded dynamic params (city × borough × slug).
// Without this Next.js 16 treats the route as fully dynamic and ignores
// `revalidate` — first hit per URL renders, then caches at the edge.
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

interface ReviewsPageProps {
  params: Promise<{ city: string; borough: string; slug: string }>;
}

const getBuilding = cache(async (boroughSlug: string, slug: string, metro?: string) => {
  const city = (metro || "nyc") as City;
  const borough = regionFromSlug(boroughSlug, city);

  const supabase = createCacheClient();
  let query = supabase
    .from("buildings")
    .select("*")
    .eq("slug", slug)
    .ilike("borough", boroughIlikePattern(borough));

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

export default async function BuildingReviewsPage({ params }: ReviewsPageProps) {
  const { city: cityParam, borough, slug } = await params;

  const building = await getBuilding(borough, slug, cityParam);

  if (!building) notFound();

  const city = metroToCity(building.metro);
  const cityMeta = CITY_META[city];

  const totalReviewsFallback = building.review_count || 0;
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

        {/* Paginated reviews + pagination UI lives in a client island so the
            parent page becomes static per (city, borough, slug). The
            /api/buildings/[id]/reviews endpoint it hits is edge-runtime and
            CDN-cached via next.config.ts headers. */}
        <ReviewsClient
          buildingId={building.id}
          city={city}
          shortAddress={shortAddress}
          reviewsBase={reviewsBase}
          totalReviewsFallback={totalReviewsFallback}
        />
      </div>
    </main>
  );
}

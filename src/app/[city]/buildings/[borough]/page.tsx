import { notFound } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BuildingCard } from "@/components/search/BuildingCard";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { SLUG_TO_BOROUGH, canonicalUrl, buildingUrl, cityPath } from "@/lib/seo";
import { AdSidebar } from "@/components/ui/AdSidebar";
import { AdBlock } from "@/components/ui/AdBlock";
import { BoroughExploreLinks } from "@/components/seo/BoroughExploreLinks";
import type { Building } from "@/types";
import type { Metadata } from "next";

export const revalidate = 3600;

interface BoroughPageProps {
  params: Promise<{ city: string; borough: string }>;
  searchParams: Promise<{ page?: string; sort?: string }>;
}

// Allow any borough/region slug — don't restrict with generateStaticParams
export const dynamicParams = true;

export async function generateMetadata({
  params,
}: BoroughPageProps): Promise<Metadata> {
  const { city, borough: boroughSlug } = await params;
  const borough = SLUG_TO_BOROUGH[boroughSlug];
  if (!borough) return { title: "Not Found" };

  const title = `${borough} Buildings | Lucid Rents`;
  const description = `Apartment hunting in ${borough}? Browse every building with violation scores, complaint history, and real tenant reviews.`;
  const url = canonicalUrl(cityPath(`/buildings/${boroughSlug}`, city as import("@/lib/cities").City));

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "Lucid Rents",
      type: "website",
    },
  };
}

const PAGE_SIZE = 25;

export default async function BoroughPage({ params, searchParams }: BoroughPageProps) {
  const { city: cityParam, borough: boroughSlug } = await params;
  const { page: pageStr, sort } = await searchParams;
  const borough = SLUG_TO_BOROUGH[boroughSlug];
  if (!borough) notFound();

  const page = Math.max(1, parseInt(pageStr || "1"));
  const offset = (page - 1) * PAGE_SIZE;
  const sortColumn = sort === "score" ? "overall_score" : "violation_count";
  const ascending = sort === "score";

  let total = 0;
  let buildingList: Building[] = [];

  try {
    const supabase = await createClient();

    // Get total count and paginated buildings in parallel
    const [countRes, buildingsRes] = await Promise.all([
      supabase
        .from("buildings")
        .select("id", { count: "exact", head: true })
        .eq("borough", borough)
        .eq("metro", cityParam),
      supabase
        .from("buildings")
        .select("*")
        .eq("borough", borough)
        .eq("metro", cityParam)
        .order(sortColumn, { ascending, nullsFirst: false })
        .range(offset, offset + PAGE_SIZE - 1),
    ]);

    total = countRes.count || 0;
    buildingList = (buildingsRes.data || []) as Building[];
  } catch (err) {
    console.error("BoroughPage query error:", err);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${borough} Buildings`,
    numberOfItems: total,
    itemListElement: buildingList.map((b, i) => ({
      "@type": "ListItem",
      position: offset + i + 1,
      name: b.full_address,
      url: canonicalUrl(buildingUrl(b, cityParam as import("@/lib/cities").City)),
    })),
  };

  return (
    <AdSidebar>
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <JsonLd data={jsonLd} />
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Buildings", href: cityPath("/buildings", cityParam as import("@/lib/cities").City) },
          { label: borough, href: cityPath(`/buildings/${boroughSlug}`, cityParam as import("@/lib/cities").City) },
        ]}
      />

      <h1 className="text-3xl font-bold text-[#0F1D2E] mt-6 mb-2">
        {borough} Buildings
      </h1>
      <p className="text-[#64748b] mb-6">
        {total.toLocaleString()} buildings in {borough}
      </p>

      {/* Sort controls */}
      <div className="flex gap-2 mb-6">
        <Link
          href={cityPath(`/buildings/${boroughSlug}?sort=violations`, cityParam as import("@/lib/cities").City)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            sort !== "score"
              ? "bg-[#3B82F6] text-white"
              : "bg-gray-100 text-[#64748b] hover:bg-gray-200"
          }`}
        >
          Most Violations
        </Link>
        <Link
          href={cityPath(`/buildings/${boroughSlug}?sort=score`, cityParam as import("@/lib/cities").City)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            sort === "score"
              ? "bg-[#3B82F6] text-white"
              : "bg-gray-100 text-[#64748b] hover:bg-gray-200"
          }`}
        >
          Best Score
        </Link>
      </div>

      <div className="space-y-3">
        {buildingList.map((building) => (
          <BuildingCard key={building.id} building={building} />
        ))}
      </div>

      <AdBlock adSlot="BOROUGH_BOTTOM" adFormat="horizontal" />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-8">
          {page > 1 && (
            <Link
              href={cityPath(`/buildings/${boroughSlug}?page=${page - 1}${sort ? `&sort=${sort}` : ""}`, cityParam as import("@/lib/cities").City)}
              className="px-4 py-2 rounded-lg bg-gray-100 text-sm font-medium text-[#0F1D2E] hover:bg-gray-200 transition-colors"
            >
              Previous
            </Link>
          )}
          <span className="px-4 py-2 text-sm text-[#64748b]">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={cityPath(`/buildings/${boroughSlug}?page=${page + 1}${sort ? `&sort=${sort}` : ""}`, cityParam as import("@/lib/cities").City)}
              className="px-4 py-2 rounded-lg bg-gray-100 text-sm font-medium text-[#0F1D2E] hover:bg-gray-200 transition-colors"
            >
              Next
            </Link>
          )}
        </div>
      )}
      {/* Cross-links: neighborhoods, landlords, explore */}
      <Suspense fallback={null}>
        <BoroughExploreLinks borough={borough} boroughSlug={boroughSlug} />
      </Suspense>
    </div>
    </AdSidebar>
  );
}

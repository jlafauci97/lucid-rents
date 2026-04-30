import { Metadata } from "next";
import { Suspense } from "react";
import { MapPin } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { canonicalUrl, cityPath, neighborhoodsUrl, breadcrumbJsonLd } from "@/lib/seo";
import { CITY_META, type City } from "@/lib/cities";
import { NeighborhoodsBody } from "./NeighborhoodsBody";
import { NeighborhoodsBodySkeleton } from "./NeighborhoodsBodySkeleton";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>;
}): Promise<Metadata> {
  const { city } = await params;
  const meta = CITY_META[city as City];
  if (!meta) return {};
  const url = canonicalUrl(neighborhoodsUrl(city as City));
  return {
    title: `${meta.name} Neighborhoods — Grades, Safety & Rent Data`,
    description: `Explore every ${meta.name} neighborhood with building grades, safety scores, and rent data. Compare neighborhoods side by side to find your ideal area.`,
    alternates: { canonical: url },
    openGraph: {
      title: `${meta.name} Neighborhoods — Grades, Safety & Rent Data`,
      description: `Explore every ${meta.name} neighborhood with building grades, safety scores, and rent data.`,
      url,
      siteName: "Lucid Rents",
      type: "website",
      locale: "en_US",
    },
  };
}

export default async function NeighborhoodsPage({
  params,
  searchParams,
}: {
  params: Promise<{ city: string }>;
  searchParams: Promise<{ region?: string }>;
}) {
  const { city: cityParam } = await params;
  const { region: regionSlug } = await searchParams;
  const city = cityParam as City;
  const meta = CITY_META[city];
  if (!meta) return null;

  const breadcrumbs = [
    { label: "Home", href: "/" },
    { label: meta.name, href: cityPath("", city) },
    { label: "Neighborhoods", href: cityPath("/neighborhoods", city) },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <JsonLd data={breadcrumbJsonLd([
        { name: "Home", url: "/" },
        { name: meta.name, url: cityPath("", city) },
        { name: "Neighborhoods", url: neighborhoodsUrl(city) },
      ])} />
      <Breadcrumbs items={breadcrumbs} />

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-[#3B82F6] flex items-center justify-center">
          <MapPin className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0F1D2E]">
            {meta.name} Neighborhoods
          </h1>
          <p className="text-[#64748b] text-sm mt-0.5">
            Grades, safety scores & rent data for every neighborhood
          </p>
        </div>
      </div>

      {/* Data-bound body — streamed via Suspense so the breadcrumbs + header paint first. */}
      <Suspense fallback={<NeighborhoodsBodySkeleton />}>
        <NeighborhoodsBody city={city} initialRegionSlug={regionSlug} />
      </Suspense>
    </div>
  );
}

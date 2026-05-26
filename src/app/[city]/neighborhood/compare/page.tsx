import { ArrowLeftRight } from "lucide-react";
import { canonicalUrl, cityPath } from "@/lib/seo";
import { isValidCity, VALID_CITIES, CITY_META, type City } from "@/lib/cities";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { AdSidebar } from "@/components/ui/AdSidebar";
import { NeighborhoodCompareClient } from "./NeighborhoodCompareClient";
import type { Metadata } from "next";

export const revalidate = 86400; // 24h ISR — page is a static shell

export function generateStaticParams() {
  return VALID_CITIES.map((city) => ({ city }));
}

interface PageProps {
  params: Promise<{ city: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { city: cityParam } = await params;
  const city = isValidCity(cityParam) ? cityParam : "nyc";
  const cityName = CITY_META[city].fullName;
  return {
    title: `Compare ${cityName} Neighborhoods Side by Side`,
    description: `Compare ${cityName} neighborhoods on building quality, violations, crime, rents, and more. Pick the best area for your next apartment.`,
    alternates: {
      canonical: canonicalUrl(cityPath("/neighborhood/compare", city)),
    },
    openGraph: {
      title: `Compare ${cityName} Neighborhoods`,
      description: `Compare ${cityName} neighborhoods side by side — safety, building quality, violations, rents, and more.`,
      url: canonicalUrl(cityPath("/neighborhood/compare", city)),
      siteName: "Lucid Rents",
      type: "website",
    },
  };
}

export default async function NeighborhoodComparePage({ params }: PageProps) {
  const { city: cityParam } = await params;
  const city = (isValidCity(cityParam) ? cityParam : "nyc") as City;
  const cityName = CITY_META[city].name;

  return (
    <AdSidebar>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: cityName, href: cityPath("", city) },
            { label: "Neighborhoods", href: cityPath("/crime", city) },
            { label: "Compare", href: cityPath("/neighborhood/compare", city) },
          ]}
        />

        <div className="mb-8 mt-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-50 rounded-lg">
              <ArrowLeftRight className="w-6 h-6 text-[#3B82F6]" />
            </div>
            <h1 className="text-2xl font-bold text-[#0F1D2E]">
              Compare {cityName} Neighborhoods
            </h1>
          </div>
          <p className="text-[#64748b] text-sm ml-[52px]">
            Compare up to 3 neighborhoods side by side on building quality,
            violations, crime, median rents, and more.
          </p>
        </div>

        {/* Comparison UI lives in a client island so this page can be
            statically prerendered. The ?zips=... param is read client-side. */}
        <NeighborhoodCompareClient city={city} />
      </div>
    </AdSidebar>
  );
}

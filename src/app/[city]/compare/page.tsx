import { AdSidebar } from "@/components/ui/AdSidebar";
import { ArrowLeftRight } from "lucide-react";
import { canonicalUrl, cityPath, cityBreadcrumbs } from "@/lib/seo";
import { isValidCity, VALID_CITIES, CITY_META, type City } from "@/lib/cities";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { CompareClient } from "./CompareClient";
import type { Metadata } from "next";

export const revalidate = 86400; // 24h ISR — page is a static shell now

export function generateStaticParams() {
  return VALID_CITIES.map((city) => ({ city }));
}

interface ComparePageProps {
  params: Promise<{ city: string }>;
}

export async function generateMetadata({ params }: ComparePageProps): Promise<Metadata> {
  const { city: cityParam } = await params;
  const cityName = isValidCity(cityParam) ? CITY_META[cityParam].fullName : "NYC";
  return {
    title: `${cityName} Apartment Comparison Tool`,
    description: `Compare ${cityName} apartments side by side — violations, scores, rent trends, reviews, and more. Make smarter rental decisions with real data.`,
    alternates: { canonical: canonicalUrl(cityPath("/compare", isValidCity(cityParam) ? cityParam : undefined)) },
    openGraph: {
      title: `${cityName} Apartment Comparison Tool`,
      description: `Compare ${cityName} apartments side by side — violations, scores, rent trends, and reviews. Make smarter rental decisions.`,
      url: canonicalUrl(cityPath("/compare", isValidCity(cityParam) ? cityParam : undefined)),
      siteName: "Lucid Rents",
      type: "website",
    },
  };
}

export default async function ComparePage({ params }: ComparePageProps) {
  const { city: cityParam } = await params;
  const cityName = isValidCity(cityParam) ? CITY_META[cityParam].name : "NYC";

  return (
    <AdSidebar>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Breadcrumbs items={cityBreadcrumbs(cityParam as City, { label: "Compare Buildings", href: cityPath("/compare", cityParam as City) })} />

        {/* Header */}
        <div className="mb-8 mt-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-50 rounded-lg">
              <ArrowLeftRight className="w-6 h-6 text-[#3B82F6]" />
            </div>
            <h1 className="text-2xl font-bold text-[#0F1D2E]">
              {cityName} Apartment Comparison
            </h1>
          </div>
          <p className="text-[#64748b] text-sm ml-[52px]">
            Compare up to 3 {cityName} apartments side by side on violations, scores, reviews, rent trends, and more — so you can rent with confidence.
          </p>
        </div>

        {/* Comparison UI lives in a client island so this page can be
            statically prerendered. The ?ids=... param is read by
            CompareClient via useSearchParams + the supabase browser client. */}
        <CompareClient />
      </div>
    </AdSidebar>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { FileText } from "lucide-react";
import { canonicalUrl, cityPath } from "@/lib/seo";
import { isValidCity, CITY_META, type City } from "@/lib/cities";
import { notFound } from "next/navigation";
import { AdSidebar } from "@/components/ui/AdSidebar";
import { AdBlock } from "@/components/ui/AdBlock";
import { ProposalFilters } from "@/components/proposals/ProposalFilters";
import { ProposalList } from "@/components/proposals/ProposalList";
import { ProposalMap } from "@/components/proposals/ProposalMap";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>;
}): Promise<Metadata> {
  const { city } = await params;
  if (!isValidCity(city)) return {};
  const meta = CITY_META[city];
  return {
    title: `Proposals & Land Use | ${meta.fullName} | Lucid Rents`,
    description: `Track city council legislation and land use applications in ${meta.fullName}. See zoning changes, rent regulations, tenant protections, and development proposals under review.`,
    alternates: { canonical: canonicalUrl(cityPath("/proposals", city)) },
    openGraph: {
      title: `${meta.fullName} Proposals & Land Use Under Review`,
      description: `Track proposals affecting tenants in ${meta.fullName} — legislation, zoning changes, and development applications.`,
      url: canonicalUrl(cityPath("/proposals", city)),
      siteName: "Lucid Rents",
      type: "website",
      locale: "en_US",
    },
  };
}

export const revalidate = 3600;

async function getProposals(city: string, searchParams: Record<string, string>) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const filters: string[] = [`metro=eq.${city}`];
  if (searchParams.borough) filters.push(`borough=eq.${searchParams.borough}`);
  if (searchParams.district) filters.push(`council_district=eq.${searchParams.district}`);
  if (searchParams.category) filters.push(`category=eq.${searchParams.category}`);
  if (searchParams.status) filters.push(`status=eq.${searchParams.status}`);
  if (searchParams.type && searchParams.type !== "all") {
    filters.push(`type=eq.${searchParams.type}`);
  }

  const filterStr = filters.join("&");
  const url = `${supabaseUrl}/rest/v1/proposals?select=id,metro,source,external_id,title,description,type,status,category,borough,council_district,neighborhood,sponsor,intro_date,last_action_date,hearing_date,source_url,latitude,longitude&${filterStr}&order=intro_date.desc&limit=20`;

  const res = await fetch(url, {
    headers: {
      apikey: supabaseKey,
      Prefer: "count=exact",
    },
    next: { revalidate: 3600 },
  });

  if (!res.ok) return { proposals: [], total: 0 };

  const proposals = await res.json();
  const totalStr = res.headers.get("content-range");
  const total = totalStr ? parseInt(totalStr.split("/")[1] || "0") : proposals.length;

  return { proposals, total };
}

export default async function ProposalsPage({
  params: routeParams,
  searchParams: searchParamsPromise,
}: {
  params: Promise<{ city: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { city } = await routeParams;
  const searchParams = await searchParamsPromise;

  if (!isValidCity(city)) notFound();

  const meta = CITY_META[city as City];
  const { proposals, total } = await getProposals(city, searchParams);
  const currentView = searchParams.view || "list";

  return (
    <AdSidebar>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-50 rounded-lg">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#0F1D2E]">
              Proposals & Land Use
            </h1>
          </div>
          <p className="text-[#64748b] text-sm sm:text-base">
            City council legislation and land use applications under review in{" "}
            {meta.fullName}. Filter by area, category, or status.
          </p>
        </div>

        <Suspense fallback={null}>
          <ProposalFilters city={city as City} />
        </Suspense>

        {currentView === "map" ? (
          <Suspense
            fallback={
              <div className="h-[500px] bg-[#f8fafc] rounded-xl border border-[#e2e8f0] flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-[#3b82f6] border-t-transparent rounded-full animate-spin" />
              </div>
            }
          >
            <ProposalMap city={city as City} />
          </Suspense>
        ) : (
          <Suspense fallback={<div className="py-12 text-center text-[#64748b]">Loading...</div>}>
            <ProposalList
              initialData={proposals}
              initialTotal={total}
              metro={city}
            />
          </Suspense>
        )}

        <AdBlock adSlot="PROPOSALS_BOTTOM" adFormat="horizontal" />
      </div>
    </AdSidebar>
  );
}

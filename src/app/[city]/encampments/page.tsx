import type { Metadata } from "next";
import { Tent, ExternalLink, AlertCircle } from "lucide-react";
import { canonicalUrl, cityPath } from "@/lib/seo";
import { isValidCity, CITY_META, type City } from "@/lib/cities";
import { notFound } from "next/navigation";
import { AdSidebar } from "@/components/ui/AdSidebar";
import { AdBlock } from "@/components/ui/AdBlock";
import { EncampmentMapSection } from "@/components/encampments/EncampmentMapSection";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>;
}): Promise<Metadata> {
  const { city } = await params;
  if (!isValidCity(city)) return {};
  const meta = CITY_META[city];
  return {
    title: `Homeless Encampment Reports | ${meta.fullName} | Lucid Rents`,
    description: `See where homeless encampments have been reported across ${meta.fullName}. Interactive map with open, pending, and closed 311 reports by location.`,
    alternates: { canonical: canonicalUrl(cityPath("/encampments", city)) },
    openGraph: {
      title: `${meta.fullName} Homeless Encampment Reports`,
      description: `See where homeless encampments have been reported across ${meta.fullName} — mapped from 311 service requests.`,
      url: canonicalUrl(cityPath("/encampments", city)),
      siteName: "Lucid Rents",
      type: "website",
      locale: "en_US",
    },
  };
}

export const revalidate = 3600;

async function getEncampmentStats(city: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // Total count
  const countUrl = `${supabaseUrl}/rest/v1/encampments?select=id&metro=eq.${city}&limit=1`;
  const countRes = await fetch(countUrl, {
    headers: {
      apikey: supabaseKey,
      Prefer: "count=exact",
    },
    next: { revalidate: 3600 },
  });

  const totalStr = countRes.headers.get("content-range");
  const total = totalStr ? parseInt(totalStr.split("/")[1] || "0") : 0;

  // Recent count (last 90 days)
  const ninetyAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    .toISOString();
  const recentUrl = `${supabaseUrl}/rest/v1/encampments?select=id&metro=eq.${city}&created_date=gte.${ninetyAgo}&limit=1`;
  const recentRes = await fetch(recentUrl, {
    headers: {
      apikey: supabaseKey,
      Prefer: "count=exact",
    },
    next: { revalidate: 3600 },
  });
  const recentStr = recentRes.headers.get("content-range");
  const recent = recentStr ? parseInt(recentStr.split("/")[1] || "0") : 0;

  // Open count
  const openUrl = `${supabaseUrl}/rest/v1/encampments?select=id&metro=eq.${city}&status=neq.Closed&limit=1`;
  const openRes = await fetch(openUrl, {
    headers: {
      apikey: supabaseKey,
      Prefer: "count=exact",
    },
    next: { revalidate: 3600 },
  });
  const openStr = openRes.headers.get("content-range");
  const openCount = openStr ? parseInt(openStr.split("/")[1] || "0") : 0;

  return { total, recent, open: openCount };
}

export default async function EncampmentsPage({
  params: routeParams,
}: {
  params: Promise<{ city: string }>;
}) {
  const { city } = await routeParams;

  // Only available for LA
  if (city !== "los-angeles") {
    notFound();
  }

  if (!isValidCity(city)) {
    notFound();
  }

  const meta = CITY_META[city as City];
  const stats = await getEncampmentStats(city);

  return (
    <AdSidebar>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-[#FEF3C7] rounded-lg">
              <Tent className="w-6 h-6 text-[#D97706]" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#1A1F36]">
              Homeless Encampment Reports
            </h1>
          </div>
          <p className="text-[#5E6687] text-sm sm:text-base">
            LA 311 service requests for homeless encampments across{" "}
            {meta.fullName}. Data updated periodically from the City of Los
            Angeles MyLA311 system.
          </p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
            <p className="text-xs text-[#5E6687] font-medium uppercase tracking-wide">
              Total Reports
            </p>
            <p className="text-2xl font-bold text-[#1A1F36] mt-1">
              {stats.total.toLocaleString()}
            </p>
          </div>
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
            <p className="text-xs text-[#F59E0B] font-medium uppercase tracking-wide">
              Last 90 Days
            </p>
            <p className="text-2xl font-bold text-[#1A1F36] mt-1">
              {stats.recent.toLocaleString()}
            </p>
          </div>
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 col-span-2 sm:col-span-1">
            <p className="text-xs text-[#EF4444] font-medium uppercase tracking-wide">
              Open / Pending
            </p>
            <p className="text-2xl font-bold text-[#1A1F36] mt-1">
              {stats.open.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Map */}
        <div className="mb-6">
          <EncampmentMapSection city={city} />
        </div>

        {/* Info cards */}
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <a
            href="https://homeless.lacounty.gov/ua-homeless-encampment-dashboard/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-3 bg-white border border-[#E2E8F0] rounded-xl p-4 hover:border-[#6366F1] hover:shadow-sm transition-all group"
          >
            <ExternalLink className="w-5 h-5 text-[#6366F1] mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-[#1A1F36] group-hover:text-[#6366F1]">
                LA County Encampment Dashboard
              </p>
              <p className="text-xs text-[#5E6687] mt-0.5">
                Official LA County dashboard with encampment tracking, cleanup
                schedules, and outreach data.
              </p>
            </div>
          </a>
          <a
            href="https://www.lahsa.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-3 bg-white border border-[#E2E8F0] rounded-xl p-4 hover:border-[#6366F1] hover:shadow-sm transition-all group"
          >
            <ExternalLink className="w-5 h-5 text-[#6366F1] mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-[#1A1F36] group-hover:text-[#6366F1]">
                LAHSA — Homeless Services Authority
              </p>
              <p className="text-xs text-[#5E6687] mt-0.5">
                Resources, shelter access, outreach programs, and the annual
                homeless count data.
              </p>
            </div>
          </a>
        </div>

        {/* Disclaimer */}
        <div className="flex items-start gap-3 bg-[#FFFBEB] border border-[#FEF3C7] rounded-xl p-4">
          <AlertCircle className="w-5 h-5 text-[#D97706] mt-0.5 flex-shrink-0" />
          <div className="text-xs text-[#92400e]">
            <p className="font-semibold mb-1">About this data</p>
            <p>
              Data sourced from LA 311 (MyLA311) service requests filed under
              &quot;Homeless Encampment.&quot; Reports reflect requests filed by
              community members, not confirmed encampment presence or counts.
              A single location may have multiple reports over time. This data
              does not represent the full scope of homelessness in Los Angeles.
            </p>
          </div>
        </div>

        <AdBlock adSlot="ENCAMPMENTS_BOTTOM" adFormat="horizontal" />
      </div>
    </AdSidebar>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import {
  Home,
  ExternalLink,
  AlertCircle,
  ArrowUpDown,
} from "lucide-react";
import { canonicalUrl, cityPath, buildingUrl } from "@/lib/seo";
import { isValidCity, CITY_META, type City } from "@/lib/cities";
import { AdSidebar } from "@/components/ui/AdSidebar";
import { AdBlock } from "@/components/ui/AdBlock";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>;
}): Promise<Metadata> {
  const { city } = await params;
  if (!isValidCity(city)) return {};
  const meta = CITY_META[city];
  return {
    title: `Affordable Housing Tracker — ARO Units | ${meta.fullName} | Lucid Rents`,
    description: `Track affordable housing units created under Chicago's Affordable Requirements Ordinance (ARO). Search by ward, project, and income level.`,
    alternates: {
      canonical: canonicalUrl(cityPath("/affordable-housing", city)),
    },
    openGraph: {
      title: `Affordable Housing Tracker — ARO Units | ${meta.fullName}`,
      description: `Track affordable housing units created under Chicago's Affordable Requirements Ordinance (ARO).`,
      url: canonicalUrl(cityPath("/affordable-housing", city)),
      siteName: "Lucid Rents",
      type: "website",
      locale: "en_US",
    },
  };
}

export const revalidate = 86400;

interface AffordableUnit {
  id: number;
  project_name: string | null;
  address: string;
  total_units: number | null;
  affordable_units: number | null;
  income_requirement: string | null;
  status: string | null;
  ward: number | null;
  latitude: number | null;
  longitude: number | null;
  building: { slug: string; borough: string } | null;
}

async function fetchAffordableUnits(): Promise<AffordableUnit[]> {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/chicago_affordable_units?select=id,project_name,address,total_units,affordable_units,income_requirement,status,ward,latitude,longitude,building:buildings(slug,borough)&order=affordable_units.desc.nullslast&limit=500`;
  const res = await fetch(url, {
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    },
    next: { revalidate: 86400 },
  });
  if (!res.ok) return [];
  return res.json();
}

async function fetchAffordableCount(): Promise<number> {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/chicago_affordable_units?select=id&limit=1`;
  const res = await fetch(url, {
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      Prefer: "count=exact",
    },
    next: { revalidate: 86400 },
  });
  const range = res.headers.get("content-range");
  return range ? parseInt(range.split("/")[1] || "0") : 0;
}

export default async function AffordableHousingPage({
  params,
}: {
  params: Promise<{ city: string }>;
}) {
  const { city } = await params;

  if (city !== "chicago") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Home className="w-12 h-12 text-[#94a3b8] mx-auto mb-4" />
          <h1 className="text-xl font-bold text-[#0F1D2E] mb-2">
            Coming Soon
          </h1>
          <p className="text-sm text-[#64748b] max-w-md">
            Affordable housing tracking is currently available for Chicago.
            We&apos;re working on expanding to other cities.
          </p>
          <Link
            href={`/${city}/tenant-rights`}
            className="inline-block mt-6 text-sm font-medium text-[#3B82F6] hover:text-[#2563EB] transition-colors"
          >
            &larr; Back to Tenant Rights
          </Link>
        </div>
      </div>
    );
  }

  if (!isValidCity(city)) return null;

  const [units, totalCount] = await Promise.all([
    fetchAffordableUnits(),
    fetchAffordableCount(),
  ]);

  const totalAffordableUnits = units.reduce(
    (sum, u) => sum + (u.affordable_units || 0),
    0
  );
  const totalAllUnits = units.reduce(
    (sum, u) => sum + (u.total_units || 0),
    0
  );
  const avgAffordability =
    totalAllUnits > 0
      ? ((totalAffordableUnits / totalAllUnits) * 100).toFixed(1)
      : "0";

  // Unique wards for display
  const wards = [...new Set(units.map((u) => u.ward).filter(Boolean))].sort(
    (a, b) => (a ?? 0) - (b ?? 0)
  );

  return (
    <AdSidebar>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* JSON-LD */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Dataset",
              name: "Chicago Affordable Housing — ARO Units",
              description:
                "Affordable housing units created under Chicago's Affordable Requirements Ordinance (ARO).",
              url: canonicalUrl(cityPath("/affordable-housing", "chicago")),
              creator: {
                "@type": "Organization",
                name: "Lucid Rents",
                url: "https://lucidrents.com",
              },
            }),
          }}
        />

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-50 rounded-lg">
              <Home className="w-6 h-6 text-[#059669]" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#0F1D2E]">
              Affordable Housing Tracker — ARO Units
            </h1>
          </div>
          <p className="text-[#64748b] text-sm sm:text-base max-w-3xl">
            Chicago&apos;s Affordable Requirements Ordinance (ARO) requires
            developers receiving city assistance or zoning changes to include
            affordable units in their projects. Track where affordable housing is
            being built across the city.
          </p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
            <p className="text-xs text-[#64748b] font-medium uppercase tracking-wide">
              Total Projects
            </p>
            <p className="text-2xl font-bold text-[#0F1D2E] mt-1">
              {totalCount > 0 ? totalCount.toLocaleString() : "\u2014"}
            </p>
          </div>
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
            <p className="text-xs text-[#059669] font-medium uppercase tracking-wide">
              Affordable Units
            </p>
            <p className="text-2xl font-bold text-[#0F1D2E] mt-1">
              {totalAffordableUnits > 0
                ? totalAffordableUnits.toLocaleString()
                : "\u2014"}
            </p>
          </div>
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
            <p className="text-xs text-[#64748b] font-medium uppercase tracking-wide">
              Avg Affordability %
            </p>
            <p className="text-2xl font-bold text-[#0F1D2E] mt-1">
              {avgAffordability}%
            </p>
          </div>
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
            <p className="text-xs text-[#64748b] font-medium uppercase tracking-wide">
              Wards Covered
            </p>
            <p className="text-2xl font-bold text-[#0F1D2E] mt-1">
              {wards.length > 0 ? wards.length : "\u2014"}
            </p>
          </div>
        </div>

        {/* Table */}
        <section className="bg-white border border-[#e2e8f0] rounded-xl p-5 sm:p-6 mb-6">
          <h2 className="text-lg font-bold text-[#0F1D2E] mb-1">
            ARO Projects
          </h2>
          <p className="text-sm text-[#64748b] mb-4">
            Showing {units.length.toLocaleString()} of{" "}
            {totalCount.toLocaleString()} projects, sorted by affordable unit
            count.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e2e8f0] text-left">
                  <th className="pb-3 pr-4 text-xs font-medium text-[#64748b] uppercase tracking-wide">
                    Project
                  </th>
                  <th className="pb-3 pr-4 text-xs font-medium text-[#64748b] uppercase tracking-wide">
                    Address
                  </th>
                  <th className="pb-3 pr-4 text-xs font-medium text-[#64748b] uppercase tracking-wide text-right">
                    Total Units
                  </th>
                  <th className="pb-3 pr-4 text-xs font-medium text-[#64748b] uppercase tracking-wide text-right">
                    <span className="inline-flex items-center gap-1">
                      Affordable
                      <ArrowUpDown className="w-3 h-3" />
                    </span>
                  </th>
                  <th className="pb-3 pr-4 text-xs font-medium text-[#64748b] uppercase tracking-wide">
                    Income Req.
                  </th>
                  <th className="pb-3 pr-4 text-xs font-medium text-[#64748b] uppercase tracking-wide">
                    Status
                  </th>
                  <th className="pb-3 text-xs font-medium text-[#64748b] uppercase tracking-wide text-right">
                    Ward
                  </th>
                </tr>
              </thead>
              <tbody>
                {units.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-[#f1f5f9] hover:bg-[#f8fafc] transition-colors"
                  >
                    <td className="py-3 pr-4 font-medium text-[#0F1D2E]">
                      {u.project_name || "\u2014"}
                    </td>
                    <td className="py-3 pr-4">
                      {u.building ? (
                        <Link
                          href={buildingUrl(u.building, "chicago")}
                          className="text-[#2563EB] hover:text-[#1d4ed8] hover:underline font-medium"
                        >
                          {u.address}
                        </Link>
                      ) : (
                        <span className="text-[#64748b]">{u.address}</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-right text-[#0F1D2E]">
                      {u.total_units?.toLocaleString() ?? "\u2014"}
                    </td>
                    <td className="py-3 pr-4 text-right font-semibold text-[#059669]">
                      {u.affordable_units?.toLocaleString() ?? "\u2014"}
                    </td>
                    <td className="py-3 pr-4 text-[#64748b] text-xs">
                      {u.income_requirement || "\u2014"}
                    </td>
                    <td className="py-3 pr-4">
                      {u.status ? (
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                            u.status.toLowerCase().includes("complete")
                              ? "bg-emerald-50 text-emerald-700"
                              : u.status.toLowerCase().includes("progress") ||
                                  u.status.toLowerCase().includes("active")
                                ? "bg-blue-50 text-blue-700"
                                : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {u.status}
                        </span>
                      ) : (
                        "\u2014"
                      )}
                    </td>
                    <td className="py-3 text-right text-[#64748b]">
                      {u.ward ?? "\u2014"}
                    </td>
                  </tr>
                ))}
                {units.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-12 text-center text-[#94a3b8]"
                    >
                      No affordable housing data available yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Info cards */}
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <a
            href="https://www.chicago.gov/city/en/depts/doh/provdrs/developers/svcs/aro.html"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-3 bg-white border border-[#e2e8f0] rounded-xl p-4 hover:border-[#3B82F6] hover:shadow-sm transition-all group"
          >
            <ExternalLink className="w-5 h-5 text-[#3B82F6] mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-[#0F1D2E] group-hover:text-[#3B82F6]">
                Chicago ARO Program
              </p>
              <p className="text-xs text-[#64748b] mt-0.5">
                Learn about Chicago&apos;s Affordable Requirements Ordinance and
                eligibility for affordable units.
              </p>
            </div>
          </a>
          <a
            href="https://www.chicago.gov/city/en/depts/doh.html"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-3 bg-white border border-[#e2e8f0] rounded-xl p-4 hover:border-[#3B82F6] hover:shadow-sm transition-all group"
          >
            <ExternalLink className="w-5 h-5 text-[#3B82F6] mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-[#0F1D2E] group-hover:text-[#3B82F6]">
                Dept. of Housing
              </p>
              <p className="text-xs text-[#64748b] mt-0.5">
                Chicago Department of Housing — affordable housing programs,
                applications, and tenant resources.
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
              Data sourced from the City of Chicago Department of Housing ARO
              records. Affordable unit counts and project statuses are updated
              periodically. Contact the Department of Housing directly for the
              most current availability and application information.
            </p>
          </div>
        </div>

        <AdBlock adSlot="AFFORDABLE_HOUSING_BOTTOM" adFormat="horizontal" />
      </div>
    </AdSidebar>
  );
}

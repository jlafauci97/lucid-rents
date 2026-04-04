import type { Metadata } from "next";
import Link from "next/link";
import {
  Droplets,
  ExternalLink,
  AlertCircle,
  ArrowUpDown,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
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
    title: `Lead Safety — Inspection Results | ${meta.fullName} | Lucid Rents`,
    description: `Lead paint inspection results for Chicago buildings. See pass/fail rates, risk levels, and hazard types by address and ward.`,
    alternates: {
      canonical: canonicalUrl(cityPath("/lead-safety", city)),
    },
    openGraph: {
      title: `Lead Safety — Inspection Results | ${meta.fullName}`,
      description: `Lead paint inspection results for Chicago buildings — pass/fail rates, risk levels, and hazard types.`,
      url: canonicalUrl(cityPath("/lead-safety", city)),
      siteName: "Lucid Rents",
      type: "website",
      locale: "en_US",
    },
  };
}

export const revalidate = 86400;

interface LeadInspection {
  id: number;
  address: string;
  inspection_date: string | null;
  result: string | null;
  risk_level: string | null;
  hazard_type: string | null;
  ward: number | null;
  building: { slug: string; borough: string } | null;
}

async function fetchLeadInspections(offset: number, limit: number): Promise<LeadInspection[]> {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/chicago_lead_inspections?select=id,address,inspection_date,result,risk_level,hazard_type,ward,building:buildings(slug,borough)&order=inspection_date.desc.nullslast&limit=${limit}&offset=${offset}`;
  const res = await fetch(url, {
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    },
    next: { revalidate: 86400 },
  });
  if (!res.ok) return [];
  return res.json();
}

async function fetchLeadCount(): Promise<number> {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/chicago_lead_inspections?select=id&limit=1`;
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

function isPass(result: string | null): boolean {
  if (!result) return false;
  const lower = result.toLowerCase();
  return lower.includes("pass") || lower.includes("safe") || lower.includes("clear") || lower.includes("comply");
}

function isFail(result: string | null): boolean {
  if (!result) return false;
  const lower = result.toLowerCase();
  return lower.includes("fail") || lower.includes("hazard") || lower.includes("violation") || lower.includes("non-comply");
}

export default async function LeadSafetyPage({
  params,
  searchParams: searchParamsPromise,
}: {
  params: Promise<{ city: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { city } = await params;
  const searchParams = await searchParamsPromise;
  const currentPage = parseInt(searchParams.page || "1", 10);
  const pageSize = 50;

  if (city !== "chicago") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Droplets className="w-12 h-12 text-[#A3ACBE] mx-auto mb-4" />
          <h1 className="text-xl font-bold text-[#1A1F36] mb-2">
            Coming Soon
          </h1>
          <p className="text-sm text-[#5E6687] max-w-md">
            Lead safety inspection data is currently available for Chicago.
            We&apos;re working on expanding to other cities.
          </p>
          <Link
            href={`/${city}/tenant-rights`}
            className="inline-block mt-6 text-sm font-medium text-[#6366F1] hover:text-[#4F46E5] transition-colors"
          >
            &larr; Back to Tenant Rights
          </Link>
        </div>
      </div>
    );
  }

  if (!isValidCity(city)) return null;

  const offset = (currentPage - 1) * pageSize;
  const [inspections, totalCount] = await Promise.all([
    fetchLeadInspections(offset, pageSize),
    fetchLeadCount(),
  ]);
  const totalPages = Math.ceil(totalCount / pageSize);

  const passCount = inspections.filter((i) => isPass(i.result)).length;
  const failCount = inspections.filter((i) => isFail(i.result)).length;
  const determinedCount = passCount + failCount;
  const passRate =
    determinedCount > 0 ? ((passCount / determinedCount) * 100).toFixed(1) : "0";
  const failRate =
    determinedCount > 0 ? ((failCount / determinedCount) * 100).toFixed(1) : "0";

  const mostRecentDate = inspections.find((i) => i.inspection_date)
    ?.inspection_date;

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
              name: "Chicago Lead Paint Inspection Results",
              description:
                "Lead paint inspection results for Chicago buildings, including pass/fail rates and hazard types.",
              url: canonicalUrl(cityPath("/lead-safety", "chicago")),
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
            <div className="p-2 bg-orange-50 rounded-lg">
              <Droplets className="w-6 h-6 text-[#EA580C]" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#1A1F36]">
              Lead Safety — Inspection Results
            </h1>
          </div>
          <p className="text-[#5E6687] text-sm sm:text-base max-w-3xl">
            Lead paint is a serious health hazard, especially for children.
            Chicago requires lead inspections for residential buildings built
            before 1978. View inspection results to check if a building has been
            tested and its current status.
          </p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
            <p className="text-xs text-[#5E6687] font-medium uppercase tracking-wide">
              Total Inspections
            </p>
            <p className="text-2xl font-bold text-[#1A1F36] mt-1">
              {totalCount > 0 ? totalCount.toLocaleString() : "\u2014"}
            </p>
          </div>
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
            <p className="text-xs text-[#059669] font-medium uppercase tracking-wide">
              Pass Rate
            </p>
            <p className="text-2xl font-bold text-[#059669] mt-1">
              {passRate}%
            </p>
          </div>
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
            <p className="text-xs text-[#DC2626] font-medium uppercase tracking-wide">
              Fail Rate
            </p>
            <p className="text-2xl font-bold text-[#DC2626] mt-1">
              {failRate}%
            </p>
          </div>
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
            <p className="text-xs text-[#5E6687] font-medium uppercase tracking-wide">
              Most Recent
            </p>
            <p className="text-sm font-semibold text-[#1A1F36] mt-2">
              {mostRecentDate
                ? new Date(mostRecentDate).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "\u2014"}
            </p>
          </div>
        </div>

        {/* Table */}
        <section className="bg-white border border-[#E2E8F0] rounded-xl p-5 sm:p-6 mb-6">
          <h2 className="text-lg font-bold text-[#1A1F36] mb-1">
            Inspection Results
          </h2>
          <p className="text-sm text-[#5E6687] mb-4">
            Showing {offset + 1}–{Math.min(offset + pageSize, totalCount).toLocaleString()} of{" "}
            {totalCount.toLocaleString()} inspections, most recent first.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-left">
                  <th className="pb-3 pr-4 text-xs font-medium text-[#5E6687] uppercase tracking-wide">
                    Address
                  </th>
                  <th className="pb-3 pr-4 text-xs font-medium text-[#5E6687] uppercase tracking-wide">
                    <span className="inline-flex items-center gap-1">
                      Inspection Date
                      <ArrowUpDown className="w-3 h-3" />
                    </span>
                  </th>
                  <th className="pb-3 pr-4 text-xs font-medium text-[#5E6687] uppercase tracking-wide">
                    Result
                  </th>
                  <th className="pb-3 pr-4 text-xs font-medium text-[#5E6687] uppercase tracking-wide">
                    Risk Level
                  </th>
                  <th className="pb-3 pr-4 text-xs font-medium text-[#5E6687] uppercase tracking-wide">
                    Hazard Type
                  </th>
                  <th className="pb-3 text-xs font-medium text-[#5E6687] uppercase tracking-wide text-right">
                    Ward
                  </th>
                </tr>
              </thead>
              <tbody>
                {inspections.map((i) => {
                  const passed = isPass(i.result);
                  const failed = isFail(i.result);

                  return (
                    <tr
                      key={i.id}
                      className="border-b border-[#f1f5f9] hover:bg-[#FAFBFD] transition-colors"
                    >
                      <td className="py-3 pr-4 font-medium text-[#1A1F36]">
                        {i.building ? (
                          <Link
                            href={buildingUrl(i.building, "chicago")}
                            className="text-[#4F46E5] hover:text-[#1d4ed8] hover:underline"
                          >
                            {i.address}
                          </Link>
                        ) : (
                          i.address
                        )}
                      </td>
                      <td className="py-3 pr-4 text-[#5E6687]">
                        {i.inspection_date
                          ? new Date(i.inspection_date).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              }
                            )
                          : "\u2014"}
                      </td>
                      <td className="py-3 pr-4">
                        {passed ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" />
                            {i.result}
                          </span>
                        ) : failed ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
                            <XCircle className="w-3 h-3" />
                            {i.result}
                          </span>
                        ) : (
                          <span className="text-xs text-[#5E6687]">
                            {i.result || "\u2014"}
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        {i.risk_level ? (
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                              i.risk_level.toLowerCase().includes("high")
                                ? "bg-red-50 text-red-700"
                                : i.risk_level.toLowerCase().includes("low")
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            {i.risk_level}
                          </span>
                        ) : (
                          <span className="text-[#A3ACBE]">{"\u2014"}</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-[#5E6687] text-xs">
                        {i.hazard_type || "\u2014"}
                      </td>
                      <td className="py-3 text-right text-[#5E6687]">
                        {i.ward ?? "\u2014"}
                      </td>
                    </tr>
                  );
                })}
                {inspections.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-12 text-center text-[#A3ACBE]"
                    >
                      No lead inspection data available yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#E2E8F0]">
              <span className="text-xs text-[#5E6687]">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                {currentPage > 1 ? (
                  <Link
                    href={`/${city}/lead-safety?page=${currentPage - 1}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#E2E8F0] text-[#1A1F36] hover:bg-[#FAFBFD] transition-colors"
                  >
                    <ChevronLeft className="w-3 h-3" /> Previous
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#E2E8F0] text-[#1A1F36] opacity-40 cursor-not-allowed">
                    <ChevronLeft className="w-3 h-3" /> Previous
                  </span>
                )}
                {currentPage < totalPages ? (
                  <Link
                    href={`/${city}/lead-safety?page=${currentPage + 1}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#E2E8F0] text-[#1A1F36] hover:bg-[#FAFBFD] transition-colors"
                  >
                    Next <ChevronRight className="w-3 h-3" />
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#E2E8F0] text-[#1A1F36] opacity-40 cursor-not-allowed">
                    Next <ChevronRight className="w-3 h-3" />
                  </span>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Info cards */}
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <a
            href="https://www.chicago.gov/city/en/depts/cdph/provdrs/healthy_homes/svcs/lead-poisoning-prevention.html"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-3 bg-white border border-[#E2E8F0] rounded-xl p-4 hover:border-[#6366F1] hover:shadow-sm transition-all group"
          >
            <ExternalLink className="w-5 h-5 text-[#6366F1] mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-[#1A1F36] group-hover:text-[#6366F1]">
                CDPH Lead Prevention
              </p>
              <p className="text-xs text-[#5E6687] mt-0.5">
                Chicago Department of Public Health lead poisoning prevention
                resources, free testing, and abatement assistance.
              </p>
            </div>
          </a>
          <a
            href="https://www.chicago.gov/city/en/depts/cdph/provdrs/healthy_homes.html"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-3 bg-white border border-[#E2E8F0] rounded-xl p-4 hover:border-[#6366F1] hover:shadow-sm transition-all group"
          >
            <ExternalLink className="w-5 h-5 text-[#6366F1] mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-[#1A1F36] group-hover:text-[#6366F1]">
                Healthy Homes Program
              </p>
              <p className="text-xs text-[#5E6687] mt-0.5">
                Free lead inspections and abatement for eligible Chicago
                residents through the Healthy Homes program.
              </p>
            </div>
          </a>
        </div>

        {/* Tenant rights callout */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6">
          <h3 className="text-sm font-bold text-[#1A1F36] mb-2">
            Your Rights as a Chicago Tenant
          </h3>
          <ul className="space-y-1.5 text-xs text-[#1A1F36]">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
              Landlords must disclose known lead hazards before you sign a lease.
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
              Chicago&apos;s Lead Safe Housing Ordinance requires landlords to
              mitigate lead hazards in units with children under 6.
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
              You can request a free lead inspection through CDPH if you suspect
              lead paint in your unit.
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
              Retaliation for reporting lead hazards is illegal under Chicago
              tenant protection laws.
            </li>
          </ul>
        </div>

        {/* Disclaimer */}
        <div className="flex items-start gap-3 bg-[#FFFBEB] border border-[#FEF3C7] rounded-xl p-4">
          <AlertCircle className="w-5 h-5 text-[#D97706] mt-0.5 flex-shrink-0" />
          <div className="text-xs text-[#92400e]">
            <p className="font-semibold mb-1">About this data</p>
            <p>
              Data sourced from the Chicago Department of Public Health lead
              inspection records. Inspection results reflect conditions at the
              time of inspection and may not represent current building status.
              This is not a substitute for a professional lead inspection.
            </p>
          </div>
        </div>

        <AdBlock adSlot="LEAD_SAFETY_BOTTOM" adFormat="horizontal" />
      </div>
    </AdSidebar>
  );
}

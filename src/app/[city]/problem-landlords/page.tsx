import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  UserX,
  DollarSign,
  ArrowUpDown,
  ExternalLink,
  AlertCircle,
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
    title: `Problem Landlords — Building Code Scofflaws | ${meta.fullName} | Lucid Rents`,
    description: `Chicago's Building Code Scofflaw List — the worst landlords with the most unpaid fines and building code violations. Search by name, address, or ward.`,
    alternates: {
      canonical: canonicalUrl(cityPath("/problem-landlords", city)),
    },
    openGraph: {
      title: `Problem Landlords — Building Code Scofflaws | ${meta.fullName}`,
      description: `Chicago's Building Code Scofflaw List — landlords with the most unpaid fines and building code violations.`,
      url: canonicalUrl(cityPath("/problem-landlords", city)),
      siteName: "Lucid Rents",
      type: "website",
      locale: "en_US",
    },
  };
}

export const revalidate = 86400;

interface Scofflaw {
  id: string;
  respondent_name: string;
  address: string;
  unpaid_fines: number;
  violation_count: number;
  last_violation_date: string | null;
  ward: number | null;
  building: { slug: string; borough: string } | null;
}

async function fetchScofflaws(): Promise<Scofflaw[]> {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/chicago_scofflaws?select=id,respondent_name,address,unpaid_fines,violation_count,last_violation_date,ward,building:buildings(slug,borough)&order=unpaid_fines.desc&limit=500`;
  const res = await fetch(url, {
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    },
    next: { revalidate: 86400 },
  });
  if (!res.ok) return [];
  return res.json();
}

async function fetchScofflawCount(): Promise<number> {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/chicago_scofflaws?select=id&limit=1`;
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

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default async function ProblemLandlordsPage({
  params,
}: {
  params: Promise<{ city: string }>;
}) {
  const { city } = await params;

  if (city !== "chicago") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <UserX className="w-12 h-12 text-[#94a3b8] mx-auto mb-4" />
          <h1 className="text-xl font-bold text-[#0F1D2E] mb-2">
            Coming Soon
          </h1>
          <p className="text-sm text-[#64748b] max-w-md">
            Problem landlord data is currently available for Chicago. We&apos;re
            working on expanding to other cities.
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

  const [scofflaws, totalCount] = await Promise.all([
    fetchScofflaws(),
    fetchScofflawCount(),
  ]);

  const totalUnpaidFines = scofflaws.reduce(
    (sum, s) => sum + (s.unpaid_fines || 0),
    0
  );
  const avgViolations =
    scofflaws.length > 0
      ? Math.round(
          scofflaws.reduce((sum, s) => sum + (s.violation_count || 0), 0) /
            scofflaws.length
        )
      : 0;

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
              name: "Chicago Building Code Scofflaw List",
              description:
                "Public list of Chicago landlords with the most unpaid building code violation fines.",
              url: canonicalUrl(cityPath("/problem-landlords", "chicago")),
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
            <div className="p-2 bg-red-50 rounded-lg">
              <UserX className="w-6 h-6 text-[#DC2626]" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#0F1D2E]">
              Problem Landlords — Building Code Scofflaws
            </h1>
          </div>
          <p className="text-[#64748b] text-sm sm:text-base max-w-3xl">
            Chicago&apos;s official Building Code Scofflaw List identifies
            property owners with the most egregious records of unpaid fines and
            building code violations. These landlords have repeatedly failed to
            address safety issues in their buildings.
          </p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
            <p className="text-xs text-[#64748b] font-medium uppercase tracking-wide">
              Total Scofflaws
            </p>
            <p className="text-2xl font-bold text-[#0F1D2E] mt-1">
              {totalCount > 0 ? totalCount.toLocaleString() : "\u2014"}
            </p>
          </div>
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
            <p className="text-xs text-[#EF4444] font-medium uppercase tracking-wide">
              Total Unpaid Fines
            </p>
            <p className="text-2xl font-bold text-[#0F1D2E] mt-1">
              {totalUnpaidFines > 0
                ? formatCurrency(totalUnpaidFines)
                : "\u2014"}
            </p>
          </div>
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-4 col-span-2 sm:col-span-1">
            <p className="text-xs text-[#64748b] font-medium uppercase tracking-wide">
              Avg Violations / Scofflaw
            </p>
            <p className="text-2xl font-bold text-[#0F1D2E] mt-1">
              {avgViolations > 0 ? avgViolations : "\u2014"}
            </p>
          </div>
        </div>

        {/* Table */}
        <section className="bg-white border border-[#e2e8f0] rounded-xl p-5 sm:p-6 mb-6">
          <h2 className="text-lg font-bold text-[#0F1D2E] mb-1">
            Scofflaw List
          </h2>
          <p className="text-sm text-[#64748b] mb-4">
            Sorted by unpaid fines (highest first). Showing top{" "}
            {scofflaws.length.toLocaleString()} of{" "}
            {totalCount.toLocaleString()}.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e2e8f0] text-left">
                  <th className="pb-3 pr-4 text-xs font-medium text-[#64748b] uppercase tracking-wide">
                    Respondent
                  </th>
                  <th className="pb-3 pr-4 text-xs font-medium text-[#64748b] uppercase tracking-wide">
                    Address
                  </th>
                  <th className="pb-3 pr-4 text-xs font-medium text-[#64748b] uppercase tracking-wide text-right">
                    <span className="inline-flex items-center gap-1">
                      Unpaid Fines
                      <ArrowUpDown className="w-3 h-3" />
                    </span>
                  </th>
                  <th className="pb-3 pr-4 text-xs font-medium text-[#64748b] uppercase tracking-wide text-right">
                    Violations
                  </th>
                  <th className="pb-3 pr-4 text-xs font-medium text-[#64748b] uppercase tracking-wide">
                    Last Violation
                  </th>
                  <th className="pb-3 text-xs font-medium text-[#64748b] uppercase tracking-wide text-right">
                    Ward
                  </th>
                </tr>
              </thead>
              <tbody>
                {scofflaws.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-[#f1f5f9] hover:bg-[#f8fafc] transition-colors"
                  >
                    <td className="py-3 pr-4 font-medium text-[#0F1D2E]">
                      {s.respondent_name}
                    </td>
                    <td className="py-3 pr-4">
                      {s.building ? (
                        <Link
                          href={buildingUrl(s.building, "chicago")}
                          className="text-[#2563EB] hover:text-[#1d4ed8] hover:underline font-medium"
                        >
                          {s.address}
                        </Link>
                      ) : (
                        <span className="text-[#64748b]">{s.address}</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-right font-semibold text-[#DC2626]">
                      {formatCurrency(s.unpaid_fines || 0)}
                    </td>
                    <td className="py-3 pr-4 text-right text-[#0F1D2E]">
                      {s.violation_count ?? "\u2014"}
                    </td>
                    <td className="py-3 pr-4 text-[#64748b]">
                      {s.last_violation_date
                        ? new Date(s.last_violation_date).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            }
                          )
                        : "\u2014"}
                    </td>
                    <td className="py-3 text-right text-[#64748b]">
                      {s.ward ?? "\u2014"}
                    </td>
                  </tr>
                ))}
                {scofflaws.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-12 text-center text-[#94a3b8]"
                    >
                      No scofflaw data available yet.
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
            href="https://www.chicago.gov/city/en/depts/bldgs/provdrs/inspect/svcs/building-code-scofflaw-list.html"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-3 bg-white border border-[#e2e8f0] rounded-xl p-4 hover:border-[#3B82F6] hover:shadow-sm transition-all group"
          >
            <ExternalLink className="w-5 h-5 text-[#3B82F6] mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-[#0F1D2E] group-hover:text-[#3B82F6]">
                Official Scofflaw List
              </p>
              <p className="text-xs text-[#64748b] mt-0.5">
                View the City of Chicago&apos;s official Building Code Scofflaw
                List maintained by the Department of Buildings.
              </p>
            </div>
          </a>
          <a
            href="https://311.chicago.gov/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-3 bg-white border border-[#e2e8f0] rounded-xl p-4 hover:border-[#3B82F6] hover:shadow-sm transition-all group"
          >
            <ExternalLink className="w-5 h-5 text-[#3B82F6] mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-[#0F1D2E] group-hover:text-[#3B82F6]">
                Report a Building Violation
              </p>
              <p className="text-xs text-[#64748b] mt-0.5">
                File a complaint about building code violations through
                Chicago&apos;s 311 service.
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
              Data sourced from the City of Chicago Department of Buildings
              Building Code Scofflaw List. Inclusion on this list means the
              respondent has unpaid building code violation fines. This data is
              updated periodically and may not reflect the most current status of
              all cases.
            </p>
          </div>
        </div>

        <AdBlock adSlot="PROBLEM_LANDLORDS_BOTTOM" adFormat="horizontal" />
      </div>
    </AdSidebar>
  );
}

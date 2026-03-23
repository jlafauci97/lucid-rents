import type { Metadata } from "next";
import Link from "next/link";
import {
  Thermometer,
  ExternalLink,
  AlertCircle,
  ArrowUpDown,
  Phone,
  Flame,
} from "lucide-react";
import { canonicalUrl, cityPath } from "@/lib/seo";
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
    title: `Heating Complaint Tracker | ${meta.fullName} | Lucid Rents`,
    description: `Track heating complaints filed through Chicago 311. See which buildings have the most no-heat complaints, complaint trends, and tenant heating rights.`,
    alternates: {
      canonical: canonicalUrl(cityPath("/heating-tracker", city)),
    },
    openGraph: {
      title: `Heating Complaint Tracker | ${meta.fullName}`,
      description: `Track heating complaints filed through Chicago 311 — buildings with the most no-heat complaints and tenant heating rights.`,
      url: canonicalUrl(cityPath("/heating-tracker", city)),
      siteName: "Lucid Rents",
      type: "website",
      locale: "en_US",
    },
  };
}

export const revalidate = 3600;

interface HeatingComplaint {
  id: number;
  address: string | null;
  created_date: string | null;
  status: string | null;
  complaint_type: string | null;
  descriptor: string | null;
}

async function fetchHeatingComplaints(): Promise<HeatingComplaint[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // Fetch heating-related 311 complaints for Chicago
  // complaint_type or descriptor containing heat-related terms
  const url = `${supabaseUrl}/rest/v1/complaints_311?select=id,address,created_date,status,complaint_type,descriptor&metro=eq.chicago&or=(complaint_type.ilike.*heat*,complaint_type.ilike.*BUILDING/HOUSING*,descriptor.ilike.*heat*,descriptor.ilike.*no heat*,descriptor.ilike.*furnace*,descriptor.ilike.*boiler*)&order=created_date.desc.nullslast&limit=500`;
  const res = await fetch(url, {
    headers: {
      apikey: supabaseKey,
    },
    next: { revalidate: 3600 },
  });
  if (!res.ok) return [];
  return res.json();
}

async function fetchHeatingComplaintCount(): Promise<number> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const url = `${supabaseUrl}/rest/v1/complaints_311?select=id&metro=eq.chicago&or=(complaint_type.ilike.*heat*,complaint_type.ilike.*BUILDING/HOUSING*,descriptor.ilike.*heat*,descriptor.ilike.*no heat*,descriptor.ilike.*furnace*,descriptor.ilike.*boiler*)&limit=1`;
  const res = await fetch(url, {
    headers: {
      apikey: supabaseKey,
      Prefer: "count=exact",
    },
    next: { revalidate: 3600 },
  });
  const range = res.headers.get("content-range");
  return range ? parseInt(range.split("/")[1] || "0") : 0;
}

async function fetchRecentHeatingCount(): Promise<number> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const ninetyAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const url = `${supabaseUrl}/rest/v1/complaints_311?select=id&metro=eq.chicago&or=(complaint_type.ilike.*heat*,complaint_type.ilike.*BUILDING/HOUSING*,descriptor.ilike.*heat*,descriptor.ilike.*no heat*,descriptor.ilike.*furnace*,descriptor.ilike.*boiler*)&created_date=gte.${ninetyAgo}&limit=1`;
  const res = await fetch(url, {
    headers: {
      apikey: supabaseKey,
      Prefer: "count=exact",
    },
    next: { revalidate: 3600 },
  });
  const range = res.headers.get("content-range");
  return range ? parseInt(range.split("/")[1] || "0") : 0;
}

export default async function HeatingTrackerPage({
  params,
}: {
  params: Promise<{ city: string }>;
}) {
  const { city } = await params;

  if (city !== "chicago") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Thermometer className="w-12 h-12 text-[#94a3b8] mx-auto mb-4" />
          <h1 className="text-xl font-bold text-[#0F1D2E] mb-2">
            Coming Soon
          </h1>
          <p className="text-sm text-[#64748b] max-w-md">
            Heating complaint tracking is currently available for Chicago.
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

  const [complaints, totalCount, recentCount] = await Promise.all([
    fetchHeatingComplaints(),
    fetchHeatingComplaintCount(),
    fetchRecentHeatingCount(),
  ]);

  // Find addresses with most complaints
  const addressCounts: Record<string, number> = {};
  for (const c of complaints) {
    if (c.address) {
      addressCounts[c.address] = (addressCounts[c.address] || 0) + 1;
    }
  }
  const topAddresses = Object.entries(addressCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

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
              name: "Chicago Heating Complaint Tracker",
              description:
                "Heating complaints filed through Chicago 311, tracking no-heat and heating system issues across the city.",
              url: canonicalUrl(cityPath("/heating-tracker", "chicago")),
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
            <div className="p-2 bg-amber-50 rounded-lg">
              <Thermometer className="w-6 h-6 text-[#D97706]" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#0F1D2E]">
              Heating Complaint Tracker
            </h1>
          </div>
          <p className="text-[#64748b] text-sm sm:text-base max-w-3xl">
            Track heating complaints filed through Chicago 311. During heating
            season (October 15 &ndash; June 1), landlords must maintain minimum
            temperatures of 68&deg;F during the day and 66&deg;F at night.
          </p>
        </div>

        {/* Seasonal context banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-8 flex items-start gap-3">
          <Flame className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-[#0F1D2E]">
              Chicago Heating Season: October 15 &ndash; June 1
            </p>
            <p className="text-xs text-[#334155] mt-1">
              During heating season, landlords are required to maintain a minimum
              of 68&deg;F from 8:30 AM to 10:30 PM and 66&deg;F overnight.
              Failure to provide adequate heat is a violation of Chicago&apos;s
              Municipal Code (Chapter 13-196).
            </p>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
            <p className="text-xs text-[#64748b] font-medium uppercase tracking-wide">
              Total Complaints
            </p>
            <p className="text-2xl font-bold text-[#0F1D2E] mt-1">
              {totalCount > 0 ? totalCount.toLocaleString() : "\u2014"}
            </p>
          </div>
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
            <p className="text-xs text-[#F59E0B] font-medium uppercase tracking-wide">
              Last 90 Days
            </p>
            <p className="text-2xl font-bold text-[#0F1D2E] mt-1">
              {recentCount > 0 ? recentCount.toLocaleString() : "\u2014"}
            </p>
          </div>
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-4 col-span-2 sm:col-span-1">
            <p className="text-xs text-[#EF4444] font-medium uppercase tracking-wide">
              Repeat Offenders
            </p>
            <p className="text-2xl font-bold text-[#0F1D2E] mt-1">
              {topAddresses.length > 0 ? topAddresses.length : "\u2014"}
            </p>
            <p className="text-[10px] text-[#94a3b8] mt-0.5">
              addresses with 2+ complaints
            </p>
          </div>
        </div>

        {/* Top offending buildings */}
        {topAddresses.length > 0 && (
          <section className="bg-white border border-[#e2e8f0] rounded-xl p-5 sm:p-6 mb-6">
            <h2 className="text-lg font-bold text-[#0F1D2E] mb-1">
              Buildings with Most Complaints
            </h2>
            <p className="text-sm text-[#64748b] mb-4">
              Addresses with the highest number of heating-related 311
              complaints.
            </p>
            <div className="space-y-2">
              {topAddresses.map(([address, count]) => (
                <div
                  key={address}
                  className="flex items-center justify-between bg-[#f8fafc] rounded-lg px-4 py-3"
                >
                  <span className="text-sm font-medium text-[#0F1D2E]">
                    {address}
                  </span>
                  <span className="text-xs font-semibold text-[#DC2626] bg-red-50 px-2.5 py-1 rounded-full">
                    {count} complaint{count !== 1 ? "s" : ""}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Complaints table */}
        <section className="bg-white border border-[#e2e8f0] rounded-xl p-5 sm:p-6 mb-6">
          <h2 className="text-lg font-bold text-[#0F1D2E] mb-1">
            Recent Heating Complaints
          </h2>
          <p className="text-sm text-[#64748b] mb-4">
            Showing {complaints.length.toLocaleString()} of{" "}
            {totalCount.toLocaleString()} complaints, most recent first.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e2e8f0] text-left">
                  <th className="pb-3 pr-4 text-xs font-medium text-[#64748b] uppercase tracking-wide">
                    Address
                  </th>
                  <th className="pb-3 pr-4 text-xs font-medium text-[#64748b] uppercase tracking-wide">
                    <span className="inline-flex items-center gap-1">
                      Date
                      <ArrowUpDown className="w-3 h-3" />
                    </span>
                  </th>
                  <th className="pb-3 pr-4 text-xs font-medium text-[#64748b] uppercase tracking-wide">
                    Status
                  </th>
                  <th className="pb-3 text-xs font-medium text-[#64748b] uppercase tracking-wide">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody>
                {complaints.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-[#f1f5f9] hover:bg-[#f8fafc] transition-colors"
                  >
                    <td className="py-3 pr-4 font-medium text-[#0F1D2E]">
                      {c.address || "\u2014"}
                    </td>
                    <td className="py-3 pr-4 text-[#64748b]">
                      {c.created_date
                        ? new Date(c.created_date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "\u2014"}
                    </td>
                    <td className="py-3 pr-4">
                      {c.status ? (
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                            c.status.toLowerCase().includes("closed") ||
                            c.status.toLowerCase().includes("completed")
                              ? "bg-emerald-50 text-emerald-700"
                              : c.status.toLowerCase().includes("open") ||
                                  c.status.toLowerCase().includes("pending")
                                ? "bg-amber-50 text-amber-700"
                                : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {c.status}
                        </span>
                      ) : (
                        "\u2014"
                      )}
                    </td>
                    <td className="py-3 text-[#64748b] text-xs max-w-xs truncate">
                      {c.descriptor || c.complaint_type || "\u2014"}
                    </td>
                  </tr>
                ))}
                {complaints.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-12 text-center text-[#94a3b8]"
                    >
                      No heating complaint data available yet.
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
            href="https://311.chicago.gov/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-3 bg-white border border-[#e2e8f0] rounded-xl p-4 hover:border-[#3B82F6] hover:shadow-sm transition-all group"
          >
            <ExternalLink className="w-5 h-5 text-[#3B82F6] mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-[#0F1D2E] group-hover:text-[#3B82F6]">
                File a 311 Complaint
              </p>
              <p className="text-xs text-[#64748b] mt-0.5">
                Report a no-heat or heating issue through Chicago&apos;s 311
                service system online or by phone.
              </p>
            </div>
          </a>
          <a
            href="https://www.chicago.gov/city/en/depts/bldgs.html"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-3 bg-white border border-[#e2e8f0] rounded-xl p-4 hover:border-[#3B82F6] hover:shadow-sm transition-all group"
          >
            <ExternalLink className="w-5 h-5 text-[#3B82F6] mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-[#0F1D2E] group-hover:text-[#3B82F6]">
                Dept. of Buildings
              </p>
              <p className="text-xs text-[#64748b] mt-0.5">
                Chicago Department of Buildings — building code enforcement,
                inspections, and complaint status.
              </p>
            </div>
          </a>
        </div>

        {/* Emergency contacts */}
        <section className="mb-6">
          <h2 className="text-lg font-bold text-[#0F1D2E] mb-3">
            Emergency Contacts
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              {
                name: "311 — Chicago Services",
                description:
                  "Report no-heat complaints, building violations, and non-emergency issues",
                phone: "311",
              },
              {
                name: "CEDA Energy Assistance",
                description:
                  "Low-income heating bill assistance through LIHEAP",
                phone: "(773) 292-4100",
              },
            ].map((contact) => (
              <div
                key={contact.name}
                className="bg-white rounded-xl border border-[#e2e8f0] p-4 flex items-start gap-3"
              >
                <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 flex-shrink-0">
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#0F1D2E]">
                    {contact.name}
                  </h3>
                  <p className="text-xs text-[#64748b] mt-0.5">
                    {contact.description}
                  </p>
                  <a
                    href={`tel:${contact.phone}`}
                    className="inline-block mt-1 text-xs font-medium text-[#3B82F6] hover:text-[#2563EB] transition-colors"
                  >
                    {contact.phone}
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Disclaimer */}
        <div className="flex items-start gap-3 bg-[#FFFBEB] border border-[#FEF3C7] rounded-xl p-4">
          <AlertCircle className="w-5 h-5 text-[#D97706] mt-0.5 flex-shrink-0" />
          <div className="text-xs text-[#92400e]">
            <p className="font-semibold mb-1">About this data</p>
            <p>
              Data sourced from Chicago 311 service requests related to heating
              complaints. Reports reflect complaints filed by residents and may
              not represent all heating issues in a building. Status information
              is updated periodically and may not reflect real-time resolution.
            </p>
          </div>
        </div>

        <AdBlock adSlot="HEATING_TRACKER_BOTTOM" adFormat="horizontal" />
      </div>
    </AdSidebar>
  );
}

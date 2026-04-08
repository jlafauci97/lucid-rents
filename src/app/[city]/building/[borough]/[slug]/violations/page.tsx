import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, AlertTriangle, MessageSquare, Scale, HardHat, Bug, DoorOpen, ClipboardList } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { regionFromSlug, buildingUrl, canonicalUrl, cityBreadcrumbs, cityPath } from "@/lib/seo";
import { CITY_META, VALID_CITIES, type City } from "@/lib/cities";
import { VIOLATION_AGENCIES } from "@/lib/constants";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ViolationTimeline } from "@/components/building/ViolationTimeline";
import { ViolationSummaryTable } from "@/components/building/ViolationSummaryTable";
import { ComplaintTimeline } from "@/components/building/ComplaintTimeline";
import { LitigationTimeline } from "@/components/building/LitigationTimeline";
import { DobViolationTimeline } from "@/components/building/DobViolationTimeline";
import { BedBugTimeline } from "@/components/building/BedBugTimeline";
import { EvictionTimeline } from "@/components/building/EvictionTimeline";
import { PermitTimeline } from "@/components/building/PermitTimeline";
import { cache } from "react";
import type { Building, HpdViolation, Complaint311, HpdLitigation, DobViolation, BedBugReport, Eviction, DobPermit, LahdViolationSummary } from "@/types";

export const revalidate = 86400;
const PER_PAGE = 20;

type IssueType = "violations" | "complaints" | "litigations" | "dob" | "bedbugs" | "evictions" | "permits";

const CITY_TABS: Record<City, IssueType[]> = {
  nyc: ["violations", "complaints", "litigations", "dob", "bedbugs", "evictions", "permits"],
  chicago: ["dob", "complaints", "permits"],
  "los-angeles": ["violations", "complaints", "permits"],
  miami: ["violations", "complaints", "permits"],
  houston: ["violations", "complaints", "permits"],
};

const TAB_META: Record<IssueType, { icon: typeof AlertTriangle; activeBg: string; activeText: string }> = {
  violations: { icon: AlertTriangle, activeBg: "bg-red-50 ring-1 ring-[#EF4444]", activeText: "text-[#EF4444]" },
  complaints: { icon: MessageSquare, activeBg: "bg-amber-50 ring-1 ring-[#F59E0B]", activeText: "text-[#F59E0B]" },
  litigations: { icon: Scale, activeBg: "bg-violet-50 ring-1 ring-[#8B5CF6]", activeText: "text-[#8B5CF6]" },
  dob: { icon: HardHat, activeBg: "bg-blue-50 ring-1 ring-[#3B82F6]", activeText: "text-[#6366F1]" },
  bedbugs: { icon: Bug, activeBg: "bg-purple-50 ring-1 ring-[#9333EA]", activeText: "text-[#9333EA]" },
  evictions: { icon: DoorOpen, activeBg: "bg-pink-50 ring-1 ring-[#EC4899]", activeText: "text-[#EC4899]" },
  permits: { icon: ClipboardList, activeBg: "bg-teal-50 ring-1 ring-[#0D9488]", activeText: "text-[#0D9488]" },
};

function getTabLabel(type: IssueType, city: City): string {
  const agencies = VIOLATION_AGENCIES[city] || VIOLATION_AGENCIES.nyc;
  switch (type) {
    case "violations": return `${agencies.housing} Violations`;
    case "complaints": return "311 Complaints";
    case "litigations": return `${agencies.housing} Litigations`;
    case "dob": return `${agencies.building} Violations`;
    case "bedbugs": return "Bedbugs";
    case "evictions": return "Evictions";
    case "permits": return city === "los-angeles" ? "LADBS Permits" : city === "chicago" ? "CDBS Permits" : "Permits";
  }
}

const getBuilding = cache(async (boroughSlug: string, slug: string, metro?: string) => {
  const city = (metro || "nyc") as City;
  const borough = regionFromSlug(boroughSlug, city);
  const supabase = await createClient();
  let query = supabase.from("buildings").select("*").eq("slug", slug).eq("borough", borough);
  if (metro) query = query.eq("metro", metro);
  const { data } = await query.limit(1);
  if (!data || data.length === 0) return null;
  return data[0] as Building;
});

const safe = <T,>(promise: PromiseLike<{ data: T | null; error: unknown }>, fallback: T): Promise<T> =>
  Promise.resolve(promise).then(({ data, error }) => {
    if (error) console.error("Supabase query error:", error);
    return data ?? fallback;
  }).catch((err: unknown) => {
    console.error("Supabase query exception:", err);
    return fallback;
  });

const safeCount = async (query: PromiseLike<{ count: number | null; error: unknown }>): Promise<number> => {
  try {
    const { count, error } = await query;
    if (error) return 0;
    return count ?? 0;
  } catch { return 0; }
};

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ city: string; borough: string; slug: string }>;
  searchParams: Promise<{ type?: string; page?: string }>;
}): Promise<Metadata> {
  const { city, borough, slug } = await params;
  const { type = "violations" } = await searchParams;
  const building = await getBuilding(borough, slug, city);
  if (!building) return { title: "Building Not Found" };
  const label = getTabLabel(type as IssueType, city as City);
  return {
    title: `${building.full_address} — ${label} | Lucid Rents`,
    description: `All ${label.toLowerCase()} for ${building.full_address}.`,
    alternates: {
      canonical: canonicalUrl(`${buildingUrl(building, city as City)}/violations?type=${type}`),
    },
  };
}

export default async function ViolationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ city: string; borough: string; slug: string }>;
  searchParams: Promise<{ type?: string; page?: string }>;
}) {
  const { city: cityParam, borough: boroughSlug, slug } = await params;
  const { type: typeParam = "violations", page: pageParam = "1" } = await searchParams;
  const city = (VALID_CITIES.includes(cityParam as City) ? cityParam : "nyc") as City;
  const building = await getBuilding(boroughSlug, slug, city);
  if (!building) notFound();

  const enabledTabs = CITY_TABS[city] || CITY_TABS.nyc;
  const type = (enabledTabs.includes(typeParam as IssueType) ? typeParam : enabledTabs[0]) as IssueType;
  const page = Math.max(1, parseInt(pageParam, 10) || 1);
  const offset = (page - 1) * PER_PAGE;

  const meta = CITY_META[city];
  const agencies = VIOLATION_AGENCIES[city] || VIOLATION_AGENCIES.nyc;
  const supabase = await createClient();
  const isNYC = city === "nyc";
  const isChicago = city === "chicago";
  const isLA = city === "los-angeles";

  // Fetch counts for all enabled tabs + data for the active tab in parallel
  const countQueries: Promise<number>[] = enabledTabs.map((tab) => {
    switch (tab) {
      case "violations":
        return isLA
          ? safeCount(supabase.from("lahd_violation_summary").select("*", { count: "exact", head: true }).eq("building_id", building.id))
          : safeCount(supabase.from("hpd_violations").select("*", { count: "exact", head: true }).eq("building_id", building.id));
      case "complaints":
        return safeCount(supabase.from("complaints_311").select("*", { count: "exact", head: true }).eq("building_id", building.id));
      case "litigations":
        return safeCount(supabase.from("hpd_litigations").select("*", { count: "exact", head: true }).eq("building_id", building.id));
      case "dob":
        return safeCount(supabase.from("dob_violations").select("*", { count: "exact", head: true }).eq("building_id", building.id));
      case "bedbugs":
        return safeCount(supabase.from("bedbug_reports").select("*", { count: "exact", head: true }).eq("building_id", building.id));
      case "evictions":
        return safeCount(supabase.from("evictions").select("*", { count: "exact", head: true }).eq("building_id", building.id));
      case "permits":
        return safeCount(supabase.from("dob_permits").select("*", { count: "exact", head: true }).eq("building_id", building.id));
    }
  });

  // Fetch data for selected type
  let dataPromise: Promise<unknown[]>;
  if (type === "violations") {
    dataPromise = isLA
      ? safe(supabase.from("lahd_violation_summary").select("*").eq("building_id", building.id).order("violations_cited", { ascending: false }).range(offset, offset + PER_PAGE - 1), [] as LahdViolationSummary[])
      : safe(supabase.from("hpd_violations").select("*").eq("building_id", building.id).order("inspection_date", { ascending: false }).range(offset, offset + PER_PAGE - 1), [] as HpdViolation[]);
  } else if (type === "complaints") {
    dataPromise = safe(supabase.from("complaints_311").select("*").eq("building_id", building.id).order("created_date", { ascending: false }).range(offset, offset + PER_PAGE - 1), [] as Complaint311[]);
  } else if (type === "litigations") {
    dataPromise = safe(supabase.from("hpd_litigations").select("*").eq("building_id", building.id).order("case_open_date", { ascending: false }).range(offset, offset + PER_PAGE - 1), [] as HpdLitigation[]);
  } else if (type === "dob") {
    dataPromise = safe(supabase.from("dob_violations").select("*").eq("building_id", building.id).order("issue_date", { ascending: false }).range(offset, offset + PER_PAGE - 1), [] as DobViolation[]);
  } else if (type === "bedbugs") {
    dataPromise = safe(supabase.from("bedbug_reports").select("*").eq("building_id", building.id).order("filing_date", { ascending: false }).range(offset, offset + PER_PAGE - 1), [] as BedBugReport[]);
  } else if (type === "evictions") {
    dataPromise = safe(supabase.from("evictions").select("*").eq("building_id", building.id).order("executed_date", { ascending: false }).range(offset, offset + PER_PAGE - 1), [] as Eviction[]);
  } else {
    dataPromise = safe(supabase.from("dob_permits").select("*").eq("building_id", building.id).order("issued_date", { ascending: false }).range(offset, offset + PER_PAGE - 1), [] as DobPermit[]);
  }

  const [tabCountsArr, items] = await Promise.all([
    Promise.all(countQueries),
    dataPromise,
  ]);

  const tabCounts: Record<string, number> = {};
  enabledTabs.forEach((tab, i) => { tabCounts[tab] = tabCountsArr[i]; });

  const totalCount = tabCounts[type] || 0;
  const totalPages = Math.ceil(totalCount / PER_PAGE);
  const buildingHref = buildingUrl(building, city);
  const label = getTabLabel(type, city);

  const breadcrumbs = [
    ...cityBreadcrumbs(city, {
      label: building.borough,
      href: cityPath(`/building/${boroughSlug}`, city),
    }),
    { label: building.full_address, href: buildingHref },
    { label: "Issues", href: `${buildingHref}/violations?type=${type}` },
  ];

  const baseUrl = `${buildingHref}/violations?type=${type}`;

  return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Breadcrumbs items={breadcrumbs} />

        {/* Header */}
        <div className="mb-6 mt-4">
          <Link
            href={buildingHref}
            className="inline-flex items-center gap-1 text-sm text-[#5E6687] hover:text-[#6366F1] transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Building
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1A1F36]">
            {building.full_address}
          </h1>
          <p className="text-[#5E6687] text-sm mt-1">
            {meta.fullName}
          </p>
        </div>

        {/* Tab navigation */}
        <div className="flex flex-wrap gap-2 mb-6">
          {enabledTabs.map((tab) => {
            const tabMeta = TAB_META[tab];
            const TabIcon = tabMeta.icon;
            const isActive = tab === type;
            const count = tabCounts[tab] || 0;
            return (
              <Link
                key={tab}
                href={`${buildingHref}/violations?type=${tab}`}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  isActive
                    ? `${tabMeta.activeBg} ${tabMeta.activeText}`
                    : "bg-gray-100 hover:bg-gray-200 text-[#5E6687]"
                }`}
              >
                <TabIcon className="w-4 h-4" />
                {getTabLabel(tab, city)} ({count})
              </Link>
            );
          })}
        </div>

        {/* Page info */}
        <p className="text-[#5E6687] text-sm mb-4">
          <span className="font-medium">{totalCount} total</span>
          {totalPages > 1 && (
            <> · Page {page} of {totalPages}</>
          )}
        </p>

        {items.length === 0 ? (
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-12 text-center">
            <AlertTriangle className="w-12 h-12 text-[#A3ACBE] mx-auto mb-3" />
            <p className="text-[#5E6687]">No {label.toLowerCase()} found for this building.</p>
          </div>
        ) : (
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 sm:p-6">
            {type === "violations" && isLA && (
              <ViolationSummaryTable violations={items as LahdViolationSummary[]} agencyLabel={agencies.housing} limit={PER_PAGE} />
            )}
            {type === "violations" && !isLA && (
              <ViolationTimeline violations={items as HpdViolation[]} agencyLabel={agencies.housing} limit={PER_PAGE} />
            )}
            {type === "complaints" && (
              <ComplaintTimeline complaints={items as Complaint311[]} limit={PER_PAGE} />
            )}
            {type === "litigations" && (
              <LitigationTimeline litigations={items as HpdLitigation[]} agencyLabel={agencies.housing} limit={PER_PAGE} />
            )}
            {type === "dob" && (
              <DobViolationTimeline violations={items as DobViolation[]} agencyLabel={agencies.building} limit={PER_PAGE} />
            )}
            {type === "bedbugs" && (
              <BedBugTimeline reports={items as BedBugReport[]} limit={PER_PAGE} />
            )}
            {type === "evictions" && (
              <EvictionTimeline evictions={items as Eviction[]} limit={PER_PAGE} />
            )}
            {type === "permits" && (
              <PermitTimeline permits={items as DobPermit[]} agencyLabel={agencies.building} limit={PER_PAGE} />
            )}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            {page > 1 && (
              <Link
                href={`${baseUrl}&page=${page - 1}`}
                className="px-4 py-2 rounded-lg border text-sm font-medium transition-colors hover:bg-gray-50 text-[#5E6687]"
              >
                Previous
              </Link>
            )}
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
              .reduce<(number | "ellipsis")[]>((acc, p, i, arr) => {
                if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("ellipsis");
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === "ellipsis" ? (
                  <span key={`e${i}`} className="px-2 text-[#A3ACBE]">...</span>
                ) : (
                  <Link
                    key={p}
                    href={`${baseUrl}&page=${p}`}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      p === page
                        ? "bg-[#6366F1] text-white"
                        : "border hover:bg-gray-50 text-[#5E6687]"
                    }`}
                  >
                    {p}
                  </Link>
                )
              )}
            {page < totalPages && (
              <Link
                href={`${baseUrl}&page=${page + 1}`}
                className="px-4 py-2 rounded-lg border text-sm font-medium transition-colors hover:bg-gray-50 text-[#5E6687]"
              >
                Next
              </Link>
            )}
          </div>
        )}
      </div>
  );
}

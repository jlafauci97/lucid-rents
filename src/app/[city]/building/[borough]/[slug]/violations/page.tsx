import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { IssuesTabs } from "@/components/building/IssuesTabs";
import { ViolationTrend } from "@/components/building/ViolationTrend";
import { CommonIssues } from "@/components/building/CommonIssues";
import { regionFromSlug, buildingUrl, canonicalUrl } from "@/lib/seo";
import { CITY_META, VALID_CITIES, type City } from "@/lib/cities";
import { VIOLATION_AGENCIES } from "@/lib/constants";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { cache } from "react";
import type { Building, HpdViolation, Complaint311, HpdLitigation, DobViolation, BedBugReport, Eviction, DobPermit, LahdViolationSummary } from "@/types";
import type { Metadata } from "next";

export const revalidate = 3600;

interface ViolationsPageProps {
  params: Promise<{ city: string; borough: string; slug: string }>;
}

const getBuilding = cache(async (boroughSlug: string, slug: string, metro?: string) => {
  const city = (metro || "nyc") as City;
  const borough = regionFromSlug(boroughSlug, city);

  const supabase = await createClient();
  let query = supabase
    .from("buildings")
    .select("*")
    .eq("slug", slug)
    .eq("borough", borough);

  if (metro) {
    query = query.eq("metro", metro);
  }

  const { data } = await query.limit(1);

  if (!data || data.length === 0) return null;
  return data[0] as Building;
});

function metroToCity(metro: string | null): City {
  if (metro && VALID_CITIES.includes(metro as City)) return metro as City;
  return "nyc";
}

const safe = <T,>(promise: PromiseLike<{ data: T | null; error: unknown }>, fallback: T): Promise<T> =>
  Promise.resolve(promise).then(({ data, error }) => {
    if (error) console.error("Supabase query error:", error);
    return data ?? fallback;
  }).catch((err: unknown) => {
    console.error("Supabase query exception:", err);
    return fallback;
  });

export async function generateMetadata({
  params,
}: ViolationsPageProps): Promise<Metadata> {
  const { city: cityParam, borough, slug } = await params;
  const building = await getBuilding(borough, slug, cityParam);

  if (!building) {
    return { title: "Building Not Found" };
  }

  const city = metroToCity(building.metro);
  const shortAddress = building.full_address.split(",")[0]?.trim() || building.full_address;
  const title = `Violations & Issues for ${shortAddress}`;
  const description = `View all violations, complaints, litigations, and issues for ${building.full_address}. Complete history of building code violations and tenant complaints.`;
  const url = canonicalUrl(`${buildingUrl(building, city)}/violations`);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "Lucid Rents",
      type: "article",
      locale: "en_US",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function BuildingViolationsPage({ params }: ViolationsPageProps) {
  const { city: cityParam, borough, slug } = await params;
  const building = await getBuilding(borough, slug, cityParam);

  if (!building) notFound();

  const city = metroToCity(building.metro);
  const cityMeta = CITY_META[city];
  const supabase = await createClient();

  const isLA = city === "los-angeles";
  const isChicago = city === "chicago";
  const isNYC = city === "nyc";

  const [violations, complaints, litigations, dobViolations, bedbugs, evictions, permits, lahdViolationSummary] = await Promise.all([
    safe(supabase.from("hpd_violations").select("*").eq("building_id", building.id).order("inspection_date", { ascending: false }).limit(1000), [] as HpdViolation[]),
    safe(supabase.from("complaints_311").select("*").eq("building_id", building.id).order("created_date", { ascending: false }).limit(1000), [] as Complaint311[]),
    isNYC ? safe(supabase.from("hpd_litigations").select("*").eq("building_id", building.id).order("case_open_date", { ascending: false }).limit(1000), [] as HpdLitigation[]) : Promise.resolve([] as HpdLitigation[]),
    (isNYC || isChicago) ? safe(supabase.from("dob_violations").select("*").eq("building_id", building.id).order("issue_date", { ascending: false }).limit(1000), [] as DobViolation[]) : Promise.resolve([] as DobViolation[]),
    isNYC ? safe(supabase.from("bedbug_reports").select("*").eq("building_id", building.id).order("filing_date", { ascending: false }).limit(1000), [] as BedBugReport[]) : Promise.resolve([] as BedBugReport[]),
    isNYC ? safe(supabase.from("evictions").select("*").eq("building_id", building.id).order("executed_date", { ascending: false }).limit(1000), [] as Eviction[]) : Promise.resolve([] as Eviction[]),
    safe(supabase.from("dob_permits").select("*").eq("building_id", building.id).order("issued_date", { ascending: false }).limit(1000), [] as DobPermit[]),
    isLA
      ? safe(supabase.from("lahd_violation_summary").select("id, building_id, violation_type, violations_cited, violations_cleared").eq("building_id", building.id).order("violations_cited", { ascending: false }).limit(1000), [] as LahdViolationSummary[])
      : Promise.resolve([] as LahdViolationSummary[]),
  ]);

  // Common Issues aggregation
  const categorize = (desc: string): string => {
    const d = desc.toUpperCase();
    if (/MICE|ROACH|INFESTATION|PEST|BED\s?BUG/.test(d)) return "Pest Infestation";
    if (/PAINT|PLASTER/.test(d)) return "Paint/Plaster";
    if (/LEAK|WATER\s+(LEAK|SUPPLY)/.test(d)) return "Water Leak";
    if (/WINDOW|GUARD/.test(d)) return "Window/Guard";
    if (/SMOKE|CARBON|DETECTOR/.test(d)) return "Smoke/CO Detector";
    if (/DOOR|LOCK/.test(d)) return "Door/Lock";
    if (/FLOOR|TILE/.test(d)) return "Flooring";
    if (/HEAT|HOT WATER|BOILER/.test(d)) return "Heat/Hot Water";
    if (/LEAD/.test(d)) return "Lead Paint";
    if (/ELECTRIC|OUTLET|WIRING/.test(d)) return "Electrical";
    if (/ROOF|CEILING/.test(d)) return "Roof/Ceiling";
    if (/MOLD|MILDEW/.test(d)) return "Mold/Mildew";
    if (/ELEVATOR/.test(d)) return "Elevator";
    if (/FIRE\s?ESCAPE|STAIR/.test(d)) return "Fire Escape/Stairs";
    return "Other";
  };

  const violationCounts = new Map<string, number>();
  for (const v of violations) {
    const cat = categorize(v.nov_description || "Other");
    violationCounts.set(cat, (violationCounts.get(cat) || 0) + 1);
  }
  const topViolations = [...violationCounts.entries()]
    .filter(([type]) => type !== "Other")
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const complaintCounts = new Map<string, number>();
  for (const c of complaints) {
    const type = c.complaint_type || c.descriptor || "Unknown";
    complaintCounts.set(type, (complaintCounts.get(type) || 0) + 1);
  }
  const topComplaints = [...complaintCounts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const shortAddress = building.full_address.split(",")[0]?.trim() || building.full_address;
  const bUrl = buildingUrl(building, city);
  const agencies = VIOLATION_AGENCIES[city] || VIOLATION_AGENCIES.nyc;

  const totalCounts = {
    violations: isLA ? lahdViolationSummary.length : (building.violation_count ?? violations.length),
    complaints: building.complaint_count ?? complaints.length,
    litigations: building.litigation_count ?? litigations.length,
    dob: building.dob_violation_count ?? dobViolations.length,
    bedbugs: building.bedbug_report_count ?? bedbugs.length,
    evictions: building.eviction_count ?? evictions.length,
    permits: building.permit_count ?? permits.length,
  };

  const breadcrumbs = [
    { label: cityMeta?.name || "NYC", href: `/${city}` },
    { label: shortAddress, href: bUrl },
    { label: "Violations & Issues", href: `${bUrl}/violations` },
  ];

  return (
    <main className="min-h-screen bg-[#FAFBFD]">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Breadcrumbs items={breadcrumbs} />

        <Link
          href={bUrl}
          className="inline-flex items-center gap-1.5 text-sm text-[#64748B] hover:text-[#1E293B] transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to building
        </Link>

        <h1 className="text-2xl font-bold text-[#1E293B] mb-8">
          {shortAddress} — Violations &amp; Issues
        </h1>

        <ViolationTrend
          buildingId={building.id}
          housingAgency={city === "los-angeles" ? "LAHD" : city === "chicago" ? "CDBS" : city === "miami" ? "RER" : "HPD"}
        />
        <CommonIssues topViolations={topViolations} topComplaints={topComplaints} />

        <IssuesTabs
          violations={violations}
          complaints={complaints}
          litigations={litigations}
          dobViolations={dobViolations}
          bedbugs={bedbugs}
          evictions={evictions}
          permits={permits}
          lahdViolationSummary={lahdViolationSummary}
          city={city}
          totalCounts={totalCounts}
        />
      </div>
    </main>
  );
}

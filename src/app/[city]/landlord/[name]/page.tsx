import { createClient } from "@/lib/supabase/server";
import { notFound, permanentRedirect } from "next/navigation";
import Link from "next/link";
import {
  Users,
  Building2,
  AlertTriangle,
  MessageSquare,
  MapPin,
  ArrowLeft,
  ExternalLink,
  Scale,
  HardHat,
} from "lucide-react";
import { LetterGrade } from "@/components/ui/LetterGrade";
import dynamic from "next/dynamic";

const LandlordViolationTrend = dynamic(() => import("@/components/landlord/LandlordViolationTrend").then(m => m.LandlordViolationTrend), {
  loading: () => <div className="bg-white rounded-xl border border-[#e2e8f0] p-6"><div className="h-6 w-48 bg-[#e2e8f0] rounded animate-pulse mb-4" /><div className="h-[300px] bg-[#f8fafc] rounded-lg animate-pulse" /></div>,
});
import { LandlordActionLinks } from "@/components/landlord/LandlordActionLinks";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { landlordSlug, landlordUrl, landlordJsonLd, breadcrumbJsonLd, canonicalUrl, buildingUrl, cityPath } from "@/lib/seo";
import { deriveScore } from "@/lib/constants";
import { AdSidebar } from "@/components/ui/AdSidebar";
import { AdBlock } from "@/components/ui/AdBlock";
import type { Metadata } from "next";

export const revalidate = 3600; // ISR: revalidate hourly

interface LandlordPageProps {
  params: Promise<{ city: string; name: string }>;
}

const BUILDING_SELECT =
  "id, full_address, borough, zip_code, year_built, total_units, num_floors, owner_name, slug, overall_score, violation_count, complaint_count, litigation_count, dob_violation_count, review_count";

async function findBuildings(supabase: Awaited<ReturnType<typeof createClient>>, param: string) {
  // Step 1: Look up exact owner name from landlord_stats by slug
  const { data: statsRows } = await supabase
    .from("landlord_stats")
    .select("name")
    .eq("slug", param)
    .limit(1);

  const ownerName = statsRows?.[0]?.name;

  if (!ownerName) {
    // Fallback: try decoded name match (old URL format)
    const decodedName = decodeURIComponent(param);
    const { data: byName } = await supabase
      .from("buildings")
      .select(BUILDING_SELECT)
      .ilike("owner_name", decodedName)
      .order("violation_count", { ascending: false })
      .limit(500);
    return byName && byName.length > 0 ? byName : null;
  }

  // Step 2: Fetch buildings by exact owner_name match
  const { data: buildings } = await supabase
    .from("buildings")
    .select(BUILDING_SELECT)
    .eq("owner_name", ownerName)
    .order("violation_count", { ascending: false })
    .limit(500);

  return buildings && buildings.length > 0 ? buildings : null;
}

// Shared lookup — used by both generateMetadata and the page to avoid duplicate queries
async function lookupLandlordName(slug: string) {
  const supabase = await createClient();
  const { data: statsRows } = await supabase
    .from("landlord_stats")
    .select("name")
    .eq("slug", slug)
    .limit(1);
  return statsRows?.[0]?.name || decodeURIComponent(slug);
}

export async function generateMetadata({
  params,
}: LandlordPageProps): Promise<Metadata> {
  const { name } = await params;
  const displayName = await lookupLandlordName(name);

  const title = `${displayName} — Buildings, Violations & Tenant Reviews`;
  const description = `Renting from ${displayName}? See every building they own, their full violation record, and real tenant reviews — all in one place.`;
  const url = canonicalUrl(landlordUrl(displayName));

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "Lucid Rents",
      type: "website",
    },
  };
}

export default async function LandlordDetailPage({
  params,
}: LandlordPageProps) {
  const { city: cityParam, name } = await params;
  const city = (cityParam || "nyc") as import("@/lib/cities").City;
  const supabase = await createClient();

  const [buildings, cityAvgRpc] = await Promise.all([
    findBuildings(supabase, name),
    supabase.rpc("city_avg_score", { p_metro: city }),
  ]);
  if (!buildings || buildings.length === 0) notFound();

  const cityAvgScore = typeof cityAvgRpc.data === "number" ? cityAvgRpc.data : 5;

  // If found via old URL format, redirect to slug URL
  if (buildings[0].owner_name) {
    const correctSlug = landlordSlug(buildings[0].owner_name);
    if (correctSlug !== name) {
      permanentRedirect(cityPath(`/landlord/${correctSlug}`));
    }
  }

  // Aggregate stats
  const totalBuildings = buildings.length;
  const totalViolations = buildings.reduce(
    (sum, b) => sum + (b.violation_count || 0),
    0
  );
  const totalComplaints = buildings.reduce(
    (sum, b) => sum + (b.complaint_count || 0),
    0
  );
  const totalLitigations = buildings.reduce(
    (sum, b) => sum + (b.litigation_count || 0),
    0
  );
  const totalDobViolations = buildings.reduce(
    (sum, b) => sum + (b.dob_violation_count || 0),
    0
  );
  const avgScore = (() => {
    const scores = buildings.map((b) =>
      b.overall_score ?? deriveScore(b.violation_count || 0, b.complaint_count || 0)
    );
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  })();
  const totalUnits = buildings.reduce(
    (sum, b) => sum + (b.total_units || 0),
    0
  );

  // Use the owner_name from first building for display (preserves original casing)
  const displayName = buildings[0].owner_name || decodeURIComponent(name);

  const diff = avgScore - cityAvgScore;
  const isAboveAverage = diff > 0;

  const stats = [
    { label: "Buildings", value: totalBuildings, icon: Building2, color: "#3B82F6" },
    { label: "HPD Violations", value: totalViolations, icon: AlertTriangle, color: "#EF4444" },
    { label: "311 Complaints", value: totalComplaints, icon: MessageSquare, color: "#F59E0B" },
    { label: "Litigations", value: totalLitigations, icon: Scale, color: "#8B5CF6" },
    { label: "DOB Violations", value: totalDobViolations, icon: HardHat, color: "#3B82F6" },
    { label: "Total Units", value: totalUnits > 0 ? totalUnits : null, icon: Users, color: "#64748b" },
  ];

  return (
    <AdSidebar>
    <div>
      <JsonLd data={landlordJsonLd(displayName, totalBuildings)} />
      <JsonLd data={breadcrumbJsonLd([
        { name: "Home", url: "/" },
        { name: "Landlords", url: cityPath("/landlords") },
        { name: displayName, url: landlordUrl(displayName) },
      ])} />

      {/* Hero header */}
      <div className="bg-gradient-to-br from-[#0F1D2E] via-[#162a45] to-[#1a3352] relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTTYwIDBIMHY2MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDMpIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IGZpbGw9InVybCgjZykiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIvPjwvc3ZnPg==')] opacity-50" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-10 relative">
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Landlords", href: cityPath("/landlords") },
              { label: displayName, href: landlordUrl(displayName) },
            ]}
            variant="dark"
          />

          <Link
            href={cityPath("/landlords")}
            className="inline-flex items-center gap-1.5 text-sm text-blue-300 hover:text-blue-200 font-medium mb-6 mt-3 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Landlord Directory
          </Link>

          <div className="flex items-start gap-5">
            <LetterGrade score={avgScore} size="lg" showScore />
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-white">
                {displayName}
              </h1>
              <p className="text-blue-200/80 mt-1.5 text-sm sm:text-base">
                Property owner with {totalBuildings} building
                {totalBuildings !== 1 ? "s" : ""} in New York City
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                  isAboveAverage
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "bg-red-500/20 text-red-300 border border-red-500/30"
                }`}>
                  {avgScore.toFixed(1)}/10 avg
                  <span className="opacity-70">vs {cityAvgScore.toFixed(1)} city avg</span>
                </span>
                {totalUnits > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white/10 text-blue-200 border border-white/10">
                    <Users className="w-3 h-3" />
                    {totalUnits.toLocaleString()} units
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats bar — pulls up into the hero */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm hover:shadow-md transition-shadow p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${stat.color}14` }}>
                    <Icon className="w-3.5 h-3.5" style={{ color: stat.color }} />
                  </div>
                  <p className="text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider">
                    {stat.label}
                  </p>
                </div>
                <p className="text-2xl font-bold text-[#0F1D2E]">
                  {stat.value !== null ? stat.value.toLocaleString() : "---"}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Worst Buildings */}
        {buildings.length > 1 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
              </div>
              <h2 className="text-lg font-bold text-[#0F1D2E]">Worst Buildings</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {buildings.slice(0, 3).map((b, i) => {
                const score = b.overall_score ?? deriveScore(b.violation_count || 0, b.complaint_count || 0);
                return (
                  <Link key={b.id} href={buildingUrl(b, city)}>
                    <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm hover:shadow-md hover:border-red-200 p-4 transition-all group relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-[#EF4444] to-[#F59E0B] rounded-l-xl" />
                      <div className="pl-2">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-xs font-bold text-[#EF4444] bg-red-50 w-5 h-5 rounded flex items-center justify-center">#{i + 1}</span>
                          <p className="text-sm font-semibold text-[#0F1D2E] truncate group-hover:text-[#3B82F6] transition-colors flex-1">{b.full_address}</p>
                          <LetterGrade score={score} size="sm" />
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                          <span className="text-[#EF4444] font-semibold">{(b.violation_count || 0).toLocaleString()} violations</span>
                          <span className="text-[#64748b]">{(b.complaint_count || 0).toLocaleString()} complaints</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Violation Trend */}
        <div className="mb-8">
          <LandlordViolationTrend landlordName={displayName} />
        </div>

        {/* Tenant Resources */}
        <LandlordActionLinks compareIds={buildings.slice(0, 3).map((b) => b.id)} />

        <AdBlock adSlot="LANDLORD_BOTTOM" adFormat="horizontal" />

        {/* Buildings section */}
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#0F1D2E]">
              Building Portfolio
            </h2>
            <p className="text-sm text-[#64748b] mt-1">
              {totalBuildings} propert{totalBuildings !== 1 ? "ies" : "y"} owned by {displayName}
            </p>
          </div>
          <span className="text-xs font-medium text-[#94a3b8] bg-[#f1f5f9] px-3 py-1.5 rounded-full">
            Sorted by violations
          </span>
        </div>

        {/* Building cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {buildings.map((building) => {
            const score = building.overall_score ?? deriveScore(building.violation_count || 0, building.complaint_count || 0);
            return (
              <Link key={building.id} href={buildingUrl(building, city)}>
                <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm hover:shadow-md hover:border-[#cbd5e1] transition-all h-full p-5 group">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[#0F1D2E] truncate group-hover:text-[#3B82F6] transition-colors">
                        {building.full_address}
                      </p>
                      <div className="flex items-center gap-1 text-xs text-[#94a3b8] mt-0.5">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        <span>
                          {building.borough}
                          {building.zip_code && ` ${building.zip_code}`}
                        </span>
                      </div>
                    </div>
                    <LetterGrade score={score} size="sm" />
                  </div>

                  {/* Building info row */}
                  <div className="flex items-center gap-1 text-xs text-[#64748b] mb-3">
                    {building.year_built && (
                      <span>Built {building.year_built}</span>
                    )}
                    {building.year_built && building.total_units && (
                      <span className="mx-1">&middot;</span>
                    )}
                    {building.total_units && (
                      <span>{building.total_units} units</span>
                    )}
                    {building.num_floors && (
                      <>
                        <span className="mx-1">&middot;</span>
                        <span>{building.num_floors} floors</span>
                      </>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-3 border-t border-[#f1f5f9]">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle
                        className={`w-3.5 h-3.5 ${
                          (building.violation_count || 0) > 10
                            ? "text-[#EF4444]"
                            : "text-[#94a3b8]"
                        }`}
                      />
                      <span
                        className={`text-sm font-semibold ${
                          (building.violation_count || 0) > 10
                            ? "text-[#EF4444]"
                            : "text-[#64748b]"
                        }`}
                      >
                        {(building.violation_count || 0).toLocaleString()}
                      </span>
                      <span className="text-xs text-[#94a3b8]">violations</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MessageSquare
                        className={`w-3.5 h-3.5 ${
                          (building.complaint_count || 0) > 10
                            ? "text-[#F59E0B]"
                            : "text-[#94a3b8]"
                        }`}
                      />
                      <span
                        className={`text-sm font-semibold ${
                          (building.complaint_count || 0) > 10
                            ? "text-[#F59E0B]"
                            : "text-[#64748b]"
                        }`}
                      >
                        {(building.complaint_count || 0).toLocaleString()}
                      </span>
                      <span className="text-xs text-[#94a3b8]">complaints</span>
                    </div>
                    {(building.litigation_count || 0) > 0 && (
                      <div className="flex items-center gap-1.5">
                        <Scale className="w-3.5 h-3.5 text-[#8B5CF6]" />
                        <span className="text-sm font-semibold text-[#8B5CF6]">
                          {(building.litigation_count || 0).toLocaleString()}
                        </span>
                        <span className="text-xs text-[#94a3b8]">litigations</span>
                      </div>
                    )}
                    {(building.dob_violation_count || 0) > 0 && (
                      <div className="flex items-center gap-1.5">
                        <HardHat className="w-3.5 h-3.5 text-[#3B82F6]" />
                        <span className="text-sm font-semibold text-[#3B82F6]">
                          {(building.dob_violation_count || 0).toLocaleString()}
                        </span>
                        <span className="text-xs text-[#94a3b8]">DOB</span>
                      </div>
                    )}
                  </div>

                  {/* View link */}
                  <div className="mt-3 flex items-center gap-1 text-xs font-medium text-[#3B82F6] opacity-0 group-hover:opacity-100 transition-opacity">
                    <ExternalLink className="w-3 h-3" />
                    View building details
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
    </AdSidebar>
  );
}

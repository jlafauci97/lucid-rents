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
import { Card, CardContent } from "@/components/ui/Card";
import { LetterGrade } from "@/components/ui/LetterGrade";
import { LandlordViolationTrend } from "@/components/landlord/LandlordViolationTrend";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { landlordSlug, landlordUrl, landlordJsonLd, breadcrumbJsonLd, canonicalUrl, buildingUrl, cityPath } from "@/lib/seo";
import { deriveScore } from "@/lib/constants";
import { AdSidebar } from "@/components/ui/AdSidebar";
import { AdBlock } from "@/components/ui/AdBlock";
import type { Metadata } from "next";

export const revalidate = 86400;

interface LandlordPageProps {
  params: Promise<{ name: string }>;
}

const BUILDING_SELECT =
  "id, full_address, borough, zip_code, year_built, total_units, num_floors, owner_name, slug, overall_score, violation_count, complaint_count, litigation_count, dob_violation_count, review_count";

async function findBuildings(supabase: Awaited<ReturnType<typeof createClient>>, param: string) {
  // Try slug match first (new format)
  const { data: bySlug } = await supabase.rpc("landlord_slug", { name: "" });
  // Actually query using SQL function matching
  const { data: buildings } = await supabase
    .from("buildings")
    .select(BUILDING_SELECT)
    .not("owner_name", "is", null)
    .order("violation_count", { ascending: false })
    .limit(10000);

  if (!buildings) return null;

  // Filter by slug match
  const slugMatches = buildings.filter(
    (b) => b.owner_name && landlordSlug(b.owner_name) === param
  );

  if (slugMatches.length > 0) return slugMatches;

  // Fall back to decoded name match (old format)
  const decodedName = decodeURIComponent(param);
  const nameMatches = buildings.filter(
    (b) => b.owner_name?.toLowerCase() === decodedName.toLowerCase()
  );

  return nameMatches.length > 0 ? nameMatches : null;
}

export async function generateMetadata({
  params,
}: LandlordPageProps): Promise<Metadata> {
  const { name } = await params;
  const supabase = await createClient();

  // Quick lookup for owner name
  const { data: buildings } = await supabase
    .from("buildings")
    .select("owner_name")
    .not("owner_name", "is", null)
    .limit(10000);

  let displayName = decodeURIComponent(name);
  if (buildings) {
    const match = buildings.find(
      (b) => b.owner_name && landlordSlug(b.owner_name) === name
    );
    if (match) displayName = match.owner_name;
  }

  const title = `${displayName} - Landlord Portfolio | Lucid Rents`;
  const description = `View all buildings, violations, and complaints for landlord ${displayName} in New York City.`;
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
  const { name } = await params;
  const supabase = await createClient();

  // Try slug-based lookup first
  const { data: allBuildings } = await supabase
    .from("buildings")
    .select(BUILDING_SELECT)
    .not("owner_name", "is", null)
    .order("violation_count", { ascending: false })
    .limit(10000);

  if (!allBuildings) notFound();

  // Match by slug
  let buildings = allBuildings.filter(
    (b) => b.owner_name && landlordSlug(b.owner_name) === name
  );

  // Fall back to decoded name (old URL format)
  if (buildings.length === 0) {
    const decodedName = decodeURIComponent(name);
    buildings = allBuildings.filter(
      (b) => b.owner_name?.toLowerCase() === decodedName.toLowerCase()
    );

    // If found via old format, redirect to slug URL
    if (buildings.length > 0 && buildings[0].owner_name) {
      const slug = landlordSlug(buildings[0].owner_name);
      if (slug !== name) {
        permanentRedirect(`/landlord/${slug}`);
      }
    }
  }

  if (buildings.length === 0) notFound();

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

  return (
    <AdSidebar>
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <JsonLd data={landlordJsonLd(displayName, totalBuildings)} />
      <JsonLd data={breadcrumbJsonLd([
        { name: "Home", url: "/" },
        { name: "Landlords", url: cityPath("/landlords") },
        { name: displayName, url: landlordUrl(displayName) },
      ])} />
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Landlords", href: cityPath("/landlords") },
          { label: displayName, href: landlordUrl(displayName) },
        ]}
      />

      {/* Back link */}
      <Link
        href={cityPath("/landlords")}
        className="inline-flex items-center gap-1.5 text-sm text-[#3B82F6] hover:text-[#2563EB] font-medium mb-6 mt-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Landlord Directory
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start gap-4">
          <LetterGrade score={avgScore} size="lg" showScore />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#0F1D2E]">
              {displayName}
            </h1>
            <p className="text-[#64748b] mt-1">
              Property owner with {totalBuildings} building
              {totalBuildings !== 1 ? "s" : ""} in New York City
            </p>
          </div>
        </div>
      </div>

      {/* Aggregate stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-4">
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="w-4 h-4 text-[#3B82F6]" />
            <p className="text-xs font-medium text-[#94a3b8] uppercase tracking-wide">
              Buildings
            </p>
          </div>
          <p className="text-2xl font-bold text-[#0F1D2E]">
            {totalBuildings.toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
            <p className="text-xs font-medium text-[#94a3b8] uppercase tracking-wide">
              HPD Violations
            </p>
          </div>
          <p className="text-2xl font-bold text-[#0F1D2E]">
            {totalViolations.toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-4">
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare className="w-4 h-4 text-[#F59E0B]" />
            <p className="text-xs font-medium text-[#94a3b8] uppercase tracking-wide">
              311 Complaints
            </p>
          </div>
          <p className="text-2xl font-bold text-[#0F1D2E]">
            {totalComplaints.toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-4">
          <div className="flex items-center gap-2 mb-1">
            <Scale className="w-4 h-4 text-[#8B5CF6]" />
            <p className="text-xs font-medium text-[#94a3b8] uppercase tracking-wide">
              Litigations
            </p>
          </div>
          <p className="text-2xl font-bold text-[#0F1D2E]">
            {totalLitigations.toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-4">
          <div className="flex items-center gap-2 mb-1">
            <HardHat className="w-4 h-4 text-[#3B82F6]" />
            <p className="text-xs font-medium text-[#94a3b8] uppercase tracking-wide">
              DOB Violations
            </p>
          </div>
          <p className="text-2xl font-bold text-[#0F1D2E]">
            {totalDobViolations.toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-4">
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="w-4 h-4 text-[#64748b]" />
            <p className="text-xs font-medium text-[#94a3b8] uppercase tracking-wide">
              Total Units
            </p>
          </div>
          <p className="text-2xl font-bold text-[#0F1D2E]">
            {totalUnits > 0 ? totalUnits.toLocaleString() : "---"}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-4">
          <p className="text-xs font-medium text-[#94a3b8] uppercase tracking-wide mb-1">
            Portfolio Grade
          </p>
          <LetterGrade score={avgScore} size="md" showScore />
        </div>
      </div>

      {/* Worst Buildings */}
      {buildings.length > 1 && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-[#0F1D2E] mb-3">
            <AlertTriangle className="inline w-5 h-5 text-[#EF4444] mr-1.5 -mt-0.5" />
            Worst Buildings
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {buildings.slice(0, 3).map((b) => {
              const score = b.overall_score ?? deriveScore(b.violation_count || 0, b.complaint_count || 0);
              return (
                <Link key={b.id} href={buildingUrl(b)}>
                  <div className="bg-white rounded-xl border-2 border-red-100 hover:border-red-200 p-4 transition-colors">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-sm font-semibold text-[#0F1D2E] truncate">{b.full_address}</p>
                      <LetterGrade score={score} size="sm" />
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[#64748b]">
                      <span className="text-[#EF4444] font-semibold">{(b.violation_count || 0).toLocaleString()} violations</span>
                      <span>{(b.complaint_count || 0).toLocaleString()} complaints</span>
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

      <AdBlock adSlot="LANDLORD_BOTTOM" adFormat="horizontal" />

      {/* Buildings section */}
      <div className="mb-4">
        <h2 className="text-xl font-bold text-[#0F1D2E]">
          Building Portfolio ({totalBuildings})
        </h2>
        <p className="text-sm text-[#64748b] mt-1">
          All properties owned by {displayName}, sorted by violation count
        </p>
      </div>

      {/* Building cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {buildings.map((building) => {
          const score = building.overall_score ?? deriveScore(building.violation_count || 0, building.complaint_count || 0);
          return (
            <Link key={building.id} href={buildingUrl(building)}>
              <Card hover className="h-full">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[#0F1D2E] truncate">
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
                      <span className="mx-1">-</span>
                    )}
                    {building.total_units && (
                      <span>{building.total_units} units</span>
                    )}
                    {building.num_floors && (
                      <>
                        <span className="mx-1">-</span>
                        <span>{building.num_floors} floors</span>
                      </>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-3 border-t border-[#e2e8f0]">
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
                  <div className="mt-3 flex items-center gap-1 text-xs font-medium text-[#3B82F6]">
                    <ExternalLink className="w-3 h-3" />
                    View building details
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
    </AdSidebar>
  );
}

import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BuildingHeader } from "@/components/building/BuildingHeader";
import { IssuesTabs } from "@/components/building/IssuesTabs";
import { ViolationTrend } from "@/components/building/ViolationTrend";
import { ViolationsByUnit } from "@/components/building/ViolationsByUnit";
import { ReviewCard } from "@/components/review/ReviewCard";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { MonitorButton } from "@/components/building/MonitorButton";
import { NearbyCrimeSummary } from "@/components/crime/NearbyCrimeSummary";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { SLUG_TO_BOROUGH, buildingUrl, canonicalUrl, buildingJsonLd, landlordUrl } from "@/lib/seo";
import { AdSidebar } from "@/components/ui/AdSidebar";
import { AdBlock } from "@/components/ui/AdBlock";
import { PenSquare } from "lucide-react";
import type { Building, HpdViolation, Complaint311, HpdLitigation, DobViolation, ReviewWithDetails } from "@/types";
import type { Metadata } from "next";

export const revalidate = 86400; // 24h ISR

interface BuildingSlugPageProps {
  params: Promise<{ borough: string; slug: string }>;
}

async function getBuilding(boroughSlug: string, slug: string) {
  const borough = SLUG_TO_BOROUGH[boroughSlug];
  if (!borough) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("buildings")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!data) return null;
  // Verify borough matches
  if (data.borough !== borough) return null;
  return data as Building;
}

export async function generateMetadata({
  params,
}: BuildingSlugPageProps): Promise<Metadata> {
  const { borough, slug } = await params;
  const building = await getBuilding(borough, slug);

  if (!building) return { title: "Building Not Found" };

  const title = `${building.full_address} | Lucid Rents`;
  const description = `View ${building.violation_count} violations, ${building.complaint_count} complaints, and tenant reviews for ${building.full_address} in ${building.borough}, NYC.`;
  const url = canonicalUrl(buildingUrl(building));

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
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function BuildingSlugPage({ params }: BuildingSlugPageProps) {
  const { borough: boroughSlug, slug } = await params;
  const building = await getBuilding(boroughSlug, slug);

  if (!building) notFound();

  const supabase = await createClient();
  const buildingId = building.id;

  // Fetch violations, complaints, litigations, DOB violations, reviews, and units in parallel
  const [violationsRes, complaintsRes, litigationsRes, dobViolationsRes, reviewsRes, unitsRes, violationSummaryRes] = await Promise.all([
    supabase
      .from("hpd_violations")
      .select("*")
      .eq("building_id", buildingId)
      .order("inspection_date", { ascending: false })
      .limit(20),
    supabase
      .from("complaints_311")
      .select("*")
      .eq("building_id", buildingId)
      .order("created_date", { ascending: false })
      .limit(20),
    supabase
      .from("hpd_litigations")
      .select("*")
      .eq("building_id", buildingId)
      .order("case_open_date", { ascending: false })
      .limit(20),
    supabase
      .from("dob_violations")
      .select("*")
      .eq("building_id", buildingId)
      .order("issue_date", { ascending: false })
      .limit(20),
    supabase
      .from("reviews")
      .select(
        `*, profile:profiles(id, display_name, avatar_url), category_ratings:review_category_ratings(*, category:review_categories(slug, name, icon)), unit:units(unit_number)`
      )
      .eq("building_id", buildingId)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("units")
      .select("*")
      .eq("building_id", buildingId)
      .order("unit_number", { ascending: true }),
    supabase
      .from("hpd_violations")
      .select("apartment, class, status, inspection_date")
      .eq("building_id", buildingId),
  ]);

  const violations = (violationsRes.data || []) as HpdViolation[];
  const complaints = (complaintsRes.data || []) as Complaint311[];
  const litigations = (litigationsRes.data || []) as HpdLitigation[];
  const dobViolations = (dobViolationsRes.data || []) as DobViolation[];
  const reviews = (reviewsRes.data || []) as unknown as ReviewWithDetails[];
  const units = unitsRes.data || [];
  const violationSummaries = violationSummaryRes.data || [];

  // Check if user is monitoring this building
  let isMonitored = false;
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: monitorData } = await supabase
      .from("monitored_buildings")
      .select("id")
      .eq("user_id", user.id)
      .eq("building_id", buildingId)
      .single();
    isMonitored = !!monitorData;
  }

  // Extract short address for breadcrumb
  const shortAddress = building.full_address.split(",")[0]?.trim() || building.full_address;

  return (
    <AdSidebar>
    <div>
      <JsonLd data={buildingJsonLd(building)} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-2">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Buildings", href: "/buildings" },
            { label: building.borough, href: `/buildings/${boroughSlug}` },
            { label: shortAddress, href: buildingUrl(building) },
          ]}
        />
      </div>

      <BuildingHeader building={building} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-8">
            {/* Reviews */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-[#0F1D2E]">
                  Tenant Reviews ({reviews.length})
                </h2>
                <div className="flex items-center gap-2">
                  <MonitorButton buildingId={buildingId} initialMonitored={isMonitored} />
                  <Link href={`/review/new?building=${buildingId}`}>
                    <Button size="sm">
                      <PenSquare className="w-4 h-4 mr-2" />
                      Write Review
                    </Button>
                  </Link>
                </div>
              </div>
              {reviews.length > 0 ? (
                <div className="space-y-4">
                  {reviews.map((review) => (
                    <ReviewCard key={review.id} review={review} />
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent>
                    <p className="text-center text-[#64748b] py-8">
                      No reviews yet. Be the first to review this building!
                    </p>
                  </CardContent>
                </Card>
              )}
            </section>

            <AdBlock adSlot="BUILDING_MID_1" adFormat="horizontal" />

            {/* Violation & Complaint Trends */}
            <ViolationTrend buildingId={buildingId} />

            {/* Violations by Unit Breakdown */}
            <ViolationsByUnit
              violationSummaries={violationSummaries}
              units={units}
              buildingId={buildingId}
            />

            <AdBlock adSlot="BUILDING_MID_2" adFormat="horizontal" />

            {/* Violations & Complaints Tabs */}
            <IssuesTabs violations={violations} complaints={complaints} litigations={litigations} dobViolations={dobViolations} />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Building Info */}
            <Card>
              <CardHeader>
                <h3 className="font-semibold text-[#0F1D2E]">
                  Building Details
                </h3>
              </CardHeader>
              <CardContent>
                <dl className="space-y-3 text-sm">
                  {building.owner_name && (
                    <div>
                      <dt className="text-[#94a3b8]">Owner</dt>
                      <dd className="text-[#0F1D2E] font-medium">
                        {building.owner_name}
                      </dd>
                      <Link
                        href={landlordUrl(building.owner_name)}
                        className="text-xs text-[#3B82F6] hover:text-[#2563EB] font-medium mt-0.5 inline-block transition-colors"
                      >
                        View Portfolio &rarr;
                      </Link>
                    </div>
                  )}
                  {building.building_class && (
                    <div>
                      <dt className="text-[#94a3b8]">Building Class</dt>
                      <dd className="text-[#0F1D2E] font-medium">
                        {building.building_class}
                      </dd>
                    </div>
                  )}
                  {building.land_use && (
                    <div>
                      <dt className="text-[#94a3b8]">Land Use</dt>
                      <dd className="text-[#0F1D2E] font-medium">
                        {building.land_use}
                      </dd>
                    </div>
                  )}
                  {building.residential_units != null && (
                    <div>
                      <dt className="text-[#94a3b8]">Residential Units</dt>
                      <dd className="text-[#0F1D2E] font-medium">
                        {building.residential_units}
                      </dd>
                    </div>
                  )}
                  {building.commercial_units != null &&
                    building.commercial_units > 0 && (
                      <div>
                        <dt className="text-[#94a3b8]">Commercial Units</dt>
                        <dd className="text-[#0F1D2E] font-medium">
                          {building.commercial_units}
                        </dd>
                      </div>
                    )}
                  {building.bbl && (
                    <div>
                      <dt className="text-[#94a3b8]">BBL</dt>
                      <dd className="text-[#0F1D2E] font-mono text-xs">
                        {building.bbl}
                      </dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>

            {/* Neighborhood Crime */}
            {building.zip_code && (
              <NearbyCrimeSummary zipCode={building.zip_code} />
            )}

            {/* Units */}
            {units.length > 0 && (
              <Card>
                <CardHeader>
                  <h3 className="font-semibold text-[#0F1D2E]">
                    Units ({units.length})
                  </h3>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {units.map((unit) => (
                      <Link
                        key={unit.id}
                        href={`${buildingUrl(building)}/unit/${unit.id}`}
                        className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <span className="text-sm font-medium text-[#0F1D2E]">
                          Unit {unit.unit_number}
                        </span>
                        {unit.review_count > 0 && (
                          <span className="text-xs text-[#64748b]">
                            {unit.review_count} review
                            {unit.review_count !== 1 ? "s" : ""}
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
    </AdSidebar>
  );
}

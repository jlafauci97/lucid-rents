import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ViolationTimeline } from "@/components/building/ViolationTimeline";
import { ReviewCard } from "@/components/review/ReviewCard";
import { ScoreGauge } from "@/components/ui/ScoreGauge";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { ArrowLeft, BedDouble, Bath, Layers, Building2 } from "lucide-react";
import type { HpdViolation, ReviewWithDetails } from "@/types";
import type { Metadata } from "next";
import { buildingUrl } from "@/lib/seo";
import { CITY_META, type City } from "@/lib/cities";

interface UnitPageProps {
  params: Promise<{ city: string; borough: string; unitId: string }>;
}

export async function generateMetadata({ params }: UnitPageProps): Promise<Metadata> {
  const { city: cityParam, borough: buildingId, unitId } = await params;
  const city = (cityParam || "nyc") as City;
  const supabase = await createClient();

  const [{ data: unit }, { data: building }] = await Promise.all([
    supabase.from("units").select("unit_number").eq("id", unitId).single(),
    supabase.from("buildings").select("full_address, borough, slug").eq("id", buildingId).single(),
  ]);

  if (!unit || !building) return { title: "Unit Not Found" };

  const cityName = CITY_META[city]?.name || "NYC";
  return {
    title: `Unit ${unit.unit_number} - ${building.full_address}`,
    description: `What's it really like living in Unit ${unit.unit_number} at ${building.full_address}? See tenant reviews, violation history, and unit-specific details.`,
  };
}

export default async function UnitPage({ params }: UnitPageProps) {
  const { borough: buildingId, unitId } = await params;
  const supabase = await createClient();

  // Fetch unit first (need unit_number for violation query)
  const { data: unit } = await supabase
    .from("units")
    .select("*")
    .eq("id", unitId)
    .eq("building_id", buildingId)
    .single();

  if (!unit) notFound();

  // Fetch building, violations, and reviews in parallel
  const [buildingRes, violationsRes, reviewsRes] = await Promise.all([
    supabase
      .from("buildings")
      .select("id, full_address, borough, slug, zip_code, owner_name")
      .eq("id", buildingId)
      .single(),
    supabase
      .from("hpd_violations")
      .select("*")
      .eq("building_id", buildingId)
      .ilike("apartment", unit.unit_number.trim())
      .order("inspection_date", { ascending: false }),
    supabase
      .from("reviews")
      .select(
        `*, profile:profiles(id, display_name, avatar_url), category_ratings:review_category_ratings(*, category:review_categories(slug, name, icon)), unit:units(unit_number)`
      )
      .eq("unit_id", unitId)
      .eq("status", "published")
      .order("created_at", { ascending: false }),
  ]);

  const building = buildingRes.data;
  if (!building) notFound();

  const violations = (violationsRes.data || []) as HpdViolation[];
  const reviews = (reviewsRes.data || []) as unknown as ReviewWithDetails[];

  const openViolations = violations.filter((v) => v.status === "Open").length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back link */}
      <Link
        href={buildingUrl(building)}
        className="inline-flex items-center gap-1.5 text-sm text-[#64748b] hover:text-[#3B82F6] transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to {building.full_address}
      </Link>

      {/* Unit header */}
      <div className="flex items-start gap-4 mb-8">
        {unit.overall_score && (
          <ScoreGauge score={unit.overall_score} size="lg" />
        )}
        <div>
          <h1 className="text-2xl font-bold text-[#0F1D2E]">
            Unit {unit.unit_number}
          </h1>
          <p className="text-[#64748b] mt-1">
            {building.full_address}, {building.borough}
          </p>
          <div className="flex items-center gap-4 mt-2 text-sm text-[#64748b]">
            {unit.floor && (
              <span className="flex items-center gap-1">
                <Layers className="w-4 h-4" />
                Floor {unit.floor}
              </span>
            )}
            {unit.bedrooms != null && (
              <span className="flex items-center gap-1">
                <BedDouble className="w-4 h-4" />
                {unit.bedrooms} {unit.bedrooms === 1 ? "bed" : "beds"}
              </span>
            )}
            {unit.bathrooms != null && (
              <span className="flex items-center gap-1">
                <Bath className="w-4 h-4" />
                {unit.bathrooms} {unit.bathrooms === 1 ? "bath" : "baths"}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-8">
          {/* Reviews */}
          <section>
            <h2 className="text-xl font-bold text-[#0F1D2E] mb-4">
              Reviews ({reviews.length})
            </h2>
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
                    No reviews yet for this unit.
                  </p>
                </CardContent>
              </Card>
            )}
          </section>

          {/* HPD Violations */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-xl font-bold text-[#0F1D2E]">
                HPD Violations ({violations.length})
              </h2>
              {openViolations > 0 && (
                <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-50 text-red-700">
                  {openViolations} open
                </span>
              )}
            </div>
            <ViolationTimeline violations={violations} />
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Unit details */}
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-[#0F1D2E]">Unit Details</h3>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-[#94a3b8]">Unit Number</dt>
                  <dd className="text-[#0F1D2E] font-medium">{unit.unit_number}</dd>
                </div>
                {unit.floor && (
                  <div>
                    <dt className="text-[#94a3b8]">Floor</dt>
                    <dd className="text-[#0F1D2E] font-medium">{unit.floor}</dd>
                  </div>
                )}
                {unit.bedrooms != null && (
                  <div>
                    <dt className="text-[#94a3b8]">Bedrooms</dt>
                    <dd className="text-[#0F1D2E] font-medium">{unit.bedrooms}</dd>
                  </div>
                )}
                {unit.bathrooms != null && (
                  <div>
                    <dt className="text-[#94a3b8]">Bathrooms</dt>
                    <dd className="text-[#0F1D2E] font-medium">{unit.bathrooms}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-[#94a3b8]">Reviews</dt>
                  <dd className="text-[#0F1D2E] font-medium">{unit.review_count}</dd>
                </div>
                <div>
                  <dt className="text-[#94a3b8]">HPD Violations</dt>
                  <dd className="text-[#0F1D2E] font-medium">
                    {violations.length}
                    {openViolations > 0 && (
                      <span className="text-red-600 ml-1">({openViolations} open)</span>
                    )}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {/* Building context */}
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-[#0F1D2E]">Building</h3>
            </CardHeader>
            <CardContent>
              <Link
                href={buildingUrl(building)}
                className="flex items-start gap-3 group"
              >
                <Building2 className="w-5 h-5 text-[#3B82F6] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-[#0F1D2E] group-hover:text-[#3B82F6] transition-colors">
                    {building.full_address}
                  </p>
                  <p className="text-xs text-[#94a3b8] mt-0.5">
                    {building.borough}
                    {building.zip_code ? `, ${building.zip_code}` : ""}
                  </p>
                  {building.owner_name && (
                    <p className="text-xs text-[#94a3b8] mt-1">
                      Owner: {building.owner_name}
                    </p>
                  )}
                </div>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

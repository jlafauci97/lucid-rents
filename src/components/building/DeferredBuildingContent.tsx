import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ReviewSection } from "@/components/review/ReviewSection";
import { ViolationsByUnit } from "@/components/building/ViolationsByUnit";
import { MarketListings } from "@/components/building/MarketListings";
import { BuildingAmenities } from "@/components/building/BuildingAmenities";
import { RentRangeCard } from "@/components/building/RentRangeCard";
import { IssuesTabs } from "@/components/building/IssuesTabs";
import { SaveButton } from "@/components/building/SaveButton";
import { ShareButton } from "@/components/building/ShareButton";
import { AdBlock } from "@/components/ui/AdBlock";
import { canonicalUrl, buildingUrl } from "@/lib/seo";
import { Clock } from "lucide-react";
import { BuildingLocationMap } from "@/components/building/BuildingLocationMap";
import { ViolationTrend } from "@/components/building/ViolationTrend";
import { RentIntelligence } from "@/components/building/RentIntelligence";
import { VerdictBanner } from "@/components/building/VerdictBanner";
import { ReportCard } from "@/components/building/ReportCard";
import { AmenityPremiums } from "@/components/building/AmenityPremiums";
import { CommonIssues } from "@/components/building/CommonIssues";
import { getLetterGrade, deriveScore } from "@/lib/constants";
import type { City } from "@/lib/cities";
import type { Building, HpdViolation, Complaint311, HpdLitigation, DobViolation, BedBugReport, Eviction, DobPermit, ReviewWithDetails, LahdViolationSummary } from "@/types";

interface DeferredBuildingContentProps {
  building: Building;
  buildingId: string;
  city: City;
  rents: { bedrooms: number; min_rent: number; max_rent: number; median_rent: number; listing_count: number; source: string }[];
}

// Helper: wrap each query so a single failure doesn't kill the section
const safe = <T,>(promise: PromiseLike<{ data: T | null; error: unknown }>, fallback: T): Promise<T> =>
  Promise.resolve(promise).then(({ data, error }) => {
    if (error) console.error("Supabase query error:", error);
    return data ?? fallback;
  }).catch((err: unknown) => {
    console.error("Supabase query exception:", err);
    return fallback;
  });

export async function DeferredBuildingContent({ building, buildingId, city, rents }: DeferredBuildingContentProps) {
  const supabase = await createClient();

  const isLA = city === "los-angeles";
  const isChicago = city === "chicago";
  const isNYC = city === "nyc";

  const [violations, complaints, litigations, dobViolations, bedbugs, evictions, permits, reviews, units, violationSummaries, amenities, marketListings, rentHistory, authStatus, lahdViolationSummary, deweyBuildingRents, deweyNeighborhoodRents, deweyAmenityPremiums, deweySeasonalIndex] = await Promise.all([
    safe(supabase.from("hpd_violations").select("*").eq("building_id", buildingId).order("inspection_date", { ascending: false }).limit(20), [] as HpdViolation[]),
    safe(supabase.from("complaints_311").select("*").eq("building_id", buildingId).order("created_date", { ascending: false }).limit(20), [] as Complaint311[]),
    isNYC ? safe(supabase.from("hpd_litigations").select("*").eq("building_id", buildingId).order("case_open_date", { ascending: false }).limit(20), [] as HpdLitigation[]) : Promise.resolve([] as HpdLitigation[]),
    (isNYC || isChicago) ? safe(supabase.from("dob_violations").select("*").eq("building_id", buildingId).order("issue_date", { ascending: false }).limit(20), [] as DobViolation[]) : Promise.resolve([] as DobViolation[]),
    isNYC ? safe(supabase.from("bedbug_reports").select("*").eq("building_id", buildingId).order("filing_date", { ascending: false }).limit(20), [] as BedBugReport[]) : Promise.resolve([] as BedBugReport[]),
    isNYC ? safe(supabase.from("evictions").select("*").eq("building_id", buildingId).order("executed_date", { ascending: false }).limit(20), [] as Eviction[]) : Promise.resolve([] as Eviction[]),
    safe(supabase.from("dob_permits").select("*").eq("building_id", buildingId).order("issued_date", { ascending: false }).limit(20), [] as DobPermit[]),
    safe(supabase.from("reviews").select(`*, profile:profiles(id, display_name, avatar_url), category_ratings:review_category_ratings(*, category:review_categories(slug, name, icon)), unit:units(unit_number)`).eq("building_id", buildingId).eq("status", "published").order("created_at", { ascending: false }).limit(10), []) as Promise<ReviewWithDetails[]>,
    safe(supabase.from("units").select("*").eq("building_id", buildingId).order("unit_number", { ascending: true }), []),
    safe(supabase.from("hpd_violations").select("id, apartment, class, status, inspection_date, nov_description").eq("building_id", buildingId).order("inspection_date", { ascending: false }).limit(200), []),
    safe(supabase.from("building_amenities").select("amenity, category, source").eq("building_id", buildingId), []),
    safe(supabase.from("building_listings").select("*").eq("building_id", buildingId), []),
    safe(supabase.from("unit_rent_history").select("id, unit_number, bedrooms, bathrooms, rent, sqft, source, observed_at").eq("building_id", buildingId).order("observed_at", { ascending: false }).limit(100), []),
    (async (): Promise<{ monitored: boolean; saved: boolean }> => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { monitored: false, saved: false };
        const [monitorRes, saveRes] = await Promise.all([
          supabase.from("monitored_buildings").select("id").eq("user_id", user.id).eq("building_id", buildingId).single(),
          supabase.from("saved_buildings").select("id").eq("user_id", user.id).eq("building_id", buildingId).single(),
        ]);
        return { monitored: !!monitorRes.data, saved: !!saveRes.data };
      } catch {
        return { monitored: false, saved: false };
      }
    })(),
    isLA
      ? safe(supabase.from("lahd_violation_summary").select("id, building_id, violation_type, violations_cited, violations_cleared").eq("building_id", buildingId).order("violations_cited", { ascending: false }).limit(50), [] as LahdViolationSummary[])
      : Promise.resolve([] as LahdViolationSummary[]),
    // Dewey rent intelligence data
    safe(supabase.from("dewey_building_rents").select("month, beds, median_rent, min_rent, max_rent, avg_sqft, avg_price_per_sqft, listing_count").eq("building_id", buildingId).order("month", { ascending: true }), []),
    building.zip_code
      ? safe(supabase.from("dewey_neighborhood_rents").select("month, beds, median_rent, p25_rent, p75_rent").eq("zip", building.zip_code).order("month", { ascending: true }), [])
      : Promise.resolve([]),
    building.zip_code
      ? safe(supabase.from("dewey_amenity_premiums").select("amenity, premium_dollars, premium_pct, sample_size").eq("city", city).eq("zip", building.zip_code).eq("period", "all_time"), [])
      : Promise.resolve([]),
    building.zip_code
      ? safe(supabase.from("dewey_seasonal_index").select("month_of_year, rent_index").eq("city", city).eq("zip", building.zip_code), [])
      : Promise.resolve([]),
  ]);

  const shortAddress = building.full_address.split(",")[0]?.trim() || building.full_address;

  // Verdict banner computations
  const recommendPct = reviews.length > 0
    ? Math.round((reviews.filter(r => (r.overall_rating ?? 0) >= 3).length / reviews.length) * 100)
    : 0;

  const dateFmt = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", year: "numeric" });

  // Find best positive review (highest rated WITH body text)
  const reviewsWithBody = reviews.filter(r => r.body && r.body.trim().length > 0);
  const positivePool = reviewsWithBody.filter(r => (r.overall_rating ?? 0) >= 3);
  const criticalPool = reviewsWithBody.filter(r => (r.overall_rating ?? 0) < 3);

  const bestPositiveReview = positivePool.length > 0
    ? positivePool.reduce((best, r) => ((r.overall_rating ?? 0) > (best.overall_rating ?? 0) ? r : best), positivePool[0])
    : reviewsWithBody.length > 0 ? reviewsWithBody[0] : null;
  const bestCriticalReview = criticalPool.length > 0
    ? criticalPool.reduce((worst, r) => ((r.overall_rating ?? 0) < (worst.overall_rating ?? 0) ? r : worst), criticalPool[0])
    : null;

  const bestPositive = bestPositiveReview
    ? { text: bestPositiveReview.body!.slice(0, 150), author: bestPositiveReview.profile?.display_name || "Anonymous", date: dateFmt(bestPositiveReview.created_at) }
    : null;
  const bestCritical = bestCriticalReview
    ? { text: bestCriticalReview.body!.slice(0, 150), author: bestCriticalReview.profile?.display_name || "Anonymous", date: dateFmt(bestCriticalReview.created_at) }
    : null;

  return (
    <>
      {/* Verdict Banner */}
      <VerdictBanner
        recommendPct={recommendPct}
        reviewCount={reviews.length}
        bestPositive={bestPositive}
        bestCritical={bestCritical}
      />

      {/* Report Card */}
      {(() => {
        // Aggregate review category ratings into per-dimension scores
        const categoryScores = new Map<string, { total: number; count: number; name: string }>();
        for (const review of reviews) {
          for (const cr of review.category_ratings || []) {
            const slug = cr.category?.slug || "unknown";
            const name = cr.category?.name || slug;
            const existing = categoryScores.get(slug) || { total: 0, count: 0, name };
            existing.total += cr.rating;
            existing.count += 1;
            categoryScores.set(slug, existing);
          }
        }

        const gradeDimensions = [...categoryScores.entries()]
          .map(([, { total, count, name }]) => {
            const avg = total / count;
            const grade = getLetterGrade(avg);
            return { label: name, grade, score: Math.round(avg * 10) / 10 };
          })
          .sort((a, b) => b.score - a.score);

        const rcOverallScore = building.overall_score ?? deriveScore(building.violation_count || 0, building.complaint_count || 0);
        const rcOverallGrade = getLetterGrade(rcOverallScore);
        const summaryText = rcOverallScore >= 4 ? "Excellent building — top-rated by tenants with minimal issues."
          : rcOverallScore >= 3 ? "Good building with responsive management and moderate concerns."
          : rcOverallScore >= 2 ? "Decent building but has room for improvement in some areas."
          : rcOverallScore >= 1 ? "Below average — tenants report significant concerns."
          : "Poor conditions — multiple serious issues reported by tenants.";

        return (
          <ReportCard
            overallGrade={rcOverallGrade}
            overallScore={rcOverallScore}
            summary={summaryText}
            grades={gradeDimensions}
          />
        );
      })()}

      {/* Rent Intelligence (Dewey Data) */}
      {deweyBuildingRents && deweyBuildingRents.length > 0 && (() => {
        // Compute value grade: compare building median to neighborhood median
        const latestMonth = deweyBuildingRents[deweyBuildingRents.length - 1]?.month;
        const latestBuildingRows = deweyBuildingRents.filter((r: any) => r.month === latestMonth);
        const latestNeighborhoodRows = (deweyNeighborhoodRents || []).filter((r: any) => r.month === latestMonth);

        let computedValueGrade = "C"; // default
        if (latestBuildingRows.length > 0 && latestNeighborhoodRows.length > 0) {
          // Weighted average across bed counts
          let totalDiff = 0;
          let totalWeight = 0;
          for (const br of latestBuildingRows) {
            const nr = latestNeighborhoodRows.find((n: any) => n.beds === br.beds);
            if (nr && nr.median_rent > 0 && br.median_rent > 0) {
              const diff = (br.median_rent - nr.median_rent) / nr.median_rent;
              const weight = br.listing_count || 1;
              totalDiff += diff * weight;
              totalWeight += weight;
            }
          }
          if (totalWeight > 0) {
            const avgDiff = totalDiff / totalWeight;
            // Adjust for building quality
            const qualityBonus = ((building.overall_score ?? 5) - 5) * 0.02; // better buildings get a bonus
            const violationPenalty = Math.min((building.violation_count || 0) / 100, 0.1); // many violations = worse value
            const adjustedDiff = avgDiff - qualityBonus + violationPenalty;
            // Map to grade: negative diff = cheaper than neighborhood = better value
            if (adjustedDiff <= -0.15) computedValueGrade = "A";
            else if (adjustedDiff <= -0.05) computedValueGrade = "B";
            else if (adjustedDiff <= 0.05) computedValueGrade = "C";
            else if (adjustedDiff <= 0.15) computedValueGrade = "D";
            else computedValueGrade = "F";
          }
        }

        return (
          <div id="rent-intelligence" className="scroll-mt-20">
            <RentIntelligence
              buildingId={buildingId}
              building={{ id: building.id, full_address: building.full_address, zip_code: building.zip_code || "", violation_count: building.violation_count || 0, overall_score: building.overall_score }}
              buildingRents={deweyBuildingRents}
              neighborhoodRents={deweyNeighborhoodRents || []}
              amenityPremiums={deweyAmenityPremiums || []}
              seasonalIndex={deweySeasonalIndex || []}
              valueGrade={computedValueGrade}
            />
          </div>
        );
      })()}

      {/* Amenity Premiums */}
      {(() => {
        // Compute values for AmenityPremiums from dewey data
        const latestMonth = deweyBuildingRents.length > 0 ? deweyBuildingRents[deweyBuildingRents.length - 1]?.month : null;
        const latestBuildingRows = latestMonth ? deweyBuildingRents.filter((r: any) => r.month === latestMonth) : [];
        const latestNeighborhoodRows = latestMonth ? (deweyNeighborhoodRents || []).filter((r: any) => r.month === latestMonth) : [];

        // Pick most common bed count for display
        const bedCounts = new Map<number, number>();
        for (const r of latestBuildingRows) {
          bedCounts.set(r.beds, (bedCounts.get(r.beds) || 0) + (r.listing_count || 1));
        }
        let bestBeds = 1;
        let bestCount = 0;
        for (const [beds, count] of bedCounts) {
          if (count > bestCount) { bestBeds = beds; bestCount = count; }
        }

        const buildingRow = latestBuildingRows.find((r: any) => r.beds === bestBeds);
        const neighborhoodRow = latestNeighborhoodRows.find((r: any) => r.beds === bestBeds);
        const neighborhoodMedian = neighborhoodRow?.median_rent || 0;
        const buildingMedian = buildingRow?.median_rent || 0;
        const violationDiscount = Math.min(building.violation_count || 0, 100) * -0.5;
        const bedLabels: Record<number, string> = { 0: "Studio", 1: "1BR", 2: "2BR", 3: "3BR", 4: "4BR+" };

        let apValueGrade = "C";
        if (latestBuildingRows.length > 0 && latestNeighborhoodRows.length > 0) {
          let totalDiff = 0; let totalWeight = 0;
          for (const br of latestBuildingRows) {
            const nr = latestNeighborhoodRows.find((n: any) => n.beds === br.beds);
            if (nr && nr.median_rent > 0 && br.median_rent > 0) {
              const diff = (br.median_rent - nr.median_rent) / nr.median_rent;
              const weight = br.listing_count || 1;
              totalDiff += diff * weight; totalWeight += weight;
            }
          }
          if (totalWeight > 0) {
            const avgDiff = totalDiff / totalWeight;
            const qualityBonus = ((building.overall_score ?? 5) - 5) * 0.02;
            const violationPenalty = Math.min((building.violation_count || 0) / 100, 0.1);
            const adjustedDiff = avgDiff - qualityBonus + violationPenalty;
            if (adjustedDiff <= -0.15) apValueGrade = "A";
            else if (adjustedDiff <= -0.05) apValueGrade = "B";
            else if (adjustedDiff <= 0.05) apValueGrade = "C";
            else if (adjustedDiff <= 0.15) apValueGrade = "D";
            else apValueGrade = "F";
          }
        }

        if (!neighborhoodMedian || !buildingMedian) return null;

        return (
          <AmenityPremiums
            neighborhoodMedian={neighborhoodMedian}
            buildingMedian={buildingMedian}
            amenityPremiums={(deweyAmenityPremiums || []).filter((a: any) => a.premium_dollars > 0)}
            violationDiscount={violationDiscount}
            valueGrade={apValueGrade}
            bedLabel={bedLabels[bestBeds] ?? `${bestBeds}BR`}
          />
        );
      })()}

      {/* Building Pulse — Violation & Complaint Trends */}
      <div id="pulse" className="scroll-mt-28">
        <ViolationTrend buildingId={buildingId} housingAgency={city === "los-angeles" ? "LAHD" : city === "chicago" ? "CDBS" : city === "miami" ? "RER" : "HPD"} />

        {/* Common Issues Breakdown */}
        {(() => {
          // Aggregate violations by nov_description, top 5
          const violationCounts = new Map<string, number>();
          for (const v of violations) {
            const type = v.nov_description || "Unknown";
            violationCounts.set(type, (violationCounts.get(type) || 0) + 1);
          }
          const topViolations = [...violationCounts.entries()]
            .map(([type, count]) => ({ type, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

          // Aggregate complaints by complaint_type, top 5
          const complaintCounts = new Map<string, number>();
          for (const c of complaints) {
            const type = c.complaint_type || c.descriptor || "Unknown";
            complaintCounts.set(type, (complaintCounts.get(type) || 0) + 1);
          }
          const topComplaints = [...complaintCounts.entries()]
            .map(([type, count]) => ({ type, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

          return <CommonIssues topViolations={topViolations} topComplaints={topComplaints} />;
        })()}
      </div>

      {/* Reviews */}
      <ReviewSection
        reviews={reviews}
        buildingId={buildingId}
        isMonitored={authStatus.monitored}
        cityPath={`/${city}`}
        headerActions={
          <>
            <SaveButton buildingId={buildingId} initialSaved={authStatus.saved} />
            <ShareButton address={shortAddress} url={canonicalUrl(buildingUrl(building, city))} />
          </>
        }
      />

      {/* Rent History / Listings */}
      <div id="rent" className="scroll-mt-28">
        <MarketListings listings={marketListings} amenities={amenities} rentHistory={rentHistory} buildingUrl={buildingUrl(building, city)} />
        {marketListings.length === 0 && rents.length > 0 && (
          <RentRangeCard rents={rents} />
        )}
      </div>

      {/* Building Amenities */}
      {amenities.length > 0 && (
        <div id="amenities" className="scroll-mt-28">
          <BuildingAmenities amenities={amenities} />
        </div>
      )}

      {/* Violations by Unit Breakdown */}
      <div id="violations-by-unit">
        <ViolationsByUnit
          violationSummaries={violationSummaries}
          units={units}
          buildingId={buildingId}
        />
      </div>

      <AdBlock adSlot="BUILDING_MID_2" adFormat="horizontal" />

      {/* Violations & Complaints Tabs */}
      <div id="violations" className="scroll-mt-28">
        <IssuesTabs violations={violations} complaints={complaints} litigations={litigations} dobViolations={dobViolations} bedbugs={bedbugs} evictions={evictions} permits={permits} lahdViolationSummary={lahdViolationSummary} city={city} />
      </div>

      {/* Full Timeline Link */}
      <div className="flex justify-end">
        <Link
          href={`${buildingUrl(building, city)}/timeline`}
          className="inline-flex items-center gap-2 text-sm font-medium text-[#6366F1] hover:text-[#4F46E5] transition-colors"
        >
          <Clock className="w-4 h-4" />
          View Full History Timeline
        </Link>
      </div>

      {/* Building Location Map */}
      {building.latitude && building.longitude && (
        <div id="location" className="scroll-mt-28">
          <BuildingLocationMap
            latitude={building.latitude}
            longitude={building.longitude}
            address={building.full_address}
          />
        </div>
      )}
    </>
  );
}

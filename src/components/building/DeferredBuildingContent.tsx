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
import { BuildingLocationMap } from "@/components/building/BuildingLocationMap";
import { ViolationTrend } from "@/components/building/ViolationTrend";
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

  const [violations, complaints, litigations, dobViolations, bedbugs, evictions, permits, reviews, units, violationSummaries, amenities, marketListings, rentHistory, authStatus, lahdViolationSummary] = await Promise.all([
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
  ]);

  const shortAddress = building.full_address.split(",")[0]?.trim() || building.full_address;

  return (
    <>
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

      {/* Rent History */}
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

      {/* Violation & Complaint Trends */}
      <div id="violation-trends" className="scroll-mt-28">
        <ViolationTrend buildingId={buildingId} housingAgency={city === "los-angeles" ? "LAHD" : city === "chicago" ? "CDBS" : city === "miami" ? "RER" : "HPD"} />
      </div>

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

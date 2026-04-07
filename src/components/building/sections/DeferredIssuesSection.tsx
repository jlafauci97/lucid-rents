import { createClient } from "@/lib/supabase/server";
import { ViolationTrend } from "@/components/building/ViolationTrend";
import { CommonIssues } from "@/components/building/CommonIssues";
import { ViolationsByUnit } from "@/components/building/ViolationsByUnit";
import { IssuesTabs } from "@/components/building/IssuesTabs";
import { AdBlock } from "@/components/ui/AdBlock";
import type { City } from "@/lib/cities";
import type { HpdViolation, Complaint311, HpdLitigation, DobViolation, BedBugReport, Eviction, DobPermit, LahdViolationSummary } from "@/types";

const safe = <T,>(promise: PromiseLike<{ data: T | null; error: unknown }>, fallback: T): Promise<T> =>
  Promise.resolve(promise).then(({ data, error }) => {
    if (error) console.error("Supabase query error:", error);
    return data ?? fallback;
  }).catch((err: unknown) => {
    console.error("Supabase query exception:", err);
    return fallback;
  });

interface Props {
  buildingId: string;
  city: City;
  buildingHref?: string;
}

export async function DeferredIssuesSection({ buildingId, city, buildingHref }: Props) {
  const supabase = await createClient();
  const isLA = city === "los-angeles";
  const isChicago = city === "chicago";
  const isNYC = city === "nyc";

  // Single hpd_violations query with all needed fields (deduped — was 2 queries before)
  const [violations, complaints, litigations, dobViolations, bedbugs, evictions, permits, units, lahdViolationSummary] = await Promise.all([
    safe(supabase.from("hpd_violations").select("*").eq("building_id", buildingId).order("inspection_date", { ascending: false }).limit(1000), [] as HpdViolation[]),
    safe(supabase.from("complaints_311").select("*").eq("building_id", buildingId).order("created_date", { ascending: false }).limit(1000), [] as Complaint311[]),
    isNYC ? safe(supabase.from("hpd_litigations").select("*").eq("building_id", buildingId).order("case_open_date", { ascending: false }).limit(20), [] as HpdLitigation[]) : Promise.resolve([] as HpdLitigation[]),
    (isNYC || isChicago) ? safe(supabase.from("dob_violations").select("*").eq("building_id", buildingId).order("issue_date", { ascending: false }).limit(20), [] as DobViolation[]) : Promise.resolve([] as DobViolation[]),
    isNYC ? safe(supabase.from("bedbug_reports").select("*").eq("building_id", buildingId).order("filing_date", { ascending: false }).limit(20), [] as BedBugReport[]) : Promise.resolve([] as BedBugReport[]),
    isNYC ? safe(supabase.from("evictions").select("*").eq("building_id", buildingId).order("executed_date", { ascending: false }).limit(20), [] as Eviction[]) : Promise.resolve([] as Eviction[]),
    safe(supabase.from("dob_permits").select("*").eq("building_id", buildingId).order("issued_date", { ascending: false }).limit(20), [] as DobPermit[]),
    safe(supabase.from("units").select("*").eq("building_id", buildingId).order("unit_number", { ascending: true }), []),
    isLA
      ? safe(supabase.from("lahd_violation_summary").select("id, building_id, violation_type, violations_cited, violations_cleared").eq("building_id", buildingId).order("violations_cited", { ascending: false }).limit(50), [] as LahdViolationSummary[])
      : Promise.resolve([] as LahdViolationSummary[]),
  ]);

  // Use the first 20 for tabs display, full 200 for ViolationsByUnit and CommonIssues
  const tabViolations = violations.slice(0, 20);

  // Fetch real total counts (cheap head-only queries, no data transferred)
  const safeCount = async (query: PromiseLike<{ count: number | null; error: unknown }>): Promise<number> => {
    try {
      const { count, error } = await query;
      if (error) return 0;
      return count ?? 0;
    } catch { return 0; }
  };
  const [violationsCount, complaintsCount, litigationsCount, dobCount, bedbugsCount, evictionsCount, permitsCount, lahdCount] = await Promise.all([
    safeCount(supabase.from("hpd_violations").select("*", { count: "exact", head: true }).eq("building_id", buildingId)),
    safeCount(supabase.from("complaints_311").select("*", { count: "exact", head: true }).eq("building_id", buildingId)),
    isNYC ? safeCount(supabase.from("hpd_litigations").select("*", { count: "exact", head: true }).eq("building_id", buildingId)) : 0,
    (isNYC || isChicago) ? safeCount(supabase.from("dob_violations").select("*", { count: "exact", head: true }).eq("building_id", buildingId)) : 0,
    isNYC ? safeCount(supabase.from("bedbug_reports").select("*", { count: "exact", head: true }).eq("building_id", buildingId)) : 0,
    isNYC ? safeCount(supabase.from("evictions").select("*", { count: "exact", head: true }).eq("building_id", buildingId)) : 0,
    safeCount(supabase.from("dob_permits").select("*", { count: "exact", head: true }).eq("building_id", buildingId)),
    isLA ? safeCount(supabase.from("lahd_violation_summary").select("*", { count: "exact", head: true }).eq("building_id", buildingId)) : 0,
  ]);
  const totalCounts = {
    violations: isLA ? lahdCount : violationsCount,
    complaints: complaintsCount,
    litigations: litigationsCount,
    dob: dobCount,
    bedbugs: bedbugsCount,
    evictions: evictionsCount,
    permits: permitsCount,
  };

  // Common Issues aggregation — group violations by category
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

  return (
    <>
      {/* Building Pulse — Violation & Complaint Trends */}
      <div id="pulse" className="scroll-mt-28">
        <ViolationTrend buildingId={buildingId} housingAgency={city === "los-angeles" ? "LAHD" : city === "chicago" ? "CDBS" : city === "miami" ? "RER" : "HPD"} />
        <CommonIssues topViolations={topViolations} topComplaints={topComplaints} />
      </div>

      {/* Violations by Unit Breakdown */}
      <div id="violations-by-unit">
        <ViolationsByUnit
          violationSummaries={violations}
          units={units}
          buildingId={buildingId}
        />
      </div>

      <AdBlock adSlot="BUILDING_MID_2" adFormat="horizontal" />

      {/* Violations & Complaints Tabs */}
      <div id="violations" className="scroll-mt-28">
        <IssuesTabs violations={tabViolations} complaints={complaints} litigations={litigations} dobViolations={dobViolations} bedbugs={bedbugs} evictions={evictions} permits={permits} lahdViolationSummary={lahdViolationSummary} city={city} buildingHref={buildingHref} totalCounts={totalCounts} />
      </div>
    </>
  );
}

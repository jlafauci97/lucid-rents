import { createCacheClient } from "@/lib/supabase/cache-client";
import { ViolationTrend } from "@/components/building/ViolationTrend";
import { CommonIssues } from "@/components/building/CommonIssues";
import { ViolationsByUnit } from "@/components/building/ViolationsByUnit";
import { IssuesTabs } from "@/components/building/IssuesTabs";
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
  const supabase = createCacheClient();
  const isLA = city === "los-angeles";
  const isChicago = city === "chicago";
  const isNYC = city === "nyc";

  // Fetch all issues data + pre-computed counts in a single parallel batch
  const [violations, complaints, litigations, dobViolations, bedbugs, evictions, permits, units, lahdViolationSummary, buildingCounts] = await Promise.all([
    safe(supabase.from("hpd_violations").select("*").eq("building_id", buildingId).order("inspection_date", { ascending: false }).limit(200), [] as HpdViolation[]),
    safe(supabase.from("complaints_311").select("*").eq("building_id", buildingId).order("created_date", { ascending: false }).limit(200), [] as Complaint311[]),
    isNYC ? safe(supabase.from("hpd_litigations").select("*").eq("building_id", buildingId).order("case_open_date", { ascending: false }).limit(20), [] as HpdLitigation[]) : Promise.resolve([] as HpdLitigation[]),
    (isNYC || isChicago) ? safe(supabase.from("dob_violations").select("*").eq("building_id", buildingId).order("issue_date", { ascending: false }).limit(20), [] as DobViolation[]) : Promise.resolve([] as DobViolation[]),
    isNYC ? safe(supabase.from("bedbug_reports").select("*").eq("building_id", buildingId).order("filing_date", { ascending: false }).limit(20), [] as BedBugReport[]) : Promise.resolve([] as BedBugReport[]),
    isNYC ? safe(supabase.from("evictions").select("*").eq("building_id", buildingId).order("executed_date", { ascending: false }).limit(20), [] as Eviction[]) : Promise.resolve([] as Eviction[]),
    safe(supabase.from("dob_permits").select("*").eq("building_id", buildingId).order("issued_date", { ascending: false }).limit(20), [] as DobPermit[]),
    safe(supabase.from("units").select("id, unit_number, building_id").eq("building_id", buildingId).order("unit_number", { ascending: true }).limit(500), []),
    isLA
      ? safe(supabase.from("lahd_violation_summary").select("id, building_id, violation_type, violations_cited, violations_cleared").eq("building_id", buildingId).order("violations_cited", { ascending: false }).limit(50), [] as LahdViolationSummary[])
      : Promise.resolve([] as LahdViolationSummary[]),
    safe(supabase.from("buildings").select("violation_count, complaint_count, litigation_count, dob_violation_count, bedbug_report_count, eviction_count, permit_count").eq("id", buildingId).single(), null as { violation_count: number; complaint_count: number; litigation_count: number; dob_violation_count: number; bedbug_report_count: number; eviction_count: number; permit_count: number } | null),
  ]);

  // Use the first 20 for tabs display, full set for ViolationsByUnit and CommonIssues
  const tabViolations = violations.slice(0, 20);
  const totalCounts = {
    violations: isLA ? lahdViolationSummary.length : (buildingCounts?.violation_count ?? violations.length),
    complaints: buildingCounts?.complaint_count ?? complaints.length,
    litigations: buildingCounts?.litigation_count ?? litigations.length,
    dob: buildingCounts?.dob_violation_count ?? dobViolations.length,
    bedbugs: buildingCounts?.bedbug_report_count ?? bedbugs.length,
    evictions: buildingCounts?.eviction_count ?? evictions.length,
    permits: buildingCounts?.permit_count ?? permits.length,
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

      {/* Violations & Complaints Tabs */}
      <div id="violations" className="scroll-mt-28">
        <IssuesTabs violations={tabViolations} complaints={complaints} litigations={litigations} dobViolations={dobViolations} bedbugs={bedbugs} evictions={evictions} permits={permits} lahdViolationSummary={lahdViolationSummary} city={city} buildingHref={buildingHref} totalCounts={totalCounts} />
      </div>
    </>
  );
}

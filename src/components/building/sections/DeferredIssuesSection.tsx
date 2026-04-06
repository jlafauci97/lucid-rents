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
}

export async function DeferredIssuesSection({ buildingId, city }: Props) {
  const supabase = await createClient();
  const isLA = city === "los-angeles";
  const isChicago = city === "chicago";
  const isNYC = city === "nyc";

  // Single hpd_violations query with all needed fields (deduped — was 2 queries before)
  const [violations, complaints, litigations, dobViolations, bedbugs, evictions, permits, units, lahdViolationSummary] = await Promise.all([
    safe(supabase.from("hpd_violations").select("*").eq("building_id", buildingId).order("inspection_date", { ascending: false }).limit(200), [] as HpdViolation[]),
    safe(supabase.from("complaints_311").select("*").eq("building_id", buildingId).order("created_date", { ascending: false }).limit(20), [] as Complaint311[]),
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

  // Common Issues aggregation
  const violationCounts = new Map<string, number>();
  for (const v of violations) {
    const type = v.nov_description || "Unknown";
    violationCounts.set(type, (violationCounts.get(type) || 0) + 1);
  }
  const topViolations = [...violationCounts.entries()]
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
        <IssuesTabs violations={tabViolations} complaints={complaints} litigations={litigations} dobViolations={dobViolations} bedbugs={bedbugs} evictions={evictions} permits={permits} lahdViolationSummary={lahdViolationSummary} city={city} />
      </div>
    </>
  );
}

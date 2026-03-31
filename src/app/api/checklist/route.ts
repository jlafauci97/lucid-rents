import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export interface ChecklistItem {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail" | "info";
  detail: string;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const buildingId = searchParams.get("buildingId");
  const city = searchParams.get("city") || "nyc";

  if (!buildingId) {
    return NextResponse.json({ error: "buildingId required" }, { status: 400 });
  }

  const supabase = await createClient();

  const [
    { data: building },
    { data: violations },
    { data: complaints },
    { data: reviews },
    { data: bedbugReports },
    { data: litigations },
  ] = await Promise.all([
    supabase.from("buildings").select("*").eq("id", buildingId).single(),
    supabase
      .from("hpd_violations")
      .select("id, class, status")
      .eq("building_id", buildingId)
      .eq("status", "Open"),
    supabase
      .from("complaints_311")
      .select("id, complaint_type, created_date")
      .eq("building_id", buildingId)
      .gte("created_date", new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()),
    supabase
      .from("reviews")
      .select("overall_rating")
      .eq("building_id", buildingId)
      .eq("status", "published"),
    city === "nyc"
      ? supabase
          .from("bedbug_reports")
          .select("id, filing_date, infested_dwelling_unit_count")
          .eq("building_id", buildingId)
          .gte("filing_date", new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString()) as unknown as Promise<{ data: { id: string; filing_date: string; infested_dwelling_unit_count: number | null }[] | null; error: unknown }>
      : Promise.resolve({ data: [] as { id: string; filing_date: string; infested_dwelling_unit_count: number | null }[], error: null }),
    city === "nyc"
      ? supabase
          .from("hpd_litigations")
          .select("id, case_status")
          .eq("building_id", buildingId)
          .neq("case_status", "CLOSED") as unknown as Promise<{ data: { id: string; case_status: string | null }[] | null; error: unknown }>
      : Promise.resolve({ data: [] as { id: string; case_status: string | null }[], error: null }),
  ]);

  if (!building) {
    return NextResponse.json({ error: "Building not found" }, { status: 404 });
  }

  const items: ChecklistItem[] = [];

  // 1. Overall building score
  const score = building.overall_score;
  if (score === null) {
    items.push({ id: "score", label: "Building Score", status: "info", detail: "No score yet — not enough data to rate this building." });
  } else if (score >= 7) {
    items.push({ id: "score", label: "Building Score", status: "pass", detail: `Score: ${score}/10 — above average.` });
  } else if (score >= 5) {
    items.push({ id: "score", label: "Building Score", status: "warn", detail: `Score: ${score}/10 — below average. Review violations and complaints carefully.` });
  } else {
    items.push({ id: "score", label: "Building Score", status: "fail", detail: `Score: ${score}/10 — significant issues on record. Proceed with caution.` });
  }

  // 2. Open violations
  const openViolations = violations || [];
  const openClassC = openViolations.filter((v) => v.class === "C" || v.class === "I").length;
  const totalOpen = openViolations.length;
  if (totalOpen === 0) {
    items.push({ id: "violations", label: "Open Violations", status: "pass", detail: "No open violations on record." });
  } else if (openClassC > 0) {
    items.push({ id: "violations", label: "Open Violations", status: "fail", detail: `${totalOpen} open violation(s) including ${openClassC} Class C (immediately hazardous).` });
  } else if (totalOpen <= 5) {
    items.push({ id: "violations", label: "Open Violations", status: "warn", detail: `${totalOpen} open violation(s) on record. Review before signing.` });
  } else {
    items.push({ id: "violations", label: "Open Violations", status: "fail", detail: `${totalOpen} open violations — above average. Request remediation timeline from landlord.` });
  }

  // 3. Recent 311 complaints
  const recentComplaints = complaints || [];
  const pestComplaints = recentComplaints.filter((c) =>
    ["Rodent", "Pests", "Cockroaches", "Mice"].some((kw) =>
      (c.complaint_type || "").toLowerCase().includes(kw.toLowerCase())
    )
  ).length;
  const heatComplaints = recentComplaints.filter((c) =>
    ["Heat", "Hot Water", "No Heat"].some((kw) =>
      (c.complaint_type || "").toLowerCase().includes(kw.toLowerCase())
    )
  ).length;
  const totalRecent = recentComplaints.length;

  if (totalRecent === 0) {
    items.push({ id: "complaints", label: "Recent 311 Complaints (12mo)", status: "pass", detail: "No 311 complaints in the past year." });
  } else if (totalRecent <= 3) {
    items.push({ id: "complaints", label: "Recent 311 Complaints (12mo)", status: "warn", detail: `${totalRecent} complaint(s) in the past year.` });
  } else {
    items.push({ id: "complaints", label: "Recent 311 Complaints (12mo)", status: "fail", detail: `${totalRecent} complaint(s) in the past year — high complaint volume.` });
  }

  // 4. Pest complaints
  if (pestComplaints === 0) {
    items.push({ id: "pests", label: "Pest Complaints", status: "pass", detail: "No pest-related 311 complaints in the past year." });
  } else {
    items.push({ id: "pests", label: "Pest Complaints", status: "fail", detail: `${pestComplaints} pest complaint(s) in the past year. Ask management about extermination history.` });
  }

  // 5. Heat/hot water complaints
  if (heatComplaints === 0) {
    items.push({ id: "heat", label: "Heat & Hot Water Complaints", status: "pass", detail: "No heat or hot water complaints in the past year." });
  } else if (heatComplaints <= 2) {
    items.push({ id: "heat", label: "Heat & Hot Water Complaints", status: "warn", detail: `${heatComplaints} heat or hot water complaint(s) in the past year.` });
  } else {
    items.push({ id: "heat", label: "Heat & Hot Water Complaints", status: "fail", detail: `${heatComplaints} heat or hot water complaint(s) — confirm with current tenants.` });
  }

  // 6. Review summary
  const reviewList = reviews || [];
  if (reviewList.length === 0) {
    items.push({ id: "reviews", label: "Tenant Reviews", status: "info", detail: "No reviews yet. Check for recent reviews before moving in." });
  } else {
    const avgRating = reviewList.reduce((s, r) => s + r.overall_rating, 0) / reviewList.length;
    if (avgRating >= 4) {
      items.push({ id: "reviews", label: "Tenant Reviews", status: "pass", detail: `${avgRating.toFixed(1)}/5 avg rating from ${reviewList.length} review(s).` });
    } else if (avgRating >= 2) {
      items.push({ id: "reviews", label: "Tenant Reviews", status: "warn", detail: `${avgRating.toFixed(1)}/5 avg rating from ${reviewList.length} review(s). Read reviews carefully.` });
    } else {
      items.push({ id: "reviews", label: "Tenant Reviews", status: "fail", detail: `${avgRating.toFixed(1)}/5 avg rating — below average. Read reviews to understand key issues.` });
    }
  }

  // 7. NYC-specific: bedbug history
  if (city === "nyc") {
    const bbReports = bedbugReports || [];
    if (bbReports.length === 0) {
      items.push({ id: "bedbugs", label: "Bedbug History (2yr)", status: "pass", detail: "No bedbug reports in the past 2 years." });
    } else {
      const totalInfested = bbReports.reduce((s, r) => s + (r.infested_dwelling_unit_count || 0), 0);
      items.push({ id: "bedbugs", label: "Bedbug History (2yr)", status: "fail", detail: `${bbReports.length} bedbug report(s) in the past 2 years affecting ${totalInfested} unit(s).` });
    }

    // 8. NYC-specific: active litigation
    const activeLit = litigations || [];
    if (activeLit.length === 0) {
      items.push({ id: "litigation", label: "Active HPD Litigation", status: "pass", detail: "No active HPD litigation on record." });
    } else {
      items.push({ id: "litigation", label: "Active HPD Litigation", status: "warn", detail: `${activeLit.length} active litigation case(s). Ask landlord to explain before signing.` });
    }

    // 9. Rent stabilization
    if (building.is_rent_stabilized) {
      items.push({ id: "stabilized", label: "Rent Stabilization", status: "pass", detail: `Building has rent-stabilized units (${building.stabilized_units ?? "unknown"} units). Ask if your apartment qualifies.` });
    } else {
      items.push({ id: "stabilized", label: "Rent Stabilization", status: "info", detail: "No rent stabilization on record for this building." });
    }
  }

  // LA-specific checks
  if (city === "los-angeles") {
    if (building.is_soft_story) {
      items.push({ id: "seismic", label: "Soft-Story Seismic Risk", status: "warn", detail: `Soft-story building — ${building.soft_story_status || "check retrofit compliance"}.` });
    } else {
      items.push({ id: "seismic", label: "Soft-Story Seismic Risk", status: "pass", detail: "No soft-story designation on record." });
    }
    if (building.is_rso) {
      items.push({ id: "rso", label: "RSO Rent Control", status: "pass", detail: "Building is covered by LA Rent Stabilization Ordinance (RSO)." });
    } else {
      items.push({ id: "rso", label: "RSO Rent Control", status: "info", detail: "Building is not covered by RSO. No cap on rent increases." });
    }
  }

  // Chicago-specific
  if (city === "chicago") {
    items.push({
      id: "rlto",
      label: "RLTO Protections",
      status: building.is_rlto_protected ? "pass" : "info",
      detail: building.is_rlto_protected
        ? "Building is covered by Chicago's Residential Landlord and Tenant Ordinance."
        : "Building may not be covered by RLTO. Verify with landlord.",
    });
    if (building.is_scofflaw) {
      items.push({ id: "scofflaw", label: "Scofflaw Status", status: "fail", detail: "Building is on the Chicago Scofflaw list — landlord has unpaid debts to the city." });
    } else {
      items.push({ id: "scofflaw", label: "Scofflaw Status", status: "pass", detail: "No scofflaw designation." });
    }
  }

  return NextResponse.json({
    building: {
      id: building.id,
      full_address: building.full_address,
      borough: building.borough,
      slug: building.slug,
      overall_score: building.overall_score,
    },
    items,
  });
}

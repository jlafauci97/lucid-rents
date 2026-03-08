import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export interface ActivityItem {
  type: "review" | "violation" | "complaint" | "litigation" | "dob_violation" | "crime";
  id: string;
  description: string;
  date: string;
  buildingId: string;
  buildingAddress: string;
  borough: string;
  buildingSlug?: string;
  rating?: number;
  violationClass?: string;
  crimeCategory?: string;
  zipCode?: string;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
    const filter = searchParams.get("filter") || "all";

    const supabase = await createClient();
    const perSource = Math.ceil(limit / 6);

    // Date cutoff: only fetch recent records to avoid full table scans on
    // tables with millions of rows (DOB: 2.2M, HPD: 800K, 311: 800K, NYPD: 475K)
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const cutoffDate = cutoff.toISOString();

    // Upper bound: filter out records with bad future dates (e.g. 2030 litigations)
    const today = new Date();
    today.setDate(today.getDate() + 1); // allow today + 1 day buffer for timezone differences
    const maxDate = today.toISOString();
    const maxDateShort = maxDate.slice(0, 10);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const promises: PromiseLike<any>[] = [];

    // Conditionally fetch based on filter
    if (filter === "all" || filter === "reviews") {
      promises.push(
        supabase
          .from("reviews")
          .select("id, title, overall_rating, created_at, building_id, buildings(full_address, borough, slug)")
          .not("building_id", "is", null)
          .gte("created_at", cutoffDate)
          .lte("created_at", maxDate)
          .order("created_at", { ascending: false })
          .limit(filter === "all" ? perSource : limit)
      );
    } else {
      promises.push(Promise.resolve({ data: null }));
    }

    if (filter === "all" || filter === "violations") {
      promises.push(
        supabase
          .from("hpd_violations")
          .select("id, class, nov_description, inspection_date, building_id, buildings(full_address, borough, slug)")
          .not("building_id", "is", null)
          .gte("inspection_date", cutoffDate.slice(0, 10))
          .lte("inspection_date", maxDateShort)
          .order("inspection_date", { ascending: false })
          .limit(filter === "all" ? perSource : limit)
      );
    } else {
      promises.push(Promise.resolve({ data: null }));
    }

    if (filter === "all" || filter === "complaints") {
      promises.push(
        supabase
          .from("complaints_311")
          .select("id, complaint_type, descriptor, created_date, building_id, buildings(full_address, borough, slug)")
          .not("building_id", "is", null)
          .gte("created_date", cutoffDate)
          .lte("created_date", maxDate)
          .order("created_date", { ascending: false })
          .limit(filter === "all" ? perSource : limit)
      );
    } else {
      promises.push(Promise.resolve({ data: null }));
    }

    if (filter === "all" || filter === "litigations") {
      promises.push(
        supabase
          .from("hpd_litigations")
          .select("id, case_type, case_status, respondent, case_open_date, building_id, buildings(full_address, borough, slug)")
          .not("building_id", "is", null)
          .not("case_open_date", "is", null)
          .gte("case_open_date", cutoffDate.slice(0, 10))
          .lte("case_open_date", maxDateShort)
          .order("case_open_date", { ascending: false })
          .limit(filter === "all" ? perSource : limit)
      );
    } else {
      promises.push(Promise.resolve({ data: null }));
    }

    if (filter === "all" || filter === "dob_violations") {
      promises.push(
        supabase
          .from("dob_violations")
          .select("id, violation_type, description, issue_date, building_id, buildings(full_address, borough, slug)")
          .not("building_id", "is", null)
          .not("issue_date", "is", null)
          .gte("issue_date", cutoffDate.slice(0, 10))
          .lte("issue_date", maxDateShort)
          .order("issue_date", { ascending: false })
          .limit(filter === "all" ? perSource : limit)
      );
    } else {
      promises.push(Promise.resolve({ data: null }));
    }

    if (filter === "all" || filter === "crime") {
      promises.push(
        supabase
          .from("nypd_complaints")
          .select("id, offense_description, pd_description, crime_category, law_category, cmplnt_date, borough, zip_code")
          .in("crime_category", ["violent", "property"])
          .not("cmplnt_date", "is", null)
          .gte("cmplnt_date", cutoffDate.slice(0, 10))
          .lte("cmplnt_date", maxDateShort)
          .order("cmplnt_date", { ascending: false })
          .limit(filter === "all" ? perSource : limit)
      );
    } else {
      promises.push(Promise.resolve({ data: null }));
    }

    const [reviewsResult, violationsResult, complaintsResult, litigationsResult, dobResult, crimeResult] = await Promise.all(promises) as [
      { data: unknown[] | null },
      { data: unknown[] | null },
      { data: unknown[] | null },
      { data: unknown[] | null },
      { data: unknown[] | null },
      { data: unknown[] | null },
    ];

    const items: ActivityItem[] = [];

    // Normalize reviews
    if (reviewsResult.data) {
      for (const r of reviewsResult.data as Record<string, unknown>[]) {
        const building = r.buildings as { full_address: string; borough: string; slug: string } | null;
        if (!building) continue;
        items.push({
          type: "review",
          id: r.id as string,
          description: (r.title as string) || "New tenant review submitted",
          date: r.created_at as string,
          buildingId: r.building_id as string,
          buildingAddress: building.full_address,
          borough: building.borough,
          buildingSlug: building.slug,
          rating: r.overall_rating as number,
        });
      }
    }

    // Normalize violations
    if (violationsResult.data) {
      for (const v of violationsResult.data as Record<string, unknown>[]) {
        const building = v.buildings as { full_address: string; borough: string; slug: string } | null;
        if (!building) continue;
        const classLabel = v.class ? `Class ${v.class}` : "HPD";
        const desc = v.nov_description
          ? `${classLabel} violation: ${v.nov_description}`
          : `${classLabel} violation recorded`;
        items.push({
          type: "violation",
          id: String(v.id),
          description: (desc as string).length > 160 ? (desc as string).slice(0, 157) + "..." : desc as string,
          date: v.inspection_date as string,
          buildingId: v.building_id as string,
          buildingAddress: building.full_address,
          borough: building.borough,
          buildingSlug: building.slug,
          violationClass: v.class as string,
        });
      }
    }

    // Normalize complaints
    if (complaintsResult.data) {
      for (const c of complaintsResult.data as Record<string, unknown>[]) {
        const building = c.buildings as { full_address: string; borough: string; slug: string } | null;
        if (!building) continue;
        const desc = c.descriptor
          ? `${c.complaint_type}: ${c.descriptor}`
          : (c.complaint_type as string) || "311 complaint filed";
        items.push({
          type: "complaint",
          id: String(c.id),
          description: (desc as string).length > 160 ? (desc as string).slice(0, 157) + "..." : desc as string,
          date: c.created_date as string,
          buildingId: c.building_id as string,
          buildingAddress: building.full_address,
          borough: building.borough,
          buildingSlug: building.slug,
        });
      }
    }

    // Normalize litigations
    if (litigationsResult.data) {
      for (const l of litigationsResult.data as Record<string, unknown>[]) {
        const building = l.buildings as { full_address: string; borough: string; slug: string } | null;
        if (!building) continue;
        const parts = [l.case_type as string];
        if (l.respondent) parts.push(`— ${l.respondent}`);
        if (l.case_status) parts.push(`(${l.case_status})`);
        const desc = parts.join(" ") || "HPD litigation filed";
        items.push({
          type: "litigation",
          id: String(l.id),
          description: desc.length > 160 ? desc.slice(0, 157) + "..." : desc,
          date: l.case_open_date as string,
          buildingId: l.building_id as string,
          buildingAddress: building.full_address,
          borough: building.borough,
          buildingSlug: building.slug,
        });
      }
    }

    // Normalize DOB violations
    if (dobResult.data) {
      for (const d of dobResult.data as Record<string, unknown>[]) {
        const building = d.buildings as { full_address: string; borough: string; slug: string } | null;
        if (!building) continue;
        const desc = d.description
          ? `DOB ${d.violation_type || "violation"}: ${d.description}`
          : `DOB ${d.violation_type || "violation"} issued`;
        items.push({
          type: "dob_violation",
          id: String(d.id),
          description: (desc as string).length > 160 ? (desc as string).slice(0, 157) + "..." : desc as string,
          date: d.issue_date as string,
          buildingId: d.building_id as string,
          buildingAddress: building.full_address,
          borough: building.borough,
          buildingSlug: building.slug,
        });
      }
    }

    // Normalize NYPD crimes
    if (crimeResult.data) {
      for (const cr of crimeResult.data as Record<string, unknown>[]) {
        const desc = cr.offense_description
          ? `${cr.offense_description}${cr.pd_description ? `: ${cr.pd_description}` : ""}`
          : "NYPD crime reported";
        items.push({
          type: "crime",
          id: String(cr.id),
          description: (desc as string).length > 160 ? (desc as string).slice(0, 157) + "..." : desc as string,
          date: cr.cmplnt_date as string,
          buildingId: "",
          buildingAddress: cr.zip_code ? `Zip ${cr.zip_code}` : "NYC",
          borough: (cr.borough as string) || "",
          crimeCategory: cr.crime_category as string,
          zipCode: cr.zip_code as string,
        });
      }
    }

    // Sort by date descending
    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const result = items.slice(0, limit);

    return NextResponse.json({ items: result });
  } catch (error) {
    console.error("Activity feed error:", error);
    return NextResponse.json(
      { error: "Failed to fetch activity feed" },
      { status: 500 }
    );
  }
}

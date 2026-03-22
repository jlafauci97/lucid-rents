import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isValidCity } from "@/lib/cities";

export interface ActivityItem {
  type: "review" | "violation" | "complaint" | "litigation" | "dob_violation" | "crime" | "bedbug" | "eviction";
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
  metro?: string;
}

/** Map city slug to the metro column value used in the database.
 *  NYC records have metro='nyc'; LA records have metro='los-angeles'. */
function cityToMetro(city: string | null): string {
  if (!city || city === "nyc") return "nyc";
  return city; // "los-angeles" matches the metro column directly
}

// ---------------------------------------------------------------------------
// Server-side cache – guarantees stable pagination within the TTL window and
// prevents Supabase from being hit on every page/filter/refresh request.
// ---------------------------------------------------------------------------
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours
const cache = new Map<string, { items: ActivityItem[]; ts: number }>();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
    const filter = searchParams.get("filter") || "all";
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
    const cityParam = searchParams.get("city");
    if (cityParam && !isValidCity(cityParam)) {
      return NextResponse.json({ error: "Invalid city" }, { status: 400 });
    }

    const metro = cityToMetro(cityParam);

    // --- Check cache ---
    const cacheKey = `${filter}:${cityParam || "nyc"}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      const offset = (page - 1) * limit;
      const result = cached.items.slice(offset, offset + limit);
      const totalPages = Math.ceil(cached.items.length / limit);
      return NextResponse.json({ items: result, page, totalPages, hasMore: page < totalPages });
    }

    // --- Fresh fetch ---
    const supabase = await createClient();

    // Snap cutoff to midnight UTC so every request today gets the same boundary
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    cutoff.setUTCHours(0, 0, 0, 0);
    const cutoffDate = cutoff.toISOString();

    // Upper bound: end of tomorrow UTC to filter out bad future dates
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setUTCHours(23, 59, 59, 999);
    const maxDate = tomorrow.toISOString();
    const maxDateShort = maxDate.slice(0, 10);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const promises: PromiseLike<any>[] = [];

    // Conditionally fetch based on filter — scoped to metro (city)
    if (filter === "all" || filter === "reviews") {
      promises.push(
        supabase
          .from("reviews")
          .select("id, title, overall_rating, created_at, building_id, metro, buildings(full_address, borough, slug)")
          .not("building_id", "is", null)
          .eq("metro", metro)
          .gte("created_at", cutoffDate)
          .lte("created_at", maxDate)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(10000)
      );
    } else {
      promises.push(Promise.resolve({ data: null, error: null }));
    }

    if (filter === "all" || filter === "violations") {
      promises.push(
        supabase
          .from("hpd_violations")
          .select("id, class, nov_description, inspection_date, building_id, metro, buildings(full_address, borough, slug)")
          .not("building_id", "is", null)
          .eq("metro", metro)
          .gte("inspection_date", cutoffDate.slice(0, 10))
          .lte("inspection_date", maxDateShort)
          .order("inspection_date", { ascending: false })
          .order("id", { ascending: false })
          .limit(10000)
      );
    } else {
      promises.push(Promise.resolve({ data: null, error: null }));
    }

    if (filter === "all" || filter === "complaints") {
      promises.push(
        supabase
          .from("complaints_311")
          .select("id, complaint_type, descriptor, created_date, building_id, metro, buildings(full_address, borough, slug)")
          .not("building_id", "is", null)
          .eq("metro", metro)
          .gte("created_date", cutoffDate)
          .lte("created_date", maxDate)
          .order("created_date", { ascending: false })
          .order("id", { ascending: false })
          .limit(10000)
      );
    } else {
      promises.push(Promise.resolve({ data: null, error: null }));
    }

    if (filter === "all" || filter === "litigations") {
      // Litigations are NYC-only; skip for LA
      if (metro === "nyc") {
        promises.push(
          supabase
            .from("hpd_litigations")
            .select("id, case_type, case_status, respondent, case_open_date, building_id, metro, buildings(full_address, borough, slug)")
            .not("building_id", "is", null)
            .not("case_open_date", "is", null)
            .eq("metro", metro)
            .gte("case_open_date", cutoffDate.slice(0, 10))
            .lte("case_open_date", maxDateShort)
            .order("case_open_date", { ascending: false })
            .order("id", { ascending: false })
            .limit(10000)
        );
      } else {
        promises.push(Promise.resolve({ data: null, error: null }));
      }
    } else {
      promises.push(Promise.resolve({ data: null, error: null }));
    }

    if (filter === "all" || filter === "dob_violations") {
      promises.push(
        supabase
          .from("dob_violations")
          .select("id, violation_type, description, issue_date, building_id, metro, buildings(full_address, borough, slug)")
          .not("building_id", "is", null)
          .not("issue_date", "is", null)
          .eq("metro", metro)
          .gte("issue_date", cutoffDate.slice(0, 10))
          .lte("issue_date", maxDateShort)
          .order("issue_date", { ascending: false })
          .order("id", { ascending: false })
          .limit(10000)
      );
    } else {
      promises.push(Promise.resolve({ data: null, error: null }));
    }

    if (filter === "all" || filter === "crime") {
      // Crime data is NYC-only for now (LAPD sync not yet active)
      if (metro === "nyc") {
        promises.push(
          supabase
            .from("nypd_complaints")
            .select("id, offense_description, pd_description, crime_category, law_category, cmplnt_date, borough, zip_code, metro")
            .in("crime_category", ["violent", "property"])
            .not("cmplnt_date", "is", null)
            .eq("metro", metro)
            .gte("cmplnt_date", cutoffDate.slice(0, 10))
            .lte("cmplnt_date", maxDateShort)
            .order("cmplnt_date", { ascending: false })
            .order("id", { ascending: false })
            .limit(10000)
        );
      } else {
        promises.push(Promise.resolve({ data: null, error: null }));
      }
    } else {
      promises.push(Promise.resolve({ data: null, error: null }));
    }

    if (filter === "all" || filter === "bedbugs") {
      // Bedbugs are NYC-only
      if (metro === "nyc") {
        promises.push(
          supabase
            .from("bedbug_reports")
            .select("id, infested_dwelling_unit_count, filing_date, building_id, metro, buildings(full_address, borough, slug)")
            .not("building_id", "is", null)
            .not("filing_date", "is", null)
            .eq("metro", metro)
            .gte("filing_date", cutoffDate.slice(0, 10))
            .lte("filing_date", maxDateShort)
            .order("filing_date", { ascending: false })
            .order("id", { ascending: false })
            .limit(10000)
        );
      } else {
        promises.push(Promise.resolve({ data: null, error: null }));
      }
    } else {
      promises.push(Promise.resolve({ data: null, error: null }));
    }

    if (filter === "all" || filter === "evictions") {
      // Evictions are NYC-only
      if (metro === "nyc") {
        promises.push(
          supabase
            .from("evictions")
            .select("id, eviction_address, executed_date, borough, building_id, metro, buildings(full_address, borough, slug)")
            .not("building_id", "is", null)
            .not("executed_date", "is", null)
            .eq("metro", metro)
            .gte("executed_date", cutoffDate.slice(0, 10))
            .lte("executed_date", maxDateShort)
            .order("executed_date", { ascending: false })
            .order("id", { ascending: false })
            .limit(10000)
        );
      } else {
        promises.push(Promise.resolve({ data: null, error: null }));
      }
    } else {
      promises.push(Promise.resolve({ data: null, error: null }));
    }

    const results = await Promise.all(promises) as {
      data: unknown[] | null;
      error?: { message: string } | null;
    }[];

    // Log failed queries but continue with the ones that succeeded
    for (let i = 0; i < results.length; i++) {
      if (results[i].error) {
        console.error(`Activity feed query ${i} failed:`, results[i].error);
        results[i].data = null; // Treat failed queries as empty
      }
    }

    const [reviewsResult, violationsResult, complaintsResult, litigationsResult, dobResult, crimeResult, bedbugResult, evictionResult] = results;

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

    // Normalize bedbug reports
    if (bedbugResult.data) {
      for (const b of bedbugResult.data as Record<string, unknown>[]) {
        const building = b.buildings as { full_address: string; borough: string; slug: string } | null;
        if (!building) continue;
        const count = b.infested_dwelling_unit_count as number | null;
        const desc = count ? `Bedbug infestation reported (${count} unit${count !== 1 ? "s" : ""})` : "Bedbug report filed";
        items.push({
          type: "bedbug",
          id: String(b.id),
          description: desc,
          date: b.filing_date as string,
          buildingId: b.building_id as string,
          buildingAddress: building.full_address,
          borough: building.borough,
          buildingSlug: building.slug,
        });
      }
    }

    // Normalize evictions
    if (evictionResult.data) {
      for (const e of evictionResult.data as Record<string, unknown>[]) {
        const building = e.buildings as { full_address: string; borough: string; slug: string } | null;
        if (!building) continue;
        items.push({
          type: "eviction",
          id: String(e.id),
          description: "Eviction executed",
          date: e.executed_date as string,
          buildingId: e.building_id as string,
          buildingAddress: building.full_address,
          borough: building.borough,
          buildingSlug: building.slug,
        });
      }
    }

    // Deterministic sort: date DESC, then id DESC as tiebreaker
    items.sort((a, b) => {
      const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateDiff !== 0) return dateDiff;
      return b.id < a.id ? -1 : b.id > a.id ? 1 : 0;
    });

    // Store in cache
    cache.set(cacheKey, { items, ts: Date.now() });

    const offset = (page - 1) * limit;
    const result = items.slice(offset, offset + limit);
    const totalPages = Math.ceil(items.length / limit);

    return NextResponse.json({ items: result, page, totalPages, hasMore: page < totalPages });
  } catch (error) {
    console.error("Activity feed error:", error);
    return NextResponse.json(
      { error: "Failed to fetch activity feed" },
      { status: 500 }
    );
  }
}

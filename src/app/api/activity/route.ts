import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { createCacheClient } from "@/lib/supabase/cache-client";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { isValidCity } from "@/lib/cities";

// Use service-role admin client for the activity feed API.
// The default anon role has a 3-second statement timeout which causes
// queries on large tables (complaints_311: 2.6M rows, etc.) to silently
// fail, resulting in empty feed results.
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    return createSupabaseClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  // Fallback to cookie-based client if service role key not available (local dev)
  return null;
}

// Headroom for a cold cache-fill: the first uncached `filter=all` request must
// fan out across every source table while their pages are still on cold storage.
// Single-flight (below) ensures only one such fill runs at a time, so 60s is
// ample; the previous 30s limit was being tripped on cold prod hits (504).
export const maxDuration = 60;

export interface ActivityItem {
  type: "review" | "violation" | "complaint" | "litigation" | "dob_violation" | "crime" | "bedbug" | "eviction" | "la_eviction" | "tenant_buyout" | "permit" | "enforcement" | "rlto_violation" | "lead_inspection";
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
 *  NYC records have metro='nyc'; LA records have metro='los-angeles'.
 *  Returns null when no city is provided (fetch all metros). */
function cityToMetro(city: string | null): string | null {
  if (!city) return null; // all cities
  if (city === "nyc") return "nyc";
  return city; // "los-angeles", "chicago", etc. match directly
}

// ---------------------------------------------------------------------------
// Durable caching + single-flight.
//
// The `filter=all` feed fans out ~12 parallel queries across multi-million-row
// tables (complaints_311, hpd_violations, dob_violations, nypd_complaints, …)
// plus building joins. Cold, that working set lives on Supabase's networked
// storage, so one uncached request can take 15–30s — enough to trip the 30s
// function limit in production (returning a 504, which is never cached, so the
// next request pays the same cost again) and to pin the dev server when
// requests stack up.
//
// Two layers prevent that:
//   1. unstable_cache — durable across requests, dev recompiles, and prod
//      instances (Next Data Cache / Vercel cache), keyed by filter+city. The
//      old module-level Map was per-instance and wiped on every dev recompile.
//   2. An in-flight promise map — collapses concurrent cache misses into one
//      computation, so a burst can't stampede the DB while the cache is cold.
//      This is the direct fix for "slow calls stack up and saturate".
// ---------------------------------------------------------------------------
const FEED_REVALIDATE = 600; // seconds — matches the ticker's next.revalidate

const inflight = new Map<string, Promise<ActivityItem[]>>();

/** Durable-cached + single-flight accessor for the full merged feed. */
function getActivityItems(
  filter: string,
  cityParam: string | null
): Promise<ActivityItem[]> {
  const key = `${filter}:${cityParam || "all"}`;
  const existing = inflight.get(key);
  if (existing) return existing; // coalesce concurrent misses → one DB fan-out

  const cached = unstable_cache(
    () => computeActivityItems(filter, cityParam),
    ["activity-feed", filter, cityParam || "all"],
    { revalidate: FEED_REVALIDATE, tags: ["activity-feed"] }
  );

  const promise = cached().finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

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

    // Single-flight + durable cache live in getActivityItems; pagination is
    // applied here so every page/limit shares one cached computation.
    const items = await getActivityItems(filter, cityParam);

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

/**
 * Compute the full merged, date-sorted activity feed for a (filter, city).
 * Expensive: fans out across every source table and normalizes the rows.
 * Wrapped by getActivityItems (unstable_cache + single-flight) so this body
 * runs at most once per (filter, city) per revalidate window per instance.
 *
 * Uses only cookie-free clients (service-role admin, else the anon cache
 * client) so it is safe to execute inside unstable_cache.
 */
async function computeActivityItems(
  filter: string,
  cityParam: string | null
): Promise<ActivityItem[]> {
    // Only reached on a cache miss, so this also confirms single-flight: a burst
    // of concurrent requests should emit exactly one "computed feed" line.
    const startedAt = Date.now();
    const metro = cityToMetro(cityParam);

    // When fetching all types, ~12 source queries run; cap each low so the cold
    // cache-fill stays well under maxDuration and light on the DB. 120/source
    // still far exceeds anything rendered (ticker shows 30, the feed paginates
    // ~30/page) and leaves the recent items + their ordering unchanged — only
    // very deep "all" pagination is trimmed. A single-filter request runs just
    // one query, so it can afford far more rows for deep pagination.
    const perSourceLimit = filter === "all" ? 120 : 2000;

    // Prefer admin client (no 3s anon timeout); fall back to the anon cache
    // client (also cookie-free, so unstable_cache stays happy).
    const supabase = getAdminClient() ?? createCacheClient();

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

    // Helper: conditionally apply metro filter (skip when fetching all cities)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function withMetro<T extends { eq: (col: string, val: string) => T }>(query: T): T {
      return metro ? query.eq("metro", metro) : query;
    }

    // Conditionally fetch based on filter — scoped to metro (city) when provided
    if (filter === "all" || filter === "reviews") {
      const q = supabase
        .from("reviews")
        .select("id, title, overall_rating, created_at, building_id, metro, buildings(full_address, borough, slug)")
        .not("building_id", "is", null);
      promises.push(
        withMetro(q)
          .gte("created_at", cutoffDate)
          .lte("created_at", maxDate)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(perSourceLimit)
      );
    } else {
      promises.push(Promise.resolve({ data: null, error: null }));
    }

    if (filter === "all" || filter === "violations") {
      const q = supabase
        .from("hpd_violations")
        .select("id, class, nov_description, inspection_date, building_id, metro, buildings(full_address, borough, slug)")
        .not("building_id", "is", null);
      promises.push(
        withMetro(q)
          .gte("inspection_date", cutoffDate.slice(0, 10))
          .lte("inspection_date", maxDateShort)
          .order("inspection_date", { ascending: false })
          .order("id", { ascending: false })
          .limit(perSourceLimit)
      );
    } else {
      promises.push(Promise.resolve({ data: null, error: null }));
    }

    if (filter === "all" || filter === "complaints") {
      const q = supabase
        .from("complaints_311")
        .select("id, complaint_type, descriptor, created_date, building_id, metro, buildings(full_address, borough, slug)")
        .not("building_id", "is", null);
      promises.push(
        withMetro(q)
          .gte("created_date", cutoffDate)
          .lte("created_date", maxDate)
          .order("created_date", { ascending: false })
          .order("id", { ascending: false })
          .limit(perSourceLimit)
      );
    } else {
      promises.push(Promise.resolve({ data: null, error: null }));
    }

    if (filter === "all" || filter === "litigations") {
      // Litigations are NYC-only; skip for non-NYC single-city requests
      if (!metro || metro === "nyc") {
        const q = supabase
          .from("hpd_litigations")
          .select("id, case_type, case_status, respondent, case_open_date, building_id, metro, buildings(full_address, borough, slug)")
          .not("building_id", "is", null)
          .not("case_open_date", "is", null)
          .eq("metro", "nyc");
        promises.push(
          q
            .gte("case_open_date", cutoffDate.slice(0, 10))
            .lte("case_open_date", maxDateShort)
            .order("case_open_date", { ascending: false })
            .order("id", { ascending: false })
            .limit(perSourceLimit)
        );
      } else {
        promises.push(Promise.resolve({ data: null, error: null }));
      }
    } else {
      promises.push(Promise.resolve({ data: null, error: null }));
    }

    if (filter === "all" || filter === "dob_violations") {
      const q = supabase
        .from("dob_violations")
        .select("id, violation_type, description, issue_date, building_id, metro, buildings(full_address, borough, slug)")
        .not("building_id", "is", null)
        .not("issue_date", "is", null);
      promises.push(
        withMetro(q)
          .gte("issue_date", cutoffDate.slice(0, 10))
          .lte("issue_date", maxDateShort)
          .order("issue_date", { ascending: false })
          .order("id", { ascending: false })
          .limit(perSourceLimit)
      );
    } else {
      promises.push(Promise.resolve({ data: null, error: null }));
    }

    if (filter === "all" || filter === "crime") {
      const q = supabase
        .from("nypd_complaints")
        .select("id, offense_description, pd_description, crime_category, law_category, cmplnt_date, borough, zip_code, metro")
        .in("crime_category", ["violent", "property"])
        .not("cmplnt_date", "is", null);
      promises.push(
        withMetro(q)
          .gte("cmplnt_date", cutoffDate.slice(0, 10))
          .lte("cmplnt_date", maxDateShort)
          .order("cmplnt_date", { ascending: false })
          .order("id", { ascending: false })
          .limit(perSourceLimit)
      );
    } else {
      promises.push(Promise.resolve({ data: null, error: null }));
    }

    if (filter === "all" || filter === "bedbugs") {
      // Bedbugs are NYC-only
      if (!metro || metro === "nyc") {
        promises.push(
          supabase
            .from("bedbug_reports")
            .select("id, infested_dwelling_unit_count, filing_date, building_id, metro, buildings(full_address, borough, slug)")
            .not("building_id", "is", null)
            .not("filing_date", "is", null)
            .eq("metro", "nyc")
            .gte("filing_date", cutoffDate.slice(0, 10))
            .lte("filing_date", maxDateShort)
            .order("filing_date", { ascending: false })
            .order("id", { ascending: false })
            .limit(perSourceLimit)
        );
      } else {
        promises.push(Promise.resolve({ data: null, error: null }));
      }
    } else {
      promises.push(Promise.resolve({ data: null, error: null }));
    }

    if (filter === "all" || filter === "evictions") {
      // Evictions are NYC-only
      if (!metro || metro === "nyc") {
        promises.push(
          supabase
            .from("evictions")
            .select("id, eviction_address, executed_date, borough, building_id, metro, buildings(full_address, borough, slug)")
            .not("building_id", "is", null)
            .not("executed_date", "is", null)
            .eq("metro", "nyc")
            .gte("executed_date", cutoffDate.slice(0, 10))
            .lte("executed_date", maxDateShort)
            .order("executed_date", { ascending: false })
            .order("id", { ascending: false })
            .limit(perSourceLimit)
        );
      } else {
        promises.push(Promise.resolve({ data: null, error: null }));
      }
    } else {
      promises.push(Promise.resolve({ data: null, error: null }));
    }

    // LAHD Evictions (LA-only)
    if (filter === "all" || filter === "la_eviction") {
      if (!metro || metro === "los-angeles") {
        promises.push(
          supabase
            .from("lahd_evictions")
            .select("id, eviction_category, notice_type, notice_date, received_date, address, building_id, metro, buildings(full_address, borough, slug)")
            .not("building_id", "is", null)
            .eq("metro", "los-angeles")
            .gte("received_date", cutoffDate.slice(0, 10))
            .lte("received_date", maxDateShort)
            .order("received_date", { ascending: false })
            .order("id", { ascending: false })
            .limit(perSourceLimit)
        );
      } else {
        promises.push(Promise.resolve({ data: null, error: null }));
      }
    } else {
      promises.push(Promise.resolve({ data: null, error: null }));
    }

    // LAHD Tenant Buyouts (LA-only)
    if (filter === "all" || filter === "tenant_buyout") {
      if (!metro || metro === "los-angeles") {
        promises.push(
          supabase
            .from("lahd_tenant_buyouts")
            .select("id, disclosure_date, compensation_amount, address, building_id, metro, buildings(full_address, borough, slug)")
            .not("building_id", "is", null)
            .not("disclosure_date", "is", null)
            .eq("metro", "los-angeles")
            .gte("disclosure_date", cutoffDate.slice(0, 10))
            .lte("disclosure_date", maxDateShort)
            .order("disclosure_date", { ascending: false })
            .order("id", { ascending: false })
            .limit(perSourceLimit)
        );
      } else {
        promises.push(Promise.resolve({ data: null, error: null }));
      }
    } else {
      promises.push(Promise.resolve({ data: null, error: null }));
    }

    // LA Building Permits
    if (filter === "all" || filter === "permit") {
      if (!metro || metro === "los-angeles") {
        promises.push(
          supabase
            .from("dob_permits")
            .select("id, work_permit, permit_status, work_type, job_description, issued_date, borough, building_id, metro, buildings(full_address, borough, slug)")
            .not("building_id", "is", null)
            .not("issued_date", "is", null)
            .eq("metro", "los-angeles")
            .gte("issued_date", cutoffDate.slice(0, 10))
            .lte("issued_date", maxDateShort)
            .order("issued_date", { ascending: false })
            .order("id", { ascending: false })
            .limit(perSourceLimit)
        );
      } else {
        promises.push(Promise.resolve({ data: null, error: null }));
      }
    } else {
      promises.push(Promise.resolve({ data: null, error: null }));
    }

    // LAHD CCRIS Enforcement Cases (LA-only)
    if (filter === "all" || filter === "enforcement") {
      if (!metro || metro === "los-angeles") {
        promises.push(
          supabase
            .from("lahd_ccris_cases")
            .select("id, case_type, start_date, total_complaints, open_complaints, address, building_id, metro, buildings(full_address, borough, slug)")
            .not("building_id", "is", null)
            .not("start_date", "is", null)
            .eq("metro", "los-angeles")
            .gte("start_date", cutoffDate.slice(0, 10))
            .lte("start_date", maxDateShort)
            .order("start_date", { ascending: false })
            .order("id", { ascending: false })
            .limit(perSourceLimit)
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
    const sourceNames = ["reviews", "violations", "complaints_311", "litigations", "dob_violations", "crime", "bedbugs", "evictions", "la_evictions", "buyouts", "permits", "enforcement"];
    for (let i = 0; i < results.length; i++) {
      if (results[i].error) {
        console.error(`Activity feed query [${sourceNames[i] || i}] failed:`, results[i].error);
        results[i].data = null; // Treat failed queries as empty
      }
    }

    const [reviewsResult, violationsResult, complaintsResult, litigationsResult, dobResult, crimeResult, bedbugResult, evictionResult, laEvictionResult, buyoutResult, permitResult, enforcementResult] = results;

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
          metro: r.metro as string,
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
          metro: v.metro as string,
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
          metro: c.metro as string,
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
          metro: l.metro as string,
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
          metro: d.metro as string,
        });
      }
    }

    // Normalize NYPD crimes
    if (crimeResult.data) {
      for (const cr of crimeResult.data as Record<string, unknown>[]) {
        const desc = cr.offense_description
          ? `${cr.offense_description}${cr.pd_description ? `: ${cr.pd_description}` : ""}`
          : (cr.metro === "los-angeles" ? "LAPD crime reported" : "NYPD crime reported");
        items.push({
          type: "crime",
          id: String(cr.id),
          description: (desc as string).length > 160 ? (desc as string).slice(0, 157) + "..." : desc as string,
          date: cr.cmplnt_date as string,
          buildingId: "",
          buildingAddress: cr.zip_code ? `Zip ${cr.zip_code}` : (cr.metro === "los-angeles" ? "Los Angeles" : "NYC"),
          borough: (cr.borough as string) || "",
          crimeCategory: cr.crime_category as string,
          zipCode: cr.zip_code as string,
          metro: cr.metro as string,
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
          metro: b.metro as string,
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
          metro: e.metro as string,
        });
      }
    }

    // Normalize LAHD evictions
    if (laEvictionResult.data) {
      for (const e of laEvictionResult.data as Record<string, unknown>[]) {
        const building = e.buildings as { full_address: string; borough: string; slug: string } | null;
        if (!building) continue;
        const cat = e.eviction_category ? String(e.eviction_category) : "";
        const noticeType = e.notice_type ? String(e.notice_type) : "";
        const desc = [cat, noticeType].filter(Boolean).join(" — ") || "LAHD eviction notice";
        items.push({
          type: "la_eviction",
          id: String(e.id),
          description: desc.length > 160 ? desc.slice(0, 157) + "..." : desc,
          date: (e.received_date || e.notice_date) as string,
          buildingId: e.building_id as string,
          buildingAddress: building.full_address,
          borough: building.borough,
          buildingSlug: building.slug,
          metro: e.metro as string,
        });
      }
    }

    // Normalize tenant buyouts
    if (buyoutResult.data) {
      for (const b of buyoutResult.data as Record<string, unknown>[]) {
        const building = b.buildings as { full_address: string; borough: string; slug: string } | null;
        if (!building) continue;
        const amount = b.compensation_amount ? Number(b.compensation_amount) : null;
        const desc = amount
          ? `Tenant buyout offer: $${amount.toLocaleString()}`
          : "Tenant buyout disclosure filed";
        items.push({
          type: "tenant_buyout",
          id: String(b.id),
          description: desc,
          date: b.disclosure_date as string,
          buildingId: b.building_id as string,
          buildingAddress: building.full_address,
          borough: building.borough,
          buildingSlug: building.slug,
          metro: b.metro as string,
        });
      }
    }

    // Normalize LA building permits
    if (permitResult.data) {
      for (const p of permitResult.data as Record<string, unknown>[]) {
        const building = p.buildings as { full_address: string; borough: string; slug: string } | null;
        if (!building) continue;
        const desc = p.job_description
          ? String(p.job_description)
          : p.work_type
            ? `Permit: ${p.work_type}`
            : "Building permit issued";
        items.push({
          type: "permit",
          id: String(p.id),
          description: (desc as string).length > 160 ? (desc as string).slice(0, 157) + "..." : desc as string,
          date: p.issued_date as string,
          buildingId: p.building_id as string,
          buildingAddress: building.full_address,
          borough: building.borough,
          buildingSlug: building.slug,
          metro: p.metro as string,
        });
      }
    }

    // Normalize LAHD CCRIS enforcement cases
    if (enforcementResult.data) {
      for (const c of enforcementResult.data as Record<string, unknown>[]) {
        const building = c.buildings as { full_address: string; borough: string; slug: string } | null;
        if (!building) continue;
        const complaints = c.open_complaints ? Number(c.open_complaints) : 0;
        const caseType = c.case_type ? String(c.case_type) : "Investigation";
        const desc = complaints > 0
          ? `${caseType} case — ${complaints} open complaint${complaints !== 1 ? "s" : ""}`
          : `${caseType} enforcement case opened`;
        items.push({
          type: "enforcement",
          id: String(c.id),
          description: desc,
          date: c.start_date as string,
          buildingId: c.building_id as string,
          buildingAddress: building.full_address,
          borough: building.borough,
          buildingSlug: building.slug,
          metro: c.metro as string,
        });
      }
    }

    // Deterministic sort: date DESC, then id DESC as tiebreaker
    items.sort((a, b) => {
      const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateDiff !== 0) return dateDiff;
      return b.id < a.id ? -1 : b.id > a.id ? 1 : 0;
    });

    console.log(
      `[activity] computed feed (filter=${filter}, city=${cityParam ?? "all"}): ${items.length} items in ${Date.now() - startedAt}ms`
    );
    return items;
}

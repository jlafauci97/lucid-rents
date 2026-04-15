import { createClient } from "@/lib/supabase/server";
import type { Building, EnergyBenchmark } from "@/types";
import { normalizeTimelineEvents, type TimelineEvent } from "@/lib/timeline";

// ──────────────────────────────────────────────────────────────
// scoreToGrade — maps 0-100 overall score → letter grade
// ──────────────────────────────────────────────────────────────
export function scoreToGrade(score: number | null): string {
  if (score === null || score === undefined) return "—";
  if (score >= 90) return "A+";
  if (score >= 85) return "A";
  if (score >= 80) return "A-";
  if (score >= 75) return "B+";
  if (score >= 70) return "B";
  if (score >= 65) return "B-";
  if (score >= 60) return "C+";
  if (score >= 55) return "C";
  if (score >= 50) return "C-";
  if (score >= 45) return "D";
  return "F";
}

// ──────────────────────────────────────────────────────────────
// Public type — exact shape every section/rail consumes
// ──────────────────────────────────────────────────────────────

export interface BuildingV2Data {
  building: Building;
  energy: EnergyBenchmark | null;
  rents: {
    current: Array<{
      bedrooms: number;
      min_rent: number | null;
      max_rent: number | null;
      median_rent: number | null;
      listing_count: number;
      source: string | null;
    }>;
    historic: Array<{
      month: string;
      beds: number;
      median_rent: number | null;
      avg_price_per_sqft: number | null;
      listing_count: number;
    }>;
    neighborhood: Array<{
      zip_code: string;
      month: string;
      median_rent: number | null;
    }>;
  };
  issues: {
    hpdTop: Array<{ category: string; count: number }>;
    complaintsTop: Array<{ type: string; count: number }>;
    recentViolations: Array<{
      id: string;
      source: "HPD" | "DOB" | "311" | "OTHER";
      date: string;
      category: string;
      class: string | null;
      status: string | null;
      description: string;
    }>;
    trends: Array<{
      month: string;
      hpd: number;
      dob: number;
      complaints: number;
      evictions: number;
    }>;
  };
  reviews: {
    total: number;
    avgRating: number;
    pullQuotes: Array<{
      id: string;
      body: string;
      rating: number;
      created_at: string;
      display_name: string | null;
    }>;
  };
  amenities: Array<{ amenity: string; category: string | null }>;
  landlord: {
    name: string | null;
    otherBuildings: Array<{
      id: string;
      full_address: string;
      slug: string;
      borough: string;
      overall_score: number | null;
    }>;
    portfolioSize: number;
    portfolioAvgScore: number | null;
  };
  similar: Array<{
    id: string;
    full_address: string;
    slug: string;
    borough: string;
    overall_score: number | null;
    year_built: number | null;
    total_units: number | null;
  }>;
  timeline: TimelineEvent[];
}

// ──────────────────────────────────────────────────────────────
// safe() — run a query, swallow errors, return fallback
// ──────────────────────────────────────────────────────────────

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.warn("[BuildingV2Data] safe() caught error:", err);
    return fallback;
  }
}

// ──────────────────────────────────────────────────────────────
// Main loader
// ──────────────────────────────────────────────────────────────

export async function loadBuildingV2Data(building: Building): Promise<BuildingV2Data> {
  const supabase = await createClient();
  const buildingId = building.id;
  const zipCode = building.zip_code ?? null;
  const ownerName = building.owner_name ?? building.management_company ?? null;

  const [
    energy,
    currentRents,
    historicRents,
    neighborhoodRents,
    hpdTop,
    complaintsTop,
    recentViolations,
    trends,
    reviewsAggregate,
    pullQuotes,
    amenities,
    landlordOtherBuildings,
    landlordStats,
    similar,
    timelineRaw,
  ] = await Promise.all([
    // Energy benchmark (latest year)
    safe(async () => {
      const { data } = await supabase
        .from("energy_benchmarks")
        .select("*")
        .eq("building_id", buildingId)
        .order("report_year", { ascending: false })
        .limit(1);
      return (data?.[0] as EnergyBenchmark) ?? null;
    }, null as EnergyBenchmark | null),

    // Current rents by bedroom
    safe(async () => {
      const { data } = await supabase
        .from("building_rents")
        .select("bedrooms, min_rent, max_rent, median_rent, listing_count, source")
        .eq("building_id", buildingId);
      return data ?? [];
    }, [] as BuildingV2Data["rents"]["current"]),

    // Historic monthly rents (last 12 months)
    safe(async () => {
      const { data } = await supabase
        .from("dewey_building_rents")
        .select("month, beds, median_rent, avg_price_per_sqft, listing_count")
        .eq("building_id", buildingId)
        .order("month", { ascending: false })
        .limit(12);
      return data ?? [];
    }, [] as BuildingV2Data["rents"]["historic"]),

    // Neighborhood median rents by zip
    // NOTE: dewey_neighborhood_rents uses "zip" column (not "zip_code")
    safe(async () => {
      if (!zipCode) return [];
      const { data } = await supabase
        .from("dewey_neighborhood_rents")
        .select("zip, month, median_rent")
        .eq("zip", zipCode)
        .order("month", { ascending: false })
        .limit(24);
      // Normalize "zip" → "zip_code" to match the BuildingV2Data shape
      return (data ?? []).map((r) => ({
        zip_code: (r as { zip: string }).zip,
        month: (r as { month: string }).month,
        median_rent: (r as { median_rent: number | null }).median_rent,
      }));
    }, [] as BuildingV2Data["rents"]["neighborhood"]),

    // Top HPD violation categories (by class: A/B/C/I)
    safe(async () => {
      const { data } = await supabase
        .from("hpd_violations")
        .select("class")
        .eq("building_id", buildingId);
      if (!data) return [];
      const counts = new Map<string, number>();
      for (const row of data) {
        const key = (row as { class: string | null }).class ?? "Other";
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      return Array.from(counts.entries())
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    }, [] as BuildingV2Data["issues"]["hpdTop"]),

    // Top 311 complaint types
    safe(async () => {
      const { data } = await supabase
        .from("complaints_311")
        .select("complaint_type")
        .eq("building_id", buildingId);
      if (!data) return [];
      const counts = new Map<string, number>();
      for (const row of data) {
        const key = (row as { complaint_type: string | null }).complaint_type ?? "Other";
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      return Array.from(counts.entries())
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    }, [] as BuildingV2Data["issues"]["complaintsTop"]),

    // Recent violations across HPD + DOB + 311 (top 20)
    // NOTE: hpd_violations uses "nov_description" and "status" (not "novdescription"/"currentstatus")
    safe(async () => {
      const [hpdRes, dobRes, compRes] = await Promise.all([
        supabase
          .from("hpd_violations")
          .select("id, inspection_date, class, nov_description, status")
          .eq("building_id", buildingId)
          .order("inspection_date", { ascending: false })
          .limit(10),
        supabase
          .from("dob_violations")
          .select("id, issue_date, violation_type, violation_category, disposition_comments, disposition_date")
          .eq("building_id", buildingId)
          .order("issue_date", { ascending: false })
          .limit(10),
        supabase
          .from("complaints_311")
          .select("id, created_date, complaint_type, descriptor, status")
          .eq("building_id", buildingId)
          .order("created_date", { ascending: false })
          .limit(10),
      ]);
      const hpd = (hpdRes.data ?? []).map((r) => ({
        id: String((r as { id: string | number }).id),
        source: "HPD" as const,
        date: String((r as { inspection_date: string | null }).inspection_date ?? ""),
        category: String((r as { class: string | null }).class ?? "Violation"),
        class: (r as { class: string | null }).class ?? null,
        status: (r as { status: string | null }).status ?? null,
        description: String((r as { nov_description: string | null }).nov_description ?? ""),
      }));
      const dob = (dobRes.data ?? []).map((r) => ({
        id: String((r as { id: string | number }).id),
        source: "DOB" as const,
        date: String((r as { issue_date: string | null }).issue_date ?? ""),
        category: String((r as { violation_category: string | null }).violation_category ?? "Violation"),
        class: (r as { violation_type: string | null }).violation_type ?? null,
        status: (r as { disposition_comments: string | null }).disposition_comments ?? null,
        description: String((r as { disposition_comments: string | null }).disposition_comments ?? ""),
      }));
      const comp = (compRes.data ?? []).map((r) => ({
        id: String((r as { id: string | number }).id),
        source: "311" as const,
        date: String((r as { created_date: string | null }).created_date ?? ""),
        category: String((r as { complaint_type: string | null }).complaint_type ?? "Complaint"),
        class: null,
        status: (r as { status: string | null }).status ?? null,
        description: String((r as { descriptor: string | null }).descriptor ?? ""),
      }));
      return [...hpd, ...dob, ...comp]
        .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
        .slice(0, 20);
    }, [] as BuildingV2Data["issues"]["recentViolations"]),

    // Monthly trends for last 84 months (7 years)
    safe(async () => {
      const since = new Date();
      since.setFullYear(since.getFullYear() - 7);
      const sinceISO = since.toISOString().slice(0, 10);

      const [hpdRes, dobRes, compRes, evictRes] = await Promise.all([
        supabase
          .from("hpd_violations")
          .select("inspection_date")
          .eq("building_id", buildingId)
          .gte("inspection_date", sinceISO),
        supabase
          .from("dob_violations")
          .select("issue_date")
          .eq("building_id", buildingId)
          .gte("issue_date", sinceISO),
        supabase
          .from("complaints_311")
          .select("created_date")
          .eq("building_id", buildingId)
          .gte("created_date", sinceISO),
        supabase
          .from("evictions")
          .select("executed_date")
          .eq("building_id", buildingId)
          .gte("executed_date", sinceISO),
      ]);

      const buckets = new Map<string, { hpd: number; dob: number; complaints: number; evictions: number }>();
      const bucket = (m: string) => {
        if (!buckets.has(m)) buckets.set(m, { hpd: 0, dob: 0, complaints: 0, evictions: 0 });
        return buckets.get(m)!;
      };
      const month = (d: string | null) => (d ?? "").slice(0, 7);

      for (const r of hpdRes.data ?? []) {
        const m = month((r as { inspection_date: string | null }).inspection_date);
        if (m) bucket(m).hpd++;
      }
      for (const r of dobRes.data ?? []) {
        const m = month((r as { issue_date: string | null }).issue_date);
        if (m) bucket(m).dob++;
      }
      for (const r of compRes.data ?? []) {
        const m = month((r as { created_date: string | null }).created_date);
        if (m) bucket(m).complaints++;
      }
      for (const r of evictRes.data ?? []) {
        const m = month((r as { executed_date: string | null }).executed_date);
        if (m) bucket(m).evictions++;
      }

      return Array.from(buckets.entries())
        .map(([month, v]) => ({ month, ...v }))
        .sort((a, b) => a.month.localeCompare(b.month));
    }, [] as BuildingV2Data["issues"]["trends"]),

    // Reviews aggregate (count + avg)
    // NOTE: reviews table uses "overall_rating" not "rating"
    safe(async () => {
      const { data } = await supabase
        .from("reviews")
        .select("overall_rating")
        .eq("building_id", buildingId)
        .eq("status", "published");
      const arr = (data as Array<{ overall_rating: number | null }> | null) ?? [];
      const ratings = arr.map((r) => r.overall_rating).filter((n): n is number => typeof n === "number");
      const total = ratings.length;
      const avgRating = total ? ratings.reduce((a, b) => a + b, 0) / total : 0;
      return { total, avgRating };
    }, { total: 0, avgRating: 0 } as { total: number; avgRating: number }),

    // Pull quotes: top 3 newest published reviews
    // NOTE: reviews table uses "overall_rating" not "rating"
    safe(async () => {
      const { data } = await supabase
        .from("reviews")
        .select("id, body, overall_rating, created_at, profile:profiles(display_name)")
        .eq("building_id", buildingId)
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(3);
      return (data ?? []).map((r) => ({
        id: String((r as { id: string | number }).id),
        body: String((r as { body: string | null }).body ?? ""),
        rating: Number((r as { overall_rating: number | null }).overall_rating ?? 0),
        created_at: String((r as { created_at: string | null }).created_at ?? ""),
        display_name: (() => {
          const raw = (r as unknown as { profile?: unknown }).profile;
          if (!raw) return null;
          if (Array.isArray(raw)) {
            return (raw as Array<{ display_name: string | null }>)[0]?.display_name ?? null;
          }
          return (raw as { display_name: string | null }).display_name ?? null;
        })(),
      }));
    }, [] as BuildingV2Data["reviews"]["pullQuotes"]),

    // Amenities
    safe(async () => {
      const { data } = await supabase
        .from("building_amenities")
        .select("amenity, category")
        .eq("building_id", buildingId);
      return data ?? [];
    }, [] as BuildingV2Data["amenities"]),

    // Landlord: other buildings (up to 6)
    safe(async () => {
      if (!ownerName) return [];
      const column = building.management_company ? "management_company" : "owner_name";
      const { data } = await supabase
        .from("buildings")
        .select("id, full_address, slug, borough, overall_score")
        .eq(column, ownerName)
        .neq("id", buildingId)
        .limit(6);
      return data ?? [];
    }, [] as BuildingV2Data["landlord"]["otherBuildings"]),

    // Landlord stats: portfolio size + avg score
    safe(async () => {
      if (!ownerName) return { portfolioSize: 0, portfolioAvgScore: null };
      const column = building.management_company ? "management_company" : "owner_name";
      const { data } = await supabase
        .from("buildings")
        .select("overall_score")
        .eq(column, ownerName);
      const arr = (data as Array<{ overall_score: number | null }> | null) ?? [];
      const portfolioSize = arr.length;
      const scores = arr.map((r) => r.overall_score).filter((n): n is number => typeof n === "number");
      const portfolioAvgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
      return { portfolioSize, portfolioAvgScore };
    }, { portfolioSize: 0, portfolioAvgScore: null } as { portfolioSize: number; portfolioAvgScore: number | null }),

    // Similar buildings (proxied by zip + non-self) — up to 6
    safe(async () => {
      if (!zipCode) return [];
      const { data } = await supabase
        .from("buildings")
        .select("id, full_address, slug, borough, overall_score, year_built, total_units")
        .eq("zip_code", zipCode)
        .neq("id", buildingId)
        .limit(6);
      return data ?? [];
    }, [] as BuildingV2Data["similar"]),

    // Timeline: HPD violations + DOB violations + 311 complaints + evictions (last 20 events)
    safe(async () => {
      const [hpdRes, dobRes, compRes, evictRes] = await Promise.all([
        supabase
          .from("hpd_violations")
          .select("id, inspection_date, nov_issue_date, class, nov_description, status")
          .eq("building_id", buildingId)
          .order("inspection_date", { ascending: false })
          .limit(20),
        supabase
          .from("dob_violations")
          .select("id, issue_date, violation_category, violation_type, description, disposition_comments")
          .eq("building_id", buildingId)
          .order("issue_date", { ascending: false })
          .limit(20),
        supabase
          .from("complaints_311")
          .select("id, created_date, complaint_type, descriptor, status, resolution_description, agency")
          .eq("building_id", buildingId)
          .order("created_date", { ascending: false })
          .limit(20),
        supabase
          .from("evictions")
          .select("id, executed_date, eviction_apt_num, eviction_possession, residential_commercial")
          .eq("building_id", buildingId)
          .order("executed_date", { ascending: false })
          .limit(10),
      ]);
      return normalizeTimelineEvents({
        violations: (hpdRes.data ?? []) as Parameters<typeof normalizeTimelineEvents>[0]["violations"],
        dobViolations: (dobRes.data ?? []) as Parameters<typeof normalizeTimelineEvents>[0]["dobViolations"],
        complaints: (compRes.data ?? []) as Parameters<typeof normalizeTimelineEvents>[0]["complaints"],
        evictions: (evictRes.data ?? []) as Parameters<typeof normalizeTimelineEvents>[0]["evictions"],
      }).slice(0, 20);
    }, [] as TimelineEvent[]),
  ]);

  return {
    building,
    energy,
    rents: {
      current: currentRents,
      historic: historicRents,
      neighborhood: neighborhoodRents,
    },
    issues: {
      hpdTop,
      complaintsTop,
      recentViolations,
      trends,
    },
    reviews: {
      total: reviewsAggregate.total,
      avgRating: reviewsAggregate.avgRating,
      pullQuotes,
    },
    amenities,
    landlord: {
      name: ownerName,
      otherBuildings: landlordOtherBuildings,
      portfolioSize: landlordStats.portfolioSize,
      portfolioAvgScore: landlordStats.portfolioAvgScore,
    },
    similar,
    timeline: timelineRaw,
  };
}

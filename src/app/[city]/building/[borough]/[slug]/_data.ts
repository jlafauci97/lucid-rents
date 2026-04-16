import { createClient } from "@/lib/supabase/server";
import type { Building, EnergyBenchmark } from "@/types";
import { normalizeTimelineEvents, type TimelineEvent } from "@/lib/timeline";
import { normalizeScore } from "@/lib/constants";

// ──────────────────────────────────────────────────────────────
// scoreToGrade — maps a score to a letter grade.
// Overall scores are stored on a 0–5 scale (star rating), with some legacy
// 0–100 values still floating around. `normalizeScore` handles both.
// Fine-grained grade letters (+/-) match the mockup's verdict card.
// ──────────────────────────────────────────────────────────────
export function scoreToGrade(score: number | null): string {
  if (score === null || score === undefined) return "—";
  const s = normalizeScore(score); // → 0-5
  if (s >= 4.75) return "A+";
  if (s >= 4.35) return "A";
  if (s >= 4.0)  return "A-";
  if (s >= 3.65) return "B+";
  if (s >= 3.3)  return "B";
  if (s >= 3.0)  return "B-";
  if (s >= 2.65) return "C+";
  if (s >= 2.3)  return "C";
  if (s >= 2.0)  return "C-";
  if (s >= 1.0)  return "D";
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
      beds: number | null;
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
    hpdViolations: Array<{
      id: number;
      apartment: string | null;
      class: string | null;
      status: string | null;
      inspection_date: string | null;
      nov_description: string | null;
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
    distribution: Array<{ stars: 1 | 2 | 3 | 4 | 5; count: number; pct: number }>;
    pullQuotes: Array<{
      id: string;
      body: string;
      rating: number;
      created_at: string;
      display_name: string | null;
    }>;
  };
  nearby: {
    transitSubway: Array<{ stop_id: string; name: string; lines: string[]; distMiles: number; walkMin: number }>;
    transitBus: Array<{ stop_id: string; name: string; lines: string[]; distMiles: number; walkMin: number }>;
    schoolsPublic: Array<{ school_id: string; name: string; grades: string | null; distMiles: number; walkMin: number }>;
    schoolsCharter: Array<{ school_id: string; name: string; grades: string | null; distMiles: number; walkMin: number }>;
    schoolsPrivate: Array<{ school_id: string; name: string; grades: string | null; distMiles: number; walkMin: number }>;
  };
  crime: {
    // Last 12 months, within ~0.5 mi (via zip aggregation).
    total12mo: number;
    violent: number;
    property: number;
    qualityOfLife: number;
    // Rough safety score 0-100 (100 = safest). Derived from per-capita density.
    safetyScore: number;
    precinct: string | null;
  };
  neighborhoodStats: {
    // Aggregated over buildings in the same zip.
    buildingsTracked: number;
    avgLucidIQ: number | null;   // 0–5 scale
    median1BR: number | null;    // latest monthly neighborhood median for 1BR
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
  laData: {
    buyouts: Array<{ id: string; disclosure_date: string | null; compensation_amount: number | null }>;
    scepInspections: Array<{ id: string; inspection_date: string | null; compliance_status: string | null; violations_found: number | null }>;
    earthquakeRetrofit: { retrofit_type: string | null; compliance_status: string | null; deadline: string | null; completion_date: string | null } | null;
  };
  chicagoData: {
    rltoViolations: Array<{ id: string; case_number: string | null; violation_date: string | null; violation_description: string | null; status: string | null }>;
    demolitions: Array<{ id: string; permit_number: string | null; issue_date: string | null; status: string | null; work_description: string | null }>;
    leadInspections: Array<{ id: string; inspection_date: string | null; result: string | null; risk_level: string | null }>;
    affordableUnits: Array<{ id: string; project_name: string | null; affordable_units: number | null; total_units: number | null }>;
    energyRating: { energy_star_score: number | null; report_year: number | null; site_eui: number | null } | null;
  };
  miamiData: {
    recerts: Array<{ id: string; recertification_status: string | null; due_date: string | null; completion_date: string | null }>;
    unsafeStructures: Array<{ id: string; case_number: string | null; violation_type: string | null; case_date: string | null; status: string | null }>;
    stormDamage: Array<{ id: string; disaster_name: string | null; disaster_date: string | null; damage_category: string | null; fema_verified_loss: number | null }>;
    floodClaims: Array<{ id: string; claim_date: string | null; flood_zone: string | null; amount_paid: number | null }>;
  };
  houstonData: {
    dangerousBuildings: Array<{ id: string; case_number: string | null; status: string | null; case_date: string | null; violation_description: string | null }>;
    industrialProximity: Array<{ id: string; facility_name: string | null; distance_miles: number | null; industry_type: string | null; total_releases_lbs: number | null }>;
    taxProtests: Array<{ id: string; protest_year: number | null; original_value: number | null; final_value: number | null; reduction_pct: number | null }>;
    affordableHousing: Array<{ id: string; project_name: string | null; affordable_units: number | null; total_units: number | null }>;
  };
}

// ──────────────────────────────────────────────────────────────
// Shared categorizers (mirror production page conventions)
// ──────────────────────────────────────────────────────────────
function categorizeHpdViolation(desc: string): string {
  const d = (desc ?? "").toUpperCase();
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
}

// ──────────────────────────────────────────────────────────────
// Haversine distance — for nearby queries
// ──────────────────────────────────────────────────────────────
function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
const walkMin = (miles: number) => Math.max(1, Math.round(miles * 20));

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
  const isLA = building.metro === "los-angeles";
  const isChicago = building.metro === "chicago";
  const isMiami = building.metro === "miami";
  const isHouston = building.metro === "houston";

  type LaBuyout = BuildingV2Data["laData"]["buyouts"][number];
  type LaScep = BuildingV2Data["laData"]["scepInspections"][number];
  type LaRetrofit = NonNullable<BuildingV2Data["laData"]["earthquakeRetrofit"]>;
  type ChicagoRlto = BuildingV2Data["chicagoData"]["rltoViolations"][number];
  type ChicagoDemo = BuildingV2Data["chicagoData"]["demolitions"][number];
  type ChicagoLead = BuildingV2Data["chicagoData"]["leadInspections"][number];
  type ChicagoAffordable = BuildingV2Data["chicagoData"]["affordableUnits"][number];
  type ChicagoEnergy = NonNullable<BuildingV2Data["chicagoData"]["energyRating"]>;
  type MiamiRecert = BuildingV2Data["miamiData"]["recerts"][number];
  type MiamiUnsafe = BuildingV2Data["miamiData"]["unsafeStructures"][number];
  type MiamiStorm = BuildingV2Data["miamiData"]["stormDamage"][number];
  type MiamiFlood = BuildingV2Data["miamiData"]["floodClaims"][number];
  type HoustonDangerous = BuildingV2Data["houstonData"]["dangerousBuildings"][number];
  type HoustonIndustrial = BuildingV2Data["houstonData"]["industrialProximity"][number];
  type HoustonTax = BuildingV2Data["houstonData"]["taxProtests"][number];
  type HoustonAffordable = BuildingV2Data["houstonData"]["affordableHousing"][number];

  const [
    energy,
    currentRents,
    historicRents,
    neighborhoodRents,
    hpdTop,
    complaintsTop,
    recentViolations,
    hpdViolations,
    trends,
    reviewsAggregate,
    pullQuotes,
    amenities,
    landlordOtherBuildings,
    landlordStats,
    similar,
    timelineRaw,
    nearbyTransit,
    nearbySchools,
    crimeAgg,
    neighborhoodStats,
    laBuyouts,
    laScep,
    laRetrofit,
    chicagoRlto,
    chicagoDemolitions,
    chicagoLead,
    chicagoAffordable,
    chicagoEnergy,
    miamiRecerts,
    miamiUnsafe,
    miamiStorm,
    miamiFlood,
    houstonDangerous,
    houstonIndustrial,
    houstonTax,
    houstonAffordable,
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

    // Neighborhood median rents by zip (per bedroom)
    // NOTE: dewey_neighborhood_rents uses "zip" column (not "zip_code")
    safe(async () => {
      if (!zipCode) return [];
      const { data } = await supabase
        .from("dewey_neighborhood_rents")
        .select("zip, month, beds, median_rent")
        .eq("zip", zipCode)
        .order("month", { ascending: false })
        .limit(60);
      return (data ?? []).map((r) => ({
        zip_code: (r as { zip: string }).zip,
        month: (r as { month: string }).month,
        beds: (r as { beds: number | null }).beds,
        median_rent: (r as { median_rent: number | null }).median_rent,
      }));
    }, [] as BuildingV2Data["rents"]["neighborhood"]),

    // Top HPD violation categories — categorize by nov_description
    // (Paint/Plaster, Water Leak, Heat/Hot Water, etc.) to match the production
    // page. Query nov_description without a non-null filter so rows with
    // empty descriptions still count as "Other uncategorized" rather than
    // silently falling back to raw class letters.
    safe(async () => {
      const { data } = await supabase
        .from("hpd_violations")
        .select("nov_description")
        .eq("building_id", buildingId)
        .order("inspection_date", { ascending: false })
        .limit(200);
      if (!data) return [];
      const counts = new Map<string, number>();
      let uncategorized = 0;
      for (const row of data) {
        const desc = (row as { nov_description: string | null }).nov_description ?? "";
        if (!desc.trim()) { uncategorized++; continue; }
        const cat = categorizeHpdViolation(desc);
        if (cat === "Other") { uncategorized++; continue; }
        counts.set(cat, (counts.get(cat) ?? 0) + 1);
      }
      const ranked = Array.from(counts.entries())
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      // If every violation fell through to Other (description missing), surface
      // a single "Uncategorized" row so the card still has meaningful content.
      if (ranked.length === 0 && uncategorized > 0) {
        return [{ category: "Uncategorized", count: uncategorized }];
      }
      return ranked;
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

    // HPD violations with apartment field for ViolationsByUnit
    safe(async () => {
      const { data } = await supabase
        .from("hpd_violations")
        .select("id, apartment, class, status, inspection_date, nov_description")
        .eq("building_id", buildingId)
        .order("inspection_date", { ascending: false })
        .limit(500);
      return (data ?? []).map((r) => ({
        id: (r as { id: number }).id,
        apartment: (r as { apartment: string | null }).apartment,
        class: (r as { class: string | null }).class,
        status: (r as { status: string | null }).status,
        inspection_date: (r as { inspection_date: string | null }).inspection_date,
        nov_description: (r as { nov_description: string | null }).nov_description,
      }));
    }, [] as BuildingV2Data["issues"]["hpdViolations"]),

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
      // Bucket ratings into 5 stars (rounded).
      const buckets = [0, 0, 0, 0, 0]; // index 0 = 1★, 4 = 5★
      for (const r of ratings) {
        const stars = Math.max(1, Math.min(5, Math.round(r)));
        buckets[stars - 1]++;
      }
      const distribution = [1, 2, 3, 4, 5].map((s, i) => ({
        stars: s as 1 | 2 | 3 | 4 | 5,
        count: buckets[i],
        pct: total ? Math.round((buckets[i] / total) * 100) : 0,
      }));
      return { total, avgRating, distribution };
    }, { total: 0, avgRating: 0, distribution: [1,2,3,4,5].map((s) => ({ stars: s as 1|2|3|4|5, count: 0, pct: 0 })) } as { total: number; avgRating: number; distribution: BuildingV2Data["reviews"]["distribution"] }),

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
        .eq("metro", building.metro)
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
        .eq(column, ownerName)
        .eq("metro", building.metro);
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

    // Nearby transit (subway + bus) — pulls from transit_stops within bbox, sorted by haversine.
    safe(async () => {
      const lat = building.latitude; const lng = building.longitude;
      if (lat == null || lng == null) return { subway: [], bus: [] };
      const BBOX = 0.012; // ~0.8 mi
      const { data } = await supabase
        .from("transit_stops")
        .select("type, stop_id, name, latitude, longitude, routes")
        .gte("latitude", lat - BBOX).lte("latitude", lat + BBOX)
        .gte("longitude", lng - BBOX).lte("longitude", lng + BBOX)
        .limit(60);
      const rows = (data ?? []) as Array<{ type: string | null; stop_id: string; name: string; latitude: number; longitude: number; routes: string[] | null }>;
      const enriched = rows.map((r) => ({
        type: (r.type ?? "").toLowerCase(),
        stop_id: r.stop_id,
        name: r.name,
        lines: r.routes ?? [],
        distMiles: haversineMiles(lat, lng, r.latitude, r.longitude),
      })).sort((a, b) => a.distMiles - b.distMiles);
      const subway = enriched.filter((r) => r.type === "subway" || r.type === "rail" || r.type === "metro").slice(0, 4).map((r) => ({ stop_id: r.stop_id, name: r.name, lines: r.lines, distMiles: r.distMiles, walkMin: walkMin(r.distMiles) }));
      const bus = enriched.filter((r) => r.type === "bus").slice(0, 4).map((r) => ({ stop_id: r.stop_id, name: r.name, lines: r.lines, distMiles: r.distMiles, walkMin: walkMin(r.distMiles) }));
      return { subway, bus };
    }, { subway: [], bus: [] } as { subway: BuildingV2Data["nearby"]["transitSubway"]; bus: BuildingV2Data["nearby"]["transitBus"] }),

    // Nearby schools — pulls from nearby_schools within bbox.
    safe(async () => {
      const lat = building.latitude; const lng = building.longitude;
      if (lat == null || lng == null) return { pub: [], charter: [], priv: [] };
      const BBOX = 0.012;
      const { data } = await supabase
        .from("nearby_schools")
        .select("type, school_id, name, grades, latitude, longitude")
        .gte("latitude", lat - BBOX).lte("latitude", lat + BBOX)
        .gte("longitude", lng - BBOX).lte("longitude", lng + BBOX)
        .limit(60);
      const rows = (data ?? []) as Array<{ type: string | null; school_id: string; name: string; grades: string | null; latitude: number; longitude: number }>;
      const enriched = rows.map((r) => ({ ...r, distMiles: haversineMiles(lat, lng, r.latitude, r.longitude) })).sort((a, b) => a.distMiles - b.distMiles);
      const pub = enriched.filter((r) => /public/i.test(r.type ?? "")).slice(0, 4).map((r) => ({ school_id: r.school_id, name: r.name, grades: r.grades, distMiles: r.distMiles, walkMin: walkMin(r.distMiles) }));
      const charter = enriched.filter((r) => /charter/i.test(r.type ?? "")).slice(0, 3).map((r) => ({ school_id: r.school_id, name: r.name, grades: r.grades, distMiles: r.distMiles, walkMin: walkMin(r.distMiles) }));
      const priv = enriched.filter((r) => /priv/i.test(r.type ?? "")).slice(0, 3).map((r) => ({ school_id: r.school_id, name: r.name, grades: r.grades, distMiles: r.distMiles, walkMin: walkMin(r.distMiles) }));
      return { pub, charter, priv };
    }, { pub: [], charter: [], priv: [] } as { pub: BuildingV2Data["nearby"]["schoolsPublic"]; charter: BuildingV2Data["nearby"]["schoolsCharter"]; priv: BuildingV2Data["nearby"]["schoolsPrivate"] }),

    // Crime — last 12 months in the zip (approximation for "0.5 mi radius").
    safe(async () => {
      if (!zipCode) return { total12mo: 0, violent: 0, property: 0, qualityOfLife: 0, safetyScore: 50, precinct: null };

      // Miami: prefer incident-level data scraped from CrimeMapping.com (lives in
      // nypd_complaints with metro='miami'). Fall back to FDLE UCR annual
      // aggregates when no incidents are on file for this zip.
      if (building.metro === "miami") {
        const since = new Date(); since.setMonth(since.getMonth() - 12);
        const { data: incidents } = await supabase
          .from("nypd_complaints")
          .select("crime_category, law_category, precinct")
          .eq("metro", "miami")
          .eq("zip_code", zipCode)
          .gte("cmplnt_date", since.toISOString().slice(0, 10));
        const incidentRows = (incidents ?? []) as Array<{ crime_category: string | null; law_category: string | null; precinct: string | number | null }>;

        if (incidentRows.length > 0) {
          let violent = 0, property = 0, qol = 0;
          const precinctCounts = new Map<string, number>();
          for (const r of incidentRows) {
            const cat = (r.crime_category ?? "").toLowerCase();
            if (cat === "violent") violent++;
            else if (cat === "property") property++;
            else qol++;
            if (r.precinct != null) {
              const key = String(r.precinct);
              precinctCounts.set(key, (precinctCounts.get(key) ?? 0) + 1);
            }
          }
          const total12mo = incidentRows.length;
          // Same density benchmark as NYC: ~1200 incidents/yr ⇒ 0; 0 ⇒ 100.
          const safetyScore = Math.max(0, Math.min(100, Math.round(100 - (total12mo / 12))));
          const precinct = [...precinctCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
          return { total12mo, violent, property, qualityOfLife: qol, safetyScore, precinct };
        }

        // Fall back to annual aggregates apportioned from FDLE UCR.
        const { data: agg } = await supabase
          .from("miami_crime_aggregates")
          .select("total_incidents, violent_count, property_count, qol_count")
          .eq("zip", zipCode)
          .order("year", { ascending: false })
          .limit(1);
        const row = agg?.[0];
        if (!row) return { total12mo: 0, violent: 0, property: 0, qualityOfLife: 0, safetyScore: 50, precinct: null };
        const total = row.total_incidents ?? 0;
        const safetyScore = Math.max(0, Math.min(100, Math.round(100 - (total / 120))));
        return {
          total12mo: total,
          violent: row.violent_count ?? 0,
          property: row.property_count ?? 0,
          qualityOfLife: row.qol_count ?? 0,
          safetyScore,
          precinct: null,
        };
      }

      if (building.metro !== "nyc") return { total12mo: 0, violent: 0, property: 0, qualityOfLife: 0, safetyScore: 50, precinct: null };
      const since = new Date(); since.setMonth(since.getMonth() - 12);
      const { data } = await supabase
        .from("nypd_complaints")
        .select("crime_category, law_category, precinct")
        .eq("zip_code", zipCode)
        .gte("cmplnt_date", since.toISOString().slice(0, 10));
      const rows = (data ?? []) as Array<{ crime_category: string | null; law_category: string | null; precinct: string | null }>;
      let violent = 0, property = 0, qol = 0;
      const precinctCounts = new Map<string, number>();
      for (const r of rows) {
        const cat = (r.crime_category ?? "").toLowerCase();
        const law = (r.law_category ?? "").toLowerCase();
        if (/violent|assault|robbery|murder|rape|weapon/.test(cat)) violent++;
        else if (/property|burglary|larceny|theft|grand|petit/.test(cat)) property++;
        else qol++;
        if (law === "violation" || /misdemean/.test(cat)) {
          if (!/violent|assault|robbery|murder|rape/.test(cat)) qol++;
        }
        if (r.precinct) precinctCounts.set(r.precinct, (precinctCounts.get(r.precinct) ?? 0) + 1);
      }
      const total12mo = rows.length;
      // Safety score: lower density = higher score. Benchmark zip typical density ~ 800 incidents/yr.
      const safetyScore = Math.max(0, Math.min(100, Math.round(100 - (total12mo / 12))));
      const precinct = [...precinctCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      return { total12mo, violent, property, qualityOfLife: qol, safetyScore, precinct };
    }, { total12mo: 0, violent: 0, property: 0, qualityOfLife: 0, safetyScore: 50, precinct: null } as BuildingV2Data["crime"]),

    // Neighborhood stats — buildings tracked + avg score + median 1BR for this zip.
    safe(async () => {
      if (!zipCode) return { buildingsTracked: 0, avgLucidIQ: null, median1BR: null };
      // Buildings in this zip
      const { data: nbhBuildings } = await supabase
        .from("buildings")
        .select("id, overall_score")
        .eq("zip_code", zipCode);
      const rows = (nbhBuildings ?? []) as Array<{ id: string; overall_score: number | null }>;
      const buildingsTracked = rows.length;
      const scores = rows.map((b) => b.overall_score).filter((n): n is number => typeof n === "number");
      const avgLucidIQ = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

      // Latest 1BR neighborhood median — try dewey_neighborhood_rents first.
      let median1BR: number | null = null;
      const { data: deweyRents } = await supabase
        .from("dewey_neighborhood_rents")
        .select("month, beds, median_rent")
        .eq("zip", zipCode)
        .eq("beds", 1)
        .order("month", { ascending: false })
        .limit(1);
      const latest = (deweyRents?.[0] as { median_rent?: number | null } | undefined)?.median_rent;
      if (typeof latest === "number") median1BR = latest;

      return { buildingsTracked, avgLucidIQ, median1BR };
    }, { buildingsTracked: 0, avgLucidIQ: null, median1BR: null } as BuildingV2Data["neighborhoodStats"]),

    // ─── LA: Tenant buyouts ─────────────────────────────────────
    isLA ? safe(async () => {
      const { data } = await supabase
        .from("lahd_tenant_buyouts")
        .select("id, disclosure_date, compensation_amount")
        .eq("building_id", buildingId)
        .order("disclosure_date", { ascending: false })
        .limit(10);
      return (data ?? []) as LaBuyout[];
    }, [] as LaBuyout[]) : Promise.resolve([] as LaBuyout[]),

    // ─── LA: SCEP inspections ───────────────────────────────────
    isLA ? safe(async () => {
      const { data } = await supabase
        .from("lahd_scep_inspections")
        .select("id, inspection_date, compliance_status, violations_found")
        .eq("building_id", buildingId)
        .order("inspection_date", { ascending: false })
        .limit(10);
      return (data ?? []) as LaScep[];
    }, [] as LaScep[]) : Promise.resolve([] as LaScep[]),

    // ─── LA: Earthquake retrofit ────────────────────────────────
    isLA ? safe(async () => {
      const { data } = await supabase
        .from("la_earthquake_retrofit")
        .select("retrofit_type, compliance_status, deadline, completion_date")
        .eq("building_id", buildingId)
        .limit(1);
      return (data ?? []) as LaRetrofit[];
    }, [] as LaRetrofit[]) : Promise.resolve([] as LaRetrofit[]),

    // ─── Chicago: RLTO violations ───────────────────────────────
    isChicago ? safe(async () => {
      const { data } = await supabase
        .from("chicago_rlto_violations")
        .select("id, case_number, violation_date, violation_description, status")
        .eq("building_id", buildingId)
        .order("violation_date", { ascending: false })
        .limit(10);
      return (data ?? []) as ChicagoRlto[];
    }, [] as ChicagoRlto[]) : Promise.resolve([] as ChicagoRlto[]),

    // ─── Chicago: Demolitions ───────────────────────────────────
    isChicago ? safe(async () => {
      const { data } = await supabase
        .from("chicago_demolitions")
        .select("id, permit_number, issue_date, status, work_description")
        .eq("building_id", buildingId)
        .order("issue_date", { ascending: false })
        .limit(10);
      return (data ?? []) as ChicagoDemo[];
    }, [] as ChicagoDemo[]) : Promise.resolve([] as ChicagoDemo[]),

    // ─── Chicago: Lead inspections ──────────────────────────────
    isChicago ? safe(async () => {
      const { data } = await supabase
        .from("chicago_lead_inspections")
        .select("id, inspection_date, result, risk_level")
        .eq("building_id", buildingId)
        .order("inspection_date", { ascending: false })
        .limit(10);
      return (data ?? []) as ChicagoLead[];
    }, [] as ChicagoLead[]) : Promise.resolve([] as ChicagoLead[]),

    // ─── Chicago: Affordable units ──────────────────────────────
    isChicago ? safe(async () => {
      const { data } = await supabase
        .from("chicago_affordable_units")
        .select("id, project_name, affordable_units, total_units")
        .eq("building_id", buildingId)
        .limit(10);
      return (data ?? []) as ChicagoAffordable[];
    }, [] as ChicagoAffordable[]) : Promise.resolve([] as ChicagoAffordable[]),

    // ─── Chicago: Energy rating (latest year) ───────────────────
    isChicago ? safe(async () => {
      const { data } = await supabase
        .from("energy_benchmarks")
        .select("energy_star_score, report_year, site_eui")
        .eq("building_id", buildingId)
        .order("report_year", { ascending: false })
        .limit(1);
      return (data ?? []) as ChicagoEnergy[];
    }, [] as ChicagoEnergy[]) : Promise.resolve([] as ChicagoEnergy[]),

    // ─── Miami: 40-year recertifications ────────────────────────
    isMiami ? safe(async () => {
      const { data } = await supabase
        .from("miami_forty_year_recerts")
        .select("id, recertification_status, due_date, completion_date")
        .eq("building_id", buildingId)
        .order("due_date", { ascending: false })
        .limit(10);
      return (data ?? []) as MiamiRecert[];
    }, [] as MiamiRecert[]) : Promise.resolve([] as MiamiRecert[]),

    // ─── Miami: Unsafe structures ───────────────────────────────
    isMiami ? safe(async () => {
      const { data } = await supabase
        .from("miami_unsafe_structures")
        .select("id, case_number, violation_type, case_date, status")
        .eq("building_id", buildingId)
        .order("case_date", { ascending: false })
        .limit(10);
      return (data ?? []) as MiamiUnsafe[];
    }, [] as MiamiUnsafe[]) : Promise.resolve([] as MiamiUnsafe[]),

    // ─── Miami: Storm damage ────────────────────────────────────
    isMiami ? safe(async () => {
      const { data } = await supabase
        .from("miami_storm_damage")
        .select("id, disaster_name, disaster_date, damage_category, fema_verified_loss")
        .eq("building_id", buildingId)
        .order("disaster_date", { ascending: false })
        .limit(10);
      return (data ?? []) as MiamiStorm[];
    }, [] as MiamiStorm[]) : Promise.resolve([] as MiamiStorm[]),

    // ─── Miami: Flood claims ────────────────────────────────────
    isMiami ? safe(async () => {
      const { data } = await supabase
        .from("miami_flood_claims")
        .select("id, claim_date, flood_zone, amount_paid")
        .eq("building_id", buildingId)
        .order("claim_date", { ascending: false })
        .limit(10);
      return (data ?? []) as MiamiFlood[];
    }, [] as MiamiFlood[]) : Promise.resolve([] as MiamiFlood[]),

    // ─── Houston: Dangerous buildings ───────────────────────────
    isHouston ? safe(async () => {
      const { data } = await supabase
        .from("houston_dangerous_buildings")
        .select("id, case_number, status, case_date, violation_description")
        .eq("building_id", buildingId)
        .order("case_date", { ascending: false })
        .limit(10);
      return (data ?? []) as HoustonDangerous[];
    }, [] as HoustonDangerous[]) : Promise.resolve([] as HoustonDangerous[]),

    // ─── Houston: Industrial proximity ──────────────────────────
    isHouston ? safe(async () => {
      const { data } = await supabase
        .from("houston_industrial_proximity")
        .select("id, facility_name, distance_miles, industry_type, total_releases_lbs")
        .eq("building_id", buildingId)
        .order("distance_miles", { ascending: true })
        .limit(10);
      return (data ?? []) as HoustonIndustrial[];
    }, [] as HoustonIndustrial[]) : Promise.resolve([] as HoustonIndustrial[]),

    // ─── Houston: Tax protests ──────────────────────────────────
    isHouston ? safe(async () => {
      const { data } = await supabase
        .from("houston_tax_protests")
        .select("id, protest_year, original_value, final_value, reduction_pct")
        .eq("building_id", buildingId)
        .order("protest_year", { ascending: false })
        .limit(10);
      return (data ?? []) as HoustonTax[];
    }, [] as HoustonTax[]) : Promise.resolve([] as HoustonTax[]),

    // ─── Houston: Affordable housing ────────────────────────────
    isHouston ? safe(async () => {
      const { data } = await supabase
        .from("houston_affordable_housing")
        .select("id, project_name, affordable_units, total_units")
        .eq("building_id", buildingId)
        .limit(10);
      return (data ?? []) as HoustonAffordable[];
    }, [] as HoustonAffordable[]) : Promise.resolve([] as HoustonAffordable[]),
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
      hpdViolations,
      trends,
    },
    reviews: {
      total: reviewsAggregate.total,
      avgRating: reviewsAggregate.avgRating,
      distribution: reviewsAggregate.distribution,
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
    nearby: {
      transitSubway: nearbyTransit.subway,
      transitBus: nearbyTransit.bus,
      schoolsPublic: nearbySchools.pub,
      schoolsCharter: nearbySchools.charter,
      schoolsPrivate: nearbySchools.priv,
    },
    crime: crimeAgg,
    neighborhoodStats,
    laData: {
      buyouts: laBuyouts,
      scepInspections: laScep,
      earthquakeRetrofit: laRetrofit?.[0] ?? null,
    },
    chicagoData: {
      rltoViolations: chicagoRlto,
      demolitions: chicagoDemolitions,
      leadInspections: chicagoLead,
      affordableUnits: chicagoAffordable,
      energyRating: chicagoEnergy?.[0] ?? null,
    },
    miamiData: {
      recerts: miamiRecerts,
      unsafeStructures: miamiUnsafe,
      stormDamage: miamiStorm,
      floodClaims: miamiFlood,
    },
    houstonData: {
      dangerousBuildings: houstonDangerous,
      industrialProximity: houstonIndustrial,
      taxProtests: houstonTax,
      affordableHousing: houstonAffordable,
    },
  };
}

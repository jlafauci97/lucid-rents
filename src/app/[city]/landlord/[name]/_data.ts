import { cache } from "react";
import type { City } from "@/lib/cities";
import { createClient } from "@/lib/supabase/server";

// ──────────────────────────────────────────────────────────────
// LandlordV2Data — full type shape for landlord page v2
// ──────────────────────────────────────────────────────────────

export type WorstBuildingRow = {
  id: string;
  full_address: string;
  borough: string | null;
  slug: string | null;
  year_built: number | null;
  total_units: number | null;
  overall_score: number | null;
  violation_count: number | null;
  complaint_count: number | null;
  litigation_count: number | null;
};

export type PortfolioBuildingRow = WorstBuildingRow;

export type CaseFilePayload = {
  source: "oath" | "ladbs" | "chi-admin" | "miami-ceb" | "houston-deo";
  summary: {
    buildingCount: number;
    totalCases: number;
    unpaidCases: number;
    unpaidBalance: number;
    defaultRate: number;
    latestDate: string | null;
  };
  recent: Array<{
    id: string;
    date: string | null;
    description: string | null;
    agency: string | null;
    status: string | null;
    result: string | null;
    penaltyImposed: number | null;
    balanceDue: number | null;
    addressLine: string | null;
  }>;
};

export type CityInsightsPayload =
  | {
      kind: "nyc";
      rentStabUnits: number;
      erapRecipient: boolean;
      abatements: Array<{ program: string; buildingCount: number }>;
    }
  | {
      kind: "la";
      buyoutsFiled: number;
      reapEnrolled: number;
      scepCycles: number;
      retrofitStatus: string | null;
    }
  | {
      kind: "chicago";
      scofflaw: boolean;
      scofflawCount: number;
      leadCompliance: string | null;
    }
  | {
      kind: "miami";
      recertsPending: number;
      recertsFailed: number;
      stormDamageClaims: number;
      ccrisFlags: number;
    }
  | {
      kind: "houston";
      dangerousBuildings: number;
      hazardousFlags: number;
      hcddRegistered: boolean;
    };

export type LandlordV2Data = {
  landlord: {
    name: string;
    slug: string;
    metro: City;
    avgScore: number | null;
    buildingCount: number;
    unitCount: number;
    headOfficer: string | null;
    registrationStatus: string | null;
    businessAddress: string | null;
    yearsActive: number | null;
    // Summary numbers the hero needs for the verdict card + summary callout.
    // These are cheap aggregates (already denormalized on landlord_stats or
    // computed by a single reducer over the portfolio) so it's fine to bundle
    // them with the identity payload.
    totalViolations: number;
    totalComplaints: number;
    violations100Plus: number;
    totalReviews: number;
    avgRating: number;
    cityAvgScore: number;
  };
  portfolio: {
    gradeDist: { A: number; B: number; C: number; D: number; F: number };
    regionPreview: Array<{ name: string; count: number }>;
    worstCount100: number;
    cityAvgScore: number;
  };
  trend: {
    monthly: Array<{
      month: string;
      violations: number;
      complaints: number;
      litigations: number;
    }>;
    summary24mo: {
      violationsDelta: number;
      concentrationPct: number;
      escalationsThisYear: number;
    };
  };
  caseFile: CaseFilePayload | null;
  buildings: {
    worstThree: Array<WorstBuildingRow>;
    rows: Array<PortfolioBuildingRow>;
    total: number;
    filterCounts: {
      regions: Array<{ region: string; count: number }>;
      violations100Plus: number;
      rentStab: number;
    };
  };
  ownership: {
    headOfficer: string | null;
    title: string | null;
    businessAddress: string | null;
    registration: { authority: string; status: string; expiresAt: string | null } | null;
    taxIdMasked: string | null;
    managementCompany: string | null;
    yearsActive: number | null;
  };
  tenantVoice: {
    avgRating: number;
    totalReviews: number;
    distribution: [number, number, number, number, number];
    excerpts: Array<{
      rating: number;
      text: string;
      building_address: string;
      region: string;
      created_at: string;
    }>;
  };
  where: {
    regions: Array<{
      name: string;
      count: number;
      share: number;
      topConcern: string | null;
      lat?: number;
      lng?: number;
    }>;
  };
  peers: Array<{
    name: string;
    slug: string;
    buildingCount: number;
    unitCount: number;
    avgScore: number | null;
    metro: City;
  }>;
  cityInsights: CityInsightsPayload | null;
};

// ──────────────────────────────────────────────────────────────
// LandlordRecordAggregate — superset object for all city record types
// Used by Task 1.3 to build the record-strip aggregate
// ──────────────────────────────────────────────────────────────

export type LandlordRecordAggregate = {
  hpdViolations: number;
  comp311: number;
  litigations: number;
  oathBalance: number;
  rentStabUnits: number;
  evictions: number;
  ladbsViolations: number;
  scepCycles: number;
  scofflaw: boolean;
  recerts: number;
  deoOrders: number;
  codeBalance: number;
};

// ──────────────────────────────────────────────────────────────
// Shared helpers — cached so every section loader reuses the same query results
// ──────────────────────────────────────────────────────────────

/**
 * Resolve the canonical owner_name for a slug in a given metro.
 * Cached for the request lifetime so all loaders share one query.
 */
export const resolveOwnerName = cache(
  async (slug: string, city: City): Promise<string | null> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("landlord_stats")
      .select("name")
      .eq("slug", slug)
      .eq("metro", city)
      .limit(1)
      .maybeSingle();
    return data?.name ?? null;
  }
);

// ──────────────────────────────────────────────────────────────
// Individual loaders — one per section, all wrapped in cache()
// ──────────────────────────────────────────────────────────────

export const loadLandlordHero = cache(
  async (slug: string, city: City): Promise<LandlordV2Data["landlord"]> => {
    const supabase = await createClient();

    const [statsResult, ownerName] = await Promise.all([
      supabase
        .from("landlord_stats")
        .select("name, slug, building_count, total_violations, total_dob_violations, total_complaints, avg_score")
        .eq("slug", slug)
        .eq("metro", city)
        .limit(1)
        .maybeSingle(),
      resolveOwnerName(slug, city),
    ]);

    const stats = statsResult.data;
    if (!stats || !ownerName) {
      // The page redirects to /landlords before ever rendering when this
      // happens, but return a safe default so the loader stays well-typed.
      return {
        name: "",
        slug,
        metro: city,
        avgScore: null,
        buildingCount: 0,
        unitCount: 0,
        headOfficer: null,
        registrationStatus: null,
        businessAddress: null,
        yearsActive: null,
        totalViolations: 0,
        totalComplaints: 0,
        violations100Plus: 0,
        totalReviews: 0,
        avgRating: 0,
        cityAvgScore: 0,
      };
    }

    // Step 2 — fan out the aggregation queries in parallel.
    // Building list returns id + total_units + violation_count for unit sum
    // and 100+ violation count in one query.
    const [buildingsResult, cityAvgResult] = await Promise.all([
      supabase
        .from("buildings")
        .select("id, total_units, violation_count, dob_violation_count")
        .eq("owner_name", ownerName)
        .eq("metro", city),
      supabase.rpc("city_avg_score", { p_metro: city }),
    ]);

    const buildings = (buildingsResult.data ?? []) as Array<{
      id: string;
      total_units: number | null;
      violation_count: number | null;
      dob_violation_count: number | null;
    }>;

    // NYC + LA surface HPD violations; other metros use DOB violations as
    // the primary "violation" number (mirrors getLandlordStats' dispatch).
    const isAltMetro = city === "chicago" || city === "miami" || city === "houston";
    const unitCount = buildings.reduce((sum, b) => sum + (b.total_units ?? 0), 0);
    const violations100Plus = buildings.filter((b) => {
      const n = isAltMetro ? (b.dob_violation_count ?? 0) : (b.violation_count ?? 0);
      return n >= 100;
    }).length;

    // Reviews aggregation: batch by building id.
    const buildingIds = buildings.map((b) => b.id);
    let totalReviews = 0;
    let avgRating = 0;
    if (buildingIds.length > 0) {
      const { data: reviewsData } = await supabase
        .from("reviews")
        .select("overall_rating")
        .in("building_id", buildingIds)
        .eq("status", "published");
      const ratings = (reviewsData ?? [])
        .map((r) => (r as { overall_rating: number | null }).overall_rating)
        .filter((n): n is number => typeof n === "number");
      totalReviews = ratings.length;
      avgRating = totalReviews > 0
        ? ratings.reduce((a, b) => a + b, 0) / totalReviews
        : 0;
    }

    const totalViolations = (isAltMetro
      ? stats.total_dob_violations
      : stats.total_violations) ?? 0;

    return {
      name: stats.name,
      slug,
      metro: city,
      avgScore: stats.avg_score,
      buildingCount: stats.building_count ?? buildings.length,
      unitCount,
      headOfficer: null,        // filled in by S05 Ownership loader
      registrationStatus: null, // filled in by S05 Ownership loader
      businessAddress: null,    // filled in by S05 Ownership loader
      yearsActive: null,        // Phase 2
      totalViolations,
      totalComplaints: stats.total_complaints ?? 0,
      violations100Plus,
      totalReviews,
      avgRating,
      cityAvgScore: typeof cityAvgResult.data === "number" ? cityAvgResult.data : 0,
    };
  }
);

export const loadLandlordRecord = cache(
  async (slug: string, city: City): Promise<LandlordRecordAggregate> => {
    const ownerName = await resolveOwnerName(slug, city);
    const empty: LandlordRecordAggregate = {
      hpdViolations: 0,
      comp311: 0,
      litigations: 0,
      oathBalance: 0,
      rentStabUnits: 0,
      evictions: 0,
      ladbsViolations: 0,
      scepCycles: 0,
      scofflaw: false,
      recerts: 0,
      deoOrders: 0,
      codeBalance: 0,
    };
    if (!ownerName) return empty;

    const supabase = await createClient();

    // Single aggregate pull — every per-city record slot is derivable from
    // these building-level counts plus (for NYC) the OATH summary RPC.
    const [bldgResult, oathResult] = await Promise.all([
      supabase
        .from("buildings")
        .select(
          "violation_count, dob_violation_count, complaint_count, litigation_count, eviction_count, is_rent_stabilized, stabilized_units, is_rso, total_units, is_scofflaw, rlto_violation_count, forty_year_recert_status, unsafe_structure_count"
        )
        .eq("owner_name", ownerName)
        .eq("metro", city),
      city === "nyc"
        ? supabase
            .rpc("get_landlord_oath_summary", { landlord_owner_name: ownerName })
            .maybeSingle()
        : Promise.resolve({ data: null, error: null } as const),
    ]);

    const rows = (bldgResult.data ?? []) as Array<{
      violation_count: number | null;
      dob_violation_count: number | null;
      complaint_count: number | null;
      litigation_count: number | null;
      eviction_count: number | null;
      is_rent_stabilized: boolean | null;
      stabilized_units: number | null;
      is_rso: boolean | null;
      total_units: number | null;
      is_scofflaw: boolean | null;
      rlto_violation_count: number | null;
      forty_year_recert_status: string | null;
      unsafe_structure_count: number | null;
    }>;

    const sum = (k: keyof (typeof rows)[number]) =>
      rows.reduce((acc, r) => {
        const v = r[k];
        return acc + (typeof v === "number" ? v : 0);
      }, 0);

    const oathSummary = (oathResult.data as { total_unpaid_balance?: number } | null) ?? null;

    const rentStabUnits = city === "nyc"
      ? rows.reduce((acc, r) => acc + (r.is_rent_stabilized && r.stabilized_units ? r.stabilized_units : 0), 0)
      : city === "los-angeles"
        ? rows.reduce((acc, r) => acc + (r.is_rso && r.total_units ? r.total_units : 0), 0)
        : 0;

    return {
      hpdViolations: sum("violation_count"),
      comp311: sum("complaint_count"),
      litigations: sum("litigation_count"),
      oathBalance: typeof oathSummary?.total_unpaid_balance === "number" ? oathSummary.total_unpaid_balance : 0,
      rentStabUnits,
      evictions: sum("eviction_count"),
      ladbsViolations: sum("violation_count"), // same source for now; LA-specific table lands later
      scepCycles: 0, // Phase 2 — needs la_scep table join
      scofflaw: rows.some((r) => r.is_scofflaw === true),
      recerts: rows.filter((r) => (r.forty_year_recert_status ?? "").toLowerCase() === "pending").length,
      deoOrders: sum("unsafe_structure_count"),
      codeBalance: 0, // Phase 2 — per-city balance sources
    };
  }
);

export const loadLandlordGlance = cache(
  async (slug: string, city: City): Promise<LandlordV2Data["portfolio"]> => {
    return {
      gradeDist: { A: 0, B: 0, C: 0, D: 0, F: 0 },
      regionPreview: [],
      worstCount100: 0,
      cityAvgScore: 0,
    };
  }
);

export const loadLandlordTrend = cache(
  async (slug: string, city: City): Promise<LandlordV2Data["trend"]> => {
    return {
      monthly: [],
      summary24mo: {
        violationsDelta: 0,
        concentrationPct: 0,
        escalationsThisYear: 0,
      },
    };
  }
);

export const loadLandlordCaseFile = cache(
  async (slug: string, city: City): Promise<LandlordV2Data["caseFile"]> => {
    return null;
  }
);

export const loadLandlordBuildings = cache(
  async (slug: string, city: City): Promise<LandlordV2Data["buildings"]> => {
    return {
      worstThree: [],
      rows: [],
      total: 0,
      filterCounts: {
        regions: [],
        violations100Plus: 0,
        rentStab: 0,
      },
    };
  }
);

export const loadLandlordOwnership = cache(
  async (slug: string, city: City): Promise<LandlordV2Data["ownership"]> => {
    return {
      headOfficer: null,
      title: null,
      businessAddress: null,
      registration: null,
      taxIdMasked: null,
      managementCompany: null,
      yearsActive: null,
    };
  }
);

export const loadLandlordTenantVoice = cache(
  async (slug: string, city: City): Promise<LandlordV2Data["tenantVoice"]> => {
    return {
      avgRating: 0,
      totalReviews: 0,
      distribution: [0, 0, 0, 0, 0],
      excerpts: [],
    };
  }
);

export const loadLandlordWhere = cache(
  async (slug: string, city: City): Promise<LandlordV2Data["where"]> => {
    return {
      regions: [],
    };
  }
);

export const loadLandlordPeers = cache(
  async (slug: string, city: City): Promise<LandlordV2Data["peers"]> => {
    return [];
  }
);

export const loadLandlordCityInsights = cache(
  async (slug: string, city: City): Promise<LandlordV2Data["cityInsights"]> => {
    return null;
  }
);

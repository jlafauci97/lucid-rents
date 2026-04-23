import { cache } from "react";
import type { City } from "@/lib/cities";
import { createClient } from "@/lib/supabase/server";
import { computeGradeDistribution, aggregateRegions } from "@/lib/landlord-v2-helpers";

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

/**
 * Fetch every building in the landlord's portfolio with the columns any
 * section might need. Cached once per (slug, city) so S01/S02/S04/S07 all
 * share one row set instead of issuing four overlapping queries.
 */
export type LandlordBuildingRow = {
  id: string;
  full_address: string;
  borough: string | null;
  zip_code: string | null;
  slug: string | null;
  year_built: number | null;
  total_units: number | null;
  overall_score: number | null;
  violation_count: number | null;
  dob_violation_count: number | null;
  complaint_count: number | null;
  litigation_count: number | null;
  eviction_count: number | null;
  is_rent_stabilized: boolean | null;
  stabilized_units: number | null;
  is_rso: boolean | null;
  is_scofflaw: boolean | null;
  latitude: number | null;
  longitude: number | null;
};

const BUILDING_LIST_COLUMNS =
  "id, full_address, borough, zip_code, slug, year_built, total_units, overall_score, violation_count, dob_violation_count, complaint_count, litigation_count, eviction_count, is_rent_stabilized, stabilized_units, is_rso, is_scofflaw, latitude, longitude";

export const loadLandlordBuildingList = cache(
  async (slug: string, city: City): Promise<LandlordBuildingRow[]> => {
    const ownerName = await resolveOwnerName(slug, city);
    if (!ownerName) return [];
    const supabase = await createClient();
    const { data } = await supabase
      .from("buildings")
      .select(BUILDING_LIST_COLUMNS)
      .eq("owner_name", ownerName)
      .eq("metro", city);
    return (data ?? []) as LandlordBuildingRow[];
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
    const supabase = await createClient();
    const [buildings, cityAvgResult] = await Promise.all([
      loadLandlordBuildingList(slug, city),
      supabase.rpc("city_avg_score", { p_metro: city }),
    ]);

    const isAltMetro = city === "chicago" || city === "miami" || city === "houston";
    const worstCount100 = buildings.filter((b) => {
      const n = isAltMetro ? (b.dob_violation_count ?? 0) : (b.violation_count ?? 0);
      return n >= 100;
    }).length;

    const regionAgg = aggregateRegions(
      buildings.map((b) => ({ zip_code: b.zip_code, borough: b.borough })),
      city
    );

    return {
      gradeDist: computeGradeDistribution(buildings),
      regionPreview: regionAgg.slice(0, 4).map((r) => ({ name: r.name, count: r.count })),
      worstCount100,
      cityAvgScore: typeof cityAvgResult.data === "number" ? cityAvgResult.data : 0,
    };
  }
);

export const loadLandlordTrend = cache(
  async (slug: string, city: City): Promise<LandlordV2Data["trend"]> => {
    const buildings = await loadLandlordBuildingList(slug, city);
    if (buildings.length === 0) {
      return { monthly: [], summary24mo: { violationsDelta: 0, concentrationPct: 0, escalationsThisYear: 0 } };
    }

    // Concentration: fraction of total complaints that come from the top 10%
    // of buildings (or at minimum 5 buildings, whichever is greater). Gives a
    // portfolio-level read on whether issues are spread evenly or clustered.
    const complaints = buildings
      .map((b) => b.complaint_count ?? 0)
      .sort((a, b) => b - a);
    const total = complaints.reduce((a, b) => a + b, 0);
    const topN = Math.max(5, Math.ceil(buildings.length * 0.1));
    const topSum = complaints.slice(0, topN).reduce((a, b) => a + b, 0);
    const concentrationPct = total > 0 ? Math.round((topSum / total) * 100) : 0;

    // Escalations = count of buildings with any litigation on file.
    const escalationsThisYear = buildings.filter((b) => (b.litigation_count ?? 0) > 0).length;

    // Phase 1 leaves the 24-month violations delta at 0 — computing this well
    // requires a time-series query against hpd_violations / dob_violations
    // across the whole portfolio. S02 renders without the delta when it's 0.
    return {
      monthly: [],
      summary24mo: { violationsDelta: 0, concentrationPct, escalationsThisYear },
    };
  }
);

export const loadLandlordCaseFile = cache(
  async (slug: string, city: City): Promise<LandlordV2Data["caseFile"]> => {
    // Phase 1 ships NYC OATH only. LA/CHI/MIA/HOU return null and the
    // section stays hidden until the per-city enforcement source lands.
    if (city !== "nyc") return null;
    const ownerName = await resolveOwnerName(slug, city);
    if (!ownerName) return null;

    const supabase = await createClient();
    const [summaryResult, recentResult] = await Promise.all([
      supabase.rpc("get_landlord_oath_summary", { landlord_owner_name: ownerName }).maybeSingle(),
      supabase.rpc("get_landlord_oath_recent", { landlord_owner_name: ownerName, row_limit: 12 }),
    ]);

    const summary = summaryResult.data as {
      building_count: number;
      total_hearings: number;
      unpaid_hearings: number;
      total_unpaid_balance: number;
      total_penalty_imposed: number;
      total_paid: number;
      default_judgments: number;
      latest_violation_date: string | null;
    } | null;

    if (!summary || summary.total_hearings === 0) return null;

    type RawCase = {
      ticket_number: string;
      bbl: string;
      violation_date: string | null;
      issuing_agency: string | null;
      violation_description: string | null;
      hearing_status: string | null;
      hearing_result: string | null;
      penalty_imposed: number | null;
      balance_due: number | null;
      house_number: string | null;
      street_name: string | null;
      borough: string | null;
    };
    const rawRecent = (recentResult.data as RawCase[] | null) ?? [];
    const defaultRate = summary.total_hearings > 0
      ? Math.round((summary.default_judgments / summary.total_hearings) * 100)
      : 0;

    return {
      source: "oath",
      summary: {
        buildingCount: summary.building_count,
        totalCases: summary.total_hearings,
        unpaidCases: summary.unpaid_hearings,
        unpaidBalance: summary.total_unpaid_balance,
        defaultRate,
        latestDate: summary.latest_violation_date,
      },
      recent: rawRecent.map((c) => ({
        id: c.ticket_number,
        date: c.violation_date,
        description: c.violation_description,
        agency: c.issuing_agency,
        status: c.hearing_status,
        result: c.hearing_result,
        penaltyImposed: c.penalty_imposed,
        balanceDue: c.balance_due,
        addressLine: [c.house_number, c.street_name].filter(Boolean).join(" ") || null,
      })),
    };
  }
);

export const loadLandlordBuildings = cache(
  async (slug: string, city: City): Promise<LandlordV2Data["buildings"]> => {
    const buildings = await loadLandlordBuildingList(slug, city);
    if (buildings.length === 0) {
      return {
        worstThree: [],
        rows: [],
        total: 0,
        filterCounts: { regions: [], violations100Plus: 0, rentStab: 0 },
      };
    }

    // Sort ascending by score (NULL LAST) — worst first matches the building
    // v2 sort direction and the mockup's worst-3 callout.
    const scoreOf = (b: LandlordBuildingRow) => (b.overall_score == null ? Infinity : b.overall_score);
    const sorted = [...buildings].sort((a, b) => scoreOf(a) - scoreOf(b));

    const isAltMetro = city === "chicago" || city === "miami" || city === "houston";
    const violations100Plus = buildings.filter((b) => {
      const n = isAltMetro ? (b.dob_violation_count ?? 0) : (b.violation_count ?? 0);
      return n >= 100;
    }).length;
    const rentStab = buildings.filter((b) => b.is_rent_stabilized === true).length;

    const regionCounts = new Map<string, number>();
    for (const b of buildings) {
      const region = b.borough ?? "—";
      regionCounts.set(region, (regionCounts.get(region) ?? 0) + 1);
    }
    const regions = Array.from(regionCounts.entries())
      .map(([region, count]) => ({ region, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    const toRow = (b: LandlordBuildingRow): WorstBuildingRow => ({
      id: b.id,
      full_address: b.full_address,
      borough: b.borough,
      slug: b.slug,
      year_built: b.year_built,
      total_units: b.total_units,
      overall_score: b.overall_score,
      violation_count: isAltMetro ? (b.dob_violation_count ?? 0) : (b.violation_count ?? 0),
      complaint_count: b.complaint_count,
      litigation_count: b.litigation_count,
    });

    return {
      worstThree: sorted.slice(0, 3).map(toRow),
      rows: sorted.slice(0, 30).map(toRow),
      total: buildings.length,
      filterCounts: { regions, violations100Plus, rentStab },
    };
  }
);

export const loadLandlordOwnership = cache(
  async (slug: string, city: City): Promise<LandlordV2Data["ownership"]> => {
    const ownerName = await resolveOwnerName(slug, city);
    if (!ownerName) {
      return {
        headOfficer: null, title: null, businessAddress: null,
        registration: null, taxIdMasked: null, managementCompany: null, yearsActive: null,
      };
    }

    const supabase = await createClient();
    // Mode(management_company) across the portfolio. Using a simple top-1
    // by count query; more precise entity mapping lands with the ACRIS work.
    const { data } = await supabase
      .from("buildings")
      .select("management_company")
      .eq("owner_name", ownerName)
      .eq("metro", city)
      .not("management_company", "is", null)
      .limit(200);

    const counts = new Map<string, number>();
    for (const row of (data ?? []) as Array<{ management_company: string | null }>) {
      const mc = row.management_company;
      if (!mc) continue;
      counts.set(mc, (counts.get(mc) ?? 0) + 1);
    }
    const managementCompany = counts.size > 0
      ? Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0][0]
      : null;

    const authorityByCity: Record<City, string> = {
      nyc: "HPD",
      "los-angeles": "HCIDLA",
      chicago: "City of Chicago",
      miami: "Miami-Dade Code Compliance",
      houston: "City of Houston HCDD",
    };

    const registration = {
      authority: authorityByCity[city],
      status: "Registered",
      expiresAt: null,
    };

    return {
      headOfficer: null,        // awaits HPD registration ingestion
      title: null,
      businessAddress: null,    // awaits HPD registration ingestion
      registration,
      taxIdMasked: null,        // NYC-only; awaits HPD registration ingestion
      managementCompany,
      yearsActive: null,        // awaits ACRIS ingestion
    };
  }
);

export const loadLandlordTenantVoice = cache(
  async (slug: string, city: City): Promise<LandlordV2Data["tenantVoice"]> => {
    const buildings = await loadLandlordBuildingList(slug, city);
    if (buildings.length === 0) {
      return { avgRating: 0, totalReviews: 0, distribution: [0, 0, 0, 0, 0], excerpts: [] };
    }
    const supabase = await createClient();
    const buildingIds = buildings.map((b) => b.id);

    const { data } = await supabase
      .from("reviews")
      .select("overall_rating, body, building_id, created_at")
      .in("building_id", buildingIds)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(500);

    type Row = {
      overall_rating: number | null;
      body: string | null;
      building_id: string;
      created_at: string;
    };
    const rows = ((data ?? []) as Row[]).filter(
      (r) => typeof r.overall_rating === "number" && r.overall_rating > 0
    ) as Array<Row & { overall_rating: number }>;

    if (rows.length === 0) {
      return { avgRating: 0, totalReviews: 0, distribution: [0, 0, 0, 0, 0], excerpts: [] };
    }

    const totalReviews = rows.length;
    const avgRating = rows.reduce((a, r) => a + r.overall_rating, 0) / totalReviews;

    const dist: [number, number, number, number, number] = [0, 0, 0, 0, 0];
    for (const r of rows) {
      const idx = Math.max(1, Math.min(5, Math.round(r.overall_rating))) - 1;
      dist[idx]++;
    }

    // Pick one top-rated with text, one bottom-rated with text, one middle with text
    const byBuildingId = new Map(buildings.map((b) => [b.id, b]));
    const withText = rows.filter((r) => (r.body ?? "").trim().length > 0);
    const top = [...withText].sort((a, b) => b.overall_rating - a.overall_rating || b.created_at.localeCompare(a.created_at))[0];
    const bot = [...withText].sort((a, b) => a.overall_rating - b.overall_rating || b.created_at.localeCompare(a.created_at))[0];
    const middle = withText.find((r) => r.overall_rating >= 2.5 && r.overall_rating <= 3.5);

    const toExcerpt = (r: (typeof withText)[number] | undefined) => {
      if (!r) return null;
      const building = byBuildingId.get(r.building_id);
      return {
        rating: r.overall_rating,
        text: r.body!.length > 240 ? `${r.body!.slice(0, 240).trim()}…` : r.body!,
        building_address: building?.full_address ?? "—",
        region: building?.borough ?? "—",
        created_at: r.created_at,
      };
    };

    const excerptSet = new Set<string>();
    const pushExcerpt = (r: (typeof withText)[number] | undefined, out: ReturnType<typeof toExcerpt>[]) => {
      if (!r || excerptSet.has(r.building_id + "|" + r.created_at)) return;
      const e = toExcerpt(r);
      if (e) {
        excerptSet.add(r.building_id + "|" + r.created_at);
        out.push(e);
      }
    };

    const excerpts: NonNullable<ReturnType<typeof toExcerpt>>[] = [];
    pushExcerpt(top, excerpts);
    pushExcerpt(bot, excerpts);
    pushExcerpt(middle ?? withText[0], excerpts);

    return {
      avgRating,
      totalReviews,
      distribution: dist,
      excerpts: excerpts.slice(0, 3),
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

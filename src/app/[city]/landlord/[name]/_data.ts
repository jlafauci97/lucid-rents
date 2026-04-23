import { cache } from "react";
import type { City } from "@/lib/cities";

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
// Individual loaders — one per section, all wrapped in cache()
// ──────────────────────────────────────────────────────────────

export const loadLandlordHero = cache(
  async (slug: string, city: City): Promise<LandlordV2Data["landlord"]> => {
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
    };
  }
);

export const loadLandlordRecord = cache(
  async (slug: string, city: City): Promise<LandlordRecordAggregate> => {
    return {
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

import type { City } from "@/lib/cities";
import type { LandlordRecordAggregate } from "@/app/[city]/landlord/[name]/_data";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export type CaseFileSource =
  | "oath"
  | "ladbs"
  | "chi-admin"
  | "miami-ceb"
  | "houston-deo"
  | null;

export type RecordStripSlot = {
  k: string;
  v: string | number;
  sub: string;
  tone?: "ok" | "warn";
};

export type TenantResource = {
  label: string;
  href: string;
  description: string;
  icon: "phone" | "shield" | "file-warning" | "arrow-left-right";
  external: boolean;
};

export type FaqItem = {
  q: string;
  aTemplate: string;
};

// ──────────────────────────────────────────────────────────────
// caseFileSourceForCity
// ──────────────────────────────────────────────────────────────

export function caseFileSourceForCity(city: City): CaseFileSource {
  switch (city) {
    case "nyc":
      return "oath";
    case "los-angeles":
      return "ladbs";
    case "chicago":
      return "chi-admin";
    case "miami":
      return "miami-ceb";
    case "houston":
      return "houston-deo";
    default:
      return null;
  }
}

// ──────────────────────────────────────────────────────────────
// recordStripSlots
// ──────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString();
}

function fmtCurrency(n: number): string {
  return "$" + n.toLocaleString();
}

export function recordStripSlots(
  city: City,
  data: LandlordRecordAggregate
): RecordStripSlot[] {
  switch (city) {
    case "nyc":
      return [
        // Slot 1: HPD violations
        {
          k: "HPD violations",
          v: fmt(data.hpdViolations),
          sub: "open + closed 12mo",
          ...(data.hpdViolations > 0 ? { tone: "warn" as const } : {}),
        },
        // Slot 2: 311 complaints
        {
          k: "311 complaints",
          v: fmt(data.comp311),
          sub: "submitted last 12mo",
        },
        // Slot 3: Litigations
        {
          k: "Litigations",
          v: fmt(data.litigations),
          sub: "housing court active",
          ...(data.litigations > 0 ? { tone: "warn" as const } : {}),
        },
        // Slot 4: OATH balance
        {
          k: "OATH balance due",
          v: fmtCurrency(data.oathBalance),
          sub: "penalty + interest · last 5y",
        },
        // Slot 5: Rent-stab units
        {
          k: "Rent-stab units",
          v: fmt(data.rentStabUnits),
          sub: "registered w/ HPD",
          ...(data.rentStabUnits > 0 ? { tone: "ok" as const } : {}),
        },
        // Slot 6: Evictions filed
        {
          k: "Evictions filed",
          v: fmt(data.evictions),
          sub: "L&T filings 12mo",
        },
      ];

    case "los-angeles":
      return [
        // Slot 1: LADBS violations
        {
          k: "LADBS violations",
          v: fmt(data.ladbsViolations),
          sub: "code enforcement 12mo",
          ...(data.ladbsViolations > 0 ? { tone: "warn" as const } : {}),
        },
        // Slot 2: 311 complaints
        {
          k: "311 complaints",
          v: fmt(data.comp311),
          sub: "submitted last 12mo",
        },
        // Slot 3: SCEP cycles
        {
          k: "SCEP cycles",
          v: fmt(data.scepCycles),
          sub: "systematic inspections",
          ...(data.scepCycles > 0 ? { tone: "warn" as const } : {}),
        },
        // Slot 4: LADBS fine balance
        {
          k: "LADBS fine balance",
          v: fmtCurrency(data.codeBalance),
          sub: "penalty + interest",
        },
        // Slot 5: RSO units
        {
          k: "RSO units",
          v: fmt(data.rentStabUnits),
          sub: "registered w/ LAHD",
          ...(data.rentStabUnits > 0 ? { tone: "ok" as const } : {}),
        },
        // Slot 6: Evictions filed
        {
          k: "Evictions filed",
          v: fmt(data.evictions),
          sub: "UD filings 12mo",
        },
      ];

    case "chicago":
      return [
        // Slot 1: Building Code violations (reuses hpdViolations as proxy)
        {
          k: "Building Code violations",
          v: fmt(data.hpdViolations),
          sub: "city code enforcement",
          ...(data.hpdViolations > 0 ? { tone: "warn" as const } : {}),
        },
        // Slot 2: 311 complaints
        {
          k: "311 complaints",
          v: fmt(data.comp311),
          sub: "submitted last 12mo",
        },
        // Slot 3: Scofflaw flag
        {
          k: "Scofflaw flag",
          v: data.scofflaw ? "1" : "0",
          sub: "RLTO non-compliance",
          ...(data.scofflaw ? { tone: "warn" as const } : {}),
        },
        // Slot 4: Admin hearings balance
        {
          k: "Admin hearings balance",
          v: fmtCurrency(data.codeBalance),
          sub: "penalty + interest",
        },
        // Slot 5 (no rent-stab for CHI): Evictions filed
        {
          k: "Evictions filed",
          v: fmt(data.evictions),
          sub: "eviction filings 12mo",
        },
      ];

    case "miami":
      return [
        // Slot 1: Code violations (reuses hpdViolations as proxy)
        {
          k: "Code violations",
          v: fmt(data.hpdViolations),
          sub: "code compliance 12mo",
          ...(data.hpdViolations > 0 ? { tone: "warn" as const } : {}),
        },
        // Slot 2: 311 complaints
        {
          k: "311 complaints",
          v: fmt(data.comp311),
          sub: "submitted last 12mo",
        },
        // Slot 3: Recerts pending
        {
          k: "Recerts pending",
          v: fmt(data.recerts),
          sub: "40-yr recertification",
          ...(data.recerts > 0 ? { tone: "warn" as const } : {}),
        },
        // Slot 4: Code Enforcement balance
        {
          k: "Code Enforcement balance",
          v: fmtCurrency(data.codeBalance),
          sub: "penalty + interest",
        },
        // Slot 5 (no rent-stab for MIA): Evictions filed
        {
          k: "Evictions filed",
          v: fmt(data.evictions),
          sub: "eviction filings 12mo",
        },
      ];

    case "houston":
      return [
        // Slot 1: Dangerous bldg flags
        {
          k: "Dangerous bldg flags",
          v: fmt(data.deoOrders),
          sub: "active DEO orders",
          ...(data.deoOrders > 0 ? { tone: "warn" as const } : {}),
        },
        // Slot 2: 311 complaints
        {
          k: "311 complaints",
          v: fmt(data.comp311),
          sub: "submitted last 12mo",
        },
        // Slot 3: DEO order count
        {
          k: "DEO order count",
          v: fmt(data.deoOrders),
          sub: "enforcement orders",
          ...(data.deoOrders > 0 ? { tone: "warn" as const } : {}),
        },
        // Slot 4: Municipal court balance
        {
          k: "Municipal court balance",
          v: fmtCurrency(data.codeBalance),
          sub: "penalty + interest",
        },
        // Slot 5 (no rent-stab for HOU): Evictions filed
        {
          k: "Evictions filed",
          v: fmt(data.evictions),
          sub: "eviction filings 12mo",
        },
      ];
  }
}

// ──────────────────────────────────────────────────────────────
// tenantResourcesForCity
// ──────────────────────────────────────────────────────────────

export function tenantResourcesForCity(city: City): TenantResource[] {
  switch (city) {
    case "nyc":
      return [
        {
          label: "File a 311 complaint",
          href: "https://portal.311.nyc.gov/article/?kanumber=KA-01253",
          description: "Report housing conditions to NYC 311",
          icon: "phone",
          external: true,
        },
        {
          label: "Know your rights",
          href: "/nyc/tenant-rights",
          description: "NYC tenant rights and protections",
          icon: "shield",
          external: false,
        },
        {
          label: "Report to HPD",
          href: "https://www.nyc.gov/site/hpd/services-and-information/online-complaint-system.page",
          description: "File a complaint with Housing Preservation",
          icon: "file-warning",
          external: true,
        },
        {
          label: "Compare buildings",
          href: "/nyc/compare",
          description: "See how this building stacks up",
          icon: "arrow-left-right",
          external: false,
        },
      ];

    case "los-angeles":
      return [
        {
          label: "File a 311 complaint",
          href: "https://www.lacity.org/myla311",
          description: "Report housing conditions via MyLA311",
          icon: "phone",
          external: true,
        },
        {
          label: "Know your rights",
          href: "/CA/Los-Angeles/tenant-rights",
          description: "LA tenant rights and RSO protections",
          icon: "shield",
          external: false,
        },
        {
          label: "Report to LAHD",
          href: "https://housing.lacity.org/landlords-owners/general-information",
          description: "File a complaint with LA Housing Dept",
          icon: "file-warning",
          external: true,
        },
        {
          label: "Compare buildings",
          href: "/CA/Los-Angeles/compare",
          description: "See how this building stacks up",
          icon: "arrow-left-right",
          external: false,
        },
      ];

    case "chicago":
      return [
        {
          label: "File a 311 complaint",
          href: "https://311.chicago.gov/",
          description: "Report housing conditions via Chicago 311",
          icon: "phone",
          external: true,
        },
        {
          label: "Know your rights",
          href: "/IL/Chicago/tenant-rights",
          description: "Chicago RLTO rights",
          icon: "shield",
          external: false,
        },
        {
          label: "Report to BACP",
          href: "https://www.chicago.gov/city/en/depts/bacp.html",
          description: "Business Affairs and Consumer Protection",
          icon: "file-warning",
          external: true,
        },
        {
          label: "Compare buildings",
          href: "/IL/Chicago/compare",
          description: "See how this building stacks up",
          icon: "arrow-left-right",
          external: false,
        },
      ];

    case "miami":
      return [
        {
          label: "File a 311 complaint",
          href: "https://www.miamidade.gov/global/service.page?Mduid_service=ser1485528169108394",
          description: "Report housing conditions via Miami-Dade 311",
          icon: "phone",
          external: true,
        },
        {
          label: "Know your rights",
          href: "/FL/Miami/tenant-rights",
          description: "Florida tenant rights",
          icon: "shield",
          external: false,
        },
        {
          label: "Report to Code Compliance",
          href: "https://www.miamidade.gov/global/service.page?Mduid_service=ser1485528169095329",
          description: "Miami-Dade Code Compliance",
          icon: "file-warning",
          external: true,
        },
        {
          label: "Compare buildings",
          href: "/FL/Miami/compare",
          description: "See how this building stacks up",
          icon: "arrow-left-right",
          external: false,
        },
      ];

    case "houston":
      return [
        {
          label: "File a 311 complaint",
          href: "https://www.houstontx.gov/311/",
          description: "Report housing conditions via Houston 311",
          icon: "phone",
          external: true,
        },
        {
          label: "Know your rights",
          href: "/TX/Houston/tenant-rights",
          description: "Texas tenant rights",
          icon: "shield",
          external: false,
        },
        {
          label: "Report to HCDD",
          href: "https://houstontx.gov/housing/",
          description: "Houston Community Development Dept",
          icon: "file-warning",
          external: true,
        },
        {
          label: "Compare buildings",
          href: "/TX/Houston/compare",
          description: "See how this building stacks up",
          icon: "arrow-left-right",
          external: false,
        },
      ];
  }
}

// ──────────────────────────────────────────────────────────────
// faqBankForCity
// ──────────────────────────────────────────────────────────────

const FAQ_Q1: FaqItem = {
  q: "Is {landlord} the biggest landlord in {city}?",
  aTemplate:
    "They rank {{portfolioRank}} by building count among tracked landlords in {{city}}.",
};

const FAQ_Q3: FaqItem = {
  q: "Have they been sued recently?",
  aTemplate:
    "{{activeLitigations}} active housing-court litigations are on file across their buildings.",
};

const FAQ_Q4: FaqItem = {
  q: "Which buildings should I avoid?",
  aTemplate:
    "The worst-rated buildings are {{worstBuilding1}}, {{worstBuilding2}}, and {{worstBuilding3}}.",
};

const FAQ_Q5: FaqItem = {
  q: "Are complaints getting worse?",
  aTemplate:
    "Violations are {{trendDirection24mo}} {{trendDeltaPct}}% over the last 24 months.",
};

const FAQ_Q6: FaqItem = {
  q: "Who operates this portfolio?",
  aTemplate:
    "{{headOfficer}} runs the portfolio since {{founderYear}}, registered with the local housing authority.",
};

export function faqBankForCity(city: City): FaqItem[] {
  switch (city) {
    case "nyc":
      return [
        FAQ_Q1,
        {
          q: "What share is rent-stabilized?",
          aTemplate:
            "{{rentStabShare}}% of their units are registered as rent-stabilized with the housing authority.",
        },
        FAQ_Q3,
        FAQ_Q4,
        FAQ_Q5,
        FAQ_Q6,
      ];

    case "los-angeles":
      return [
        FAQ_Q1,
        {
          q: "What share is rent-stabilized?",
          aTemplate:
            "{{rentStabShare}}% of their units are registered as rent-stabilized with the housing authority.",
        },
        FAQ_Q3,
        FAQ_Q4,
        FAQ_Q5,
        FAQ_Q6,
      ];

    case "chicago":
      return [
        FAQ_Q1,
        {
          q: "Are they RLTO-compliant?",
          aTemplate:
            "{{rltoStatus}} — Chicago's Residential Landlord and Tenant Ordinance applies.",
        },
        FAQ_Q3,
        FAQ_Q4,
        FAQ_Q5,
        FAQ_Q6,
      ];

    case "miami":
      return [
        FAQ_Q1,
        {
          q: "How many buildings need 40-year recertification?",
          aTemplate:
            "{{recertsPending}} buildings currently have pending 40-year recerts.",
        },
        FAQ_Q3,
        FAQ_Q4,
        FAQ_Q5,
        FAQ_Q6,
      ];

    case "houston":
      return [
        FAQ_Q1,
        {
          q: "Are any buildings flagged dangerous?",
          aTemplate:
            "{{dangerousCount}} buildings carry an active dangerous-building flag.",
        },
        FAQ_Q3,
        FAQ_Q4,
        FAQ_Q5,
        FAQ_Q6,
      ];
  }
}

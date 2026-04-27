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
          // Root of the NYC 311 portal — a stable entry point where users
          // pick a housing topic. The previous `?kanumber=KA-01253` URL
          // actually pointed to property-tax info, not housing complaints.
          href: "https://portal.311.nyc.gov/",
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
          // HPD's canonical "how to file a complaint" landing page.
          // Verified 200 with title "Complaints and Inspections - HPD".
          // Previous URLs (online-complaint-system.page, /s/ask?topic=Housing)
          // both 404 as of this deploy.
          href: "https://www.nyc.gov/site/hpd/renters/complaints-and-inspections.page",
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

// SEO-optimized FAQ bank. Questions intentionally include the landlord name
// and city so they show up in long-tail searches like
// "is [landlord] a good landlord", "how many buildings does [landlord] own".

const FAQ_PORTFOLIO_SIZE: FaqItem = {
  q: "How many buildings does {{landlord}} own in {{city}}?",
  aTemplate:
    "{{landlord}} owns or operates {{buildingCount}} buildings in {{city}}, totaling {{unitCount}} units.",
};

const FAQ_IS_GOOD: FaqItem = {
  q: "Is {{landlord}} a good landlord?",
  aTemplate:
    "Across the {{buildingCount}}-building portfolio, the average compliance score is {{avgScore}} out of 5. {{violationsTotal}} violations and {{complaintsTotal}} tenant complaints are on file — review The Record above for the full breakdown.",
};

const FAQ_VIOLATIONS: FaqItem = {
  q: "How many violations does {{landlord}} have?",
  aTemplate:
    "{{violationsTotal}} HPD/code violations and {{dobViolations}} DOB violations are recorded across {{landlord}}'s buildings in {{city}}.",
};

const FAQ_LITIGATIONS: FaqItem = {
  q: "Has {{landlord}} been sued by tenants?",
  aTemplate:
    "{{activeLitigations}} active housing-court cases are on file across {{landlord}}'s buildings.",
};

const FAQ_AVOID: FaqItem = {
  q: "What buildings should I avoid renting from {{landlord}}?",
  aTemplate:
    "The lowest-rated buildings in {{landlord}}'s portfolio are {{worstBuilding1}}, {{worstBuilding2}}, and {{worstBuilding3}}.",
};

const FAQ_COMPLAIN: FaqItem = {
  q: "How do I file a complaint against {{landlord}}?",
  aTemplate:
    "{{complaintAction}} Document repair requests in writing and keep dated copies for housing court.",
};

const FAQ_NYC_STAB: FaqItem = {
  q: "Are {{landlord}}'s units rent-stabilized?",
  aTemplate:
    "{{rentStabShare}}% of {{landlord}}'s units in {{city}} are registered as rent-stabilized with HPD.",
};

const FAQ_CHI_RLTO: FaqItem = {
  q: "Is {{landlord}} on Chicago's scofflaw list?",
  aTemplate:
    "{{rltoStatus}}. Chicago's Residential Landlord and Tenant Ordinance (RLTO) applies to all units.",
};

const FAQ_MIA_RECERT: FaqItem = {
  q: "How many of {{landlord}}'s buildings need 40-year recertification?",
  aTemplate:
    "{{recertsPending}} buildings in {{landlord}}'s portfolio have pending 40-year recerts in Miami-Dade.",
};

const FAQ_HOU_DANGER: FaqItem = {
  q: "Are any of {{landlord}}'s buildings flagged dangerous in Houston?",
  aTemplate:
    "{{dangerousCount}} buildings in {{landlord}}'s portfolio carry an active dangerous-building flag.",
};

export function faqBankForCity(city: City): FaqItem[] {
  switch (city) {
    case "nyc":
      return [
        FAQ_PORTFOLIO_SIZE,
        FAQ_IS_GOOD,
        FAQ_VIOLATIONS,
        FAQ_LITIGATIONS,
        FAQ_AVOID,
        FAQ_NYC_STAB,
        FAQ_COMPLAIN,
      ];

    case "los-angeles":
      return [
        FAQ_PORTFOLIO_SIZE,
        FAQ_IS_GOOD,
        FAQ_VIOLATIONS,
        FAQ_LITIGATIONS,
        FAQ_AVOID,
        FAQ_NYC_STAB,
        FAQ_COMPLAIN,
      ];

    case "chicago":
      return [
        FAQ_PORTFOLIO_SIZE,
        FAQ_IS_GOOD,
        FAQ_CHI_RLTO,
        FAQ_VIOLATIONS,
        FAQ_LITIGATIONS,
        FAQ_AVOID,
        FAQ_COMPLAIN,
      ];

    case "miami":
      return [
        FAQ_PORTFOLIO_SIZE,
        FAQ_IS_GOOD,
        FAQ_MIA_RECERT,
        FAQ_VIOLATIONS,
        FAQ_LITIGATIONS,
        FAQ_AVOID,
        FAQ_COMPLAIN,
      ];

    case "houston":
      return [
        FAQ_PORTFOLIO_SIZE,
        FAQ_IS_GOOD,
        FAQ_HOU_DANGER,
        FAQ_VIOLATIONS,
        FAQ_LITIGATIONS,
        FAQ_AVOID,
        FAQ_COMPLAIN,
      ];
  }
}

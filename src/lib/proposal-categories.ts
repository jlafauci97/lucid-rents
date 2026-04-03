export type ProposalCategory =
  | "rent_regulation"
  | "zoning_change"
  | "tenant_protection"
  | "new_development"
  | "demolition"
  | "affordable_housing"
  | "building_safety"
  | "other";

const CATEGORY_RULES: { keywords: string[]; category: ProposalCategory }[] = [
  { keywords: ["rent", "stabiliz", "rso", "lease", "tenant protection"], category: "rent_regulation" },
  { keywords: ["zone", "rezone", "variance", "special permit", "ulurp"], category: "zoning_change" },
  { keywords: ["tenant", "evict", "harass", "displacement"], category: "tenant_protection" },
  { keywords: ["develop", "construct", "build", "new building"], category: "new_development" },
  { keywords: ["demolish", "demolition", "tear down"], category: "demolition" },
  { keywords: ["afford", "inclusionary", "mih", "section 8"], category: "affordable_housing" },
  { keywords: ["safety", "fire", "seismic", "structural", "elevator"], category: "building_safety" },
];

export function categorizeProposal(title: string): ProposalCategory {
  const lower = title.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      return rule.category;
    }
  }
  return "other";
}

export const CATEGORY_LABELS: Record<ProposalCategory, string> = {
  rent_regulation: "Rent Regulation",
  zoning_change: "Zoning Change",
  tenant_protection: "Tenant Protection",
  new_development: "New Development",
  demolition: "Demolition",
  affordable_housing: "Affordable Housing",
  building_safety: "Building Safety",
  other: "Other",
};

export const CATEGORY_COLORS: Record<ProposalCategory, string> = {
  rent_regulation: "#dc2626",
  zoning_change: "#7c3aed",
  tenant_protection: "#2563eb",
  new_development: "#059669",
  demolition: "#d97706",
  affordable_housing: "#0891b2",
  building_safety: "#e11d48",
  other: "#64748b",
};

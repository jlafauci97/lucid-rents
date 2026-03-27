export const REVIEW_CATEGORIES = [
  {
    slug: "noise",
    name: "Noise",
    icon: "volume-2",
    description: "Sound levels and noise-related issues",
    subcategories: [
      { slug: "thin_walls", name: "Thin walls" },
      { slug: "hear_neighbors", name: "Hear neighbors" },
      { slug: "loud_street", name: "Loud street" },
      { slug: "construction_noise", name: "Construction noise" },
      { slug: "hallway_noise", name: "Hallway noise" },
      { slug: "upstairs_stomping", name: "Upstairs stomping" },
    ],
  },
  {
    slug: "physical_condition",
    name: "Physical Condition",
    icon: "home",
    description: "Structural and cosmetic issues",
    subcategories: [
      { slug: "creaky_floors", name: "Creaky floors" },
      { slug: "paint_peeling", name: "Paint peeling" },
      { slug: "water_damage", name: "Water damage" },
      { slug: "mold_mildew", name: "Mold/mildew" },
      { slug: "cracks_in_walls", name: "Cracks in walls" },
      { slug: "drafty_windows", name: "Drafty windows" },
      { slug: "uneven_floors", name: "Uneven floors" },
    ],
  },
  {
    slug: "pests",
    name: "Pests",
    icon: "bug",
    description: "Pest and vermin issues",
    subcategories: [
      { slug: "rodents", name: "Rodents" },
      { slug: "cockroaches", name: "Cockroaches" },
      { slug: "bed_bugs", name: "Bed bugs" },
      { slug: "ants", name: "Ants" },
      { slug: "flies", name: "Flies" },
      { slug: "mosquitoes", name: "Mosquitoes" },
    ],
  },
  {
    slug: "building_management",
    name: "Building Management",
    icon: "building-2",
    description: "Management and landlord quality",
    subcategories: [
      { slug: "response_time", name: "Response time" },
      { slug: "maintenance_quality", name: "Maintenance quality" },
      { slug: "lease_fairness", name: "Lease fairness" },
      { slug: "communication", name: "Communication" },
      { slug: "rent_increases", name: "Rent increases" },
    ],
  },
  {
    slug: "utilities",
    name: "Utilities",
    icon: "zap",
    description: "Utility reliability and quality",
    subcategories: [
      { slug: "heating_quality", name: "Heating quality" },
      { slug: "hot_water", name: "Hot water reliability" },
      { slug: "water_pressure", name: "Water pressure" },
      { slug: "electrical_issues", name: "Electrical issues" },
      { slug: "internet_cable", name: "Internet/cable" },
      { slug: "gas", name: "Gas" },
    ],
  },
  {
    slug: "safety",
    name: "Safety",
    icon: "shield",
    description: "Security and safety features",
    subcategories: [
      { slug: "door_locks", name: "Door locks" },
      { slug: "fire_escape", name: "Fire escape" },
      { slug: "hallway_lighting", name: "Hallway lighting" },
      { slug: "security_cameras", name: "Security cameras" },
      { slug: "buzzer_intercom", name: "Buzzer/intercom" },
      { slug: "fire_alarms", name: "Fire alarms" },
    ],
  },
  {
    slug: "general_living",
    name: "General Living",
    icon: "sofa",
    description: "General quality of life factors",
    subcategories: [
      { slug: "natural_light", name: "Natural light" },
      { slug: "cell_reception", name: "Cell phone reception" },
      { slug: "laundry", name: "Laundry access" },
      { slug: "elevator", name: "Elevator reliability" },
      { slug: "package_theft", name: "Package theft" },
      { slug: "storage", name: "Storage space" },
      { slug: "outdoor_space", name: "Outdoor space" },
      { slug: "neighbors", name: "Neighbor quality" },
    ],
  },
] as const;

export type CategorySlug = (typeof REVIEW_CATEGORIES)[number]["slug"];

import type { City } from "./cities";
import { CITY_META } from "./cities";

export const BOROUGHS = [
  "Manhattan",
  "Brooklyn",
  "Queens",
  "Bronx",
  "Staten Island",
] as const;

/** City-specific region lists (boroughs for NYC, areas for LA) */
export function getRegions(city: City): readonly string[] {
  return CITY_META[city].regions;
}

/** Label for the region concept in a given city */
export function getRegionLabel(city: City): string {
  return CITY_META[city].regionLabel;
}

export const LEASE_TYPES = [
  { value: "market_rate", label: "Market Rate" },
  { value: "rent_stabilized", label: "Rent Stabilized" },
  { value: "rent_controlled", label: "Rent Controlled" },
] as const;

/** City-specific lease types */
export const LEASE_TYPES_BY_CITY: Record<City, readonly { value: string; label: string }[]> = {
  nyc: LEASE_TYPES,
  "los-angeles": [
    { value: "market_rate", label: "Market Rate" },
    { value: "rso", label: "RSO (Rent Stabilized)" },
  ],
  chicago: [
    { value: "market_rate", label: "Market Rate" },
    { value: "rlto", label: "RLTO Protected" },
  ],
  miami: [
    { value: "market_rate", label: "Market Rate" },
  ],
  houston: [
    { value: "market_rate", label: "Market Rate" },
  ],
};

/** Rent protection label per city */
export function getRentProtectionLabel(city: City): string {
  if (city === "nyc") return "Rent Stabilized";
  if (city === "los-angeles") return "RSO Protected";
  if (city === "miami") return "No Rent Control";
  if (city === "houston") return "No Rent Control";
  return "RLTO Protected";
}

export const SCORE_COLORS = {
  good: { min: 7, color: "#10b981", label: "Good" },
  average: { min: 4, color: "#f97316", label: "Average" },
  poor: { min: 0, color: "#ef4444", label: "Poor" },
} as const;

export function getScoreColor(score: number): string {
  if (score >= 7) return SCORE_COLORS.good.color;
  if (score >= 4) return SCORE_COLORS.average.color;
  return SCORE_COLORS.poor.color;
}

export function getScoreLabel(score: number): string {
  if (score >= 7) return SCORE_COLORS.good.label;
  if (score >= 4) return SCORE_COLORS.average.label;
  return SCORE_COLORS.poor.label;
}

export type LetterGrade = "A" | "B" | "C" | "D" | "F";

export function getLetterGrade(score: number): LetterGrade {
  if (score >= 8) return "A";
  if (score >= 6) return "B";
  if (score >= 4) return "C";
  if (score >= 2) return "D";
  return "F";
}

export const GRADE_COLORS: Record<LetterGrade, string> = {
  A: "#10b981",
  B: "#22c55e",
  C: "#f97316",
  D: "#ef4444",
  F: "#dc2626",
};

export function getGradeColor(grade: LetterGrade): string {
  return GRADE_COLORS[grade];
}

/**
 * Derive a 0-10 building score from violation + complaint counts.
 * Uses log scale so scores spread naturally across the full A-F range.
 */
export function deriveScore(violations: number, complaints: number): number {
  const total = violations + complaints;
  if (total === 0) return 10;
  const score = Math.max(0, 10 - Math.log10(total + 1) * 3);
  return Math.round(score * 10) / 10;
}

export const HOUSING_COMPLAINT_TYPES = [
  "HEAT/HOT WATER",
  "PLUMBING",
  "PAINT/PLASTER",
  "WATER LEAK",
  "GENERAL",
  "ELECTRIC",
  "ELEVATOR",
  "DOOR/WINDOW",
  "FLOORING/STAIRS",
  "SAFETY",
  "APPLIANCE",
  "OUTSIDE BUILDING",
  "NOISE - RESIDENTIAL",
  "NOISE - COMMERCIAL",
  "RODENT",
  "PEST CONTROL",
  "UNSANITARY CONDITION",
  "WATER SYSTEM",
] as const;

export const LA_HOUSING_COMPLAINT_TYPES = [
  "COCKROACHES/RODENTS/PESTS",
  "PLUMBING",
  "ELECTRICAL",
  "HEATING",
  "STRUCTURAL",
  "MOLD/MILDEW",
  "WATER DAMAGE",
  "GENERAL MAINTENANCE",
  "SAFETY/SECURITY",
  "NOISE",
  "TRASH/DEBRIS",
  "PARKING",
  "ELEVATOR",
  "FIRE SAFETY",
] as const;

export const CHICAGO_HOUSING_COMPLAINT_TYPES = [
  "BUILDING/HOUSING",
  "RODENT/PEST",
  "GARBAGE/RECYCLING",
  "PLUMBING",
  "ELECTRICAL",
  "HEATING",
  "STRUCTURAL",
  "MOLD/MILDEW",
  "WATER DAMAGE",
  "SAFETY/SECURITY",
  "NOISE",
  "ELEVATOR",
  "FIRE SAFETY",
  "LEAD PAINT",
  "LOCKOUT",
] as const;

export const MIAMI_HOUSING_COMPLAINT_TYPES = [
  "CODE VIOLATION",
  "UNSAFE STRUCTURE",
  "PLUMBING",
  "ELECTRICAL",
  "STRUCTURAL",
  "MOLD/MILDEW",
  "WATER DAMAGE",
  "FLOOD DAMAGE",
  "HURRICANE DAMAGE",
  "PEST CONTROL",
  "ELEVATOR",
  "FIRE SAFETY",
  "GENERAL MAINTENANCE",
  "PARKING",
  "NOISE",
  "AC/HVAC",
] as const;

export const HOUSTON_HOUSING_COMPLAINT_TYPES = [
  "CODE VIOLATION",
  "DANGEROUS BUILDING",
  "PLUMBING",
  "ELECTRICAL",
  "STRUCTURAL",
  "MOLD/MILDEW",
  "WATER DAMAGE",
  "FLOOD DAMAGE",
  "PEST CONTROL",
  "AC/HVAC",
  "GENERAL MAINTENANCE",
  "PARKING",
  "NOISE",
  "FIRE SAFETY",
  "SWIMMING POOL",
  "WEEDY LOT",
  "STAGNANT WATER",
] as const;

/** Get the complaint types for a given city */
export function getComplaintTypes(city: City): readonly string[] {
  if (city === "nyc") return HOUSING_COMPLAINT_TYPES;
  if (city === "los-angeles") return LA_HOUSING_COMPLAINT_TYPES;
  if (city === "miami") return MIAMI_HOUSING_COMPLAINT_TYPES;
  if (city === "houston") return HOUSTON_HOUSING_COMPLAINT_TYPES;
  return CHICAGO_HOUSING_COMPLAINT_TYPES;
}

/** City-specific violation agency labels */
export const VIOLATION_AGENCIES: Record<City, { housing: string; building: string; crime: string }> = {
  nyc: { housing: "HPD", building: "DOB", crime: "NYPD" },
  "los-angeles": { housing: "LAHD", building: "LADBS", crime: "LAPD" },
  chicago: { housing: "CDPH", building: "CDBS", crime: "CPD" },
  miami: { housing: "RER", building: "RER", crime: "MDPD" },
  houston: { housing: "HND", building: "PWE", crime: "HPD" },
};

export const REVIEW_PRO_TAGS = [
  "Great management",
  "Quiet building",
  "Good natural light",
  "Responsive maintenance",
  "Pet friendly",
  "Clean common areas",
  "Good water pressure",
  "Reliable heat",
  "Nice neighbors",
  "Safe neighborhood",
  "Close to subway",
  "Close to grocery stores",
  "Spacious apartments",
  "Good closet space",
  "Updated kitchen",
  "Updated bathroom",
  "In-unit laundry",
  "Laundry in building",
  "Doorman building",
  "Package room",
  "Elevator building",
  "Roof access",
  "Outdoor space",
  "Gym in building",
  "Bike storage",
  "Storage available",
  "Parking available",
  "Good cell reception",
  "Fast internet options",
  "Hardwood floors",
  "High ceilings",
  "Central AC",
  "Dishwasher",
  "Good value for price",
  "Fair rent increases",
  "Flexible lease terms",
  "Easy move-in process",
  "Good building security",
  "Well-maintained lobby",
  "Clean hallways",
  "Good trash management",
  "Recycling available",
  "Live-in super",
  "Quick repairs",
  "New appliances",
  "Soundproof walls",
  "Great views",
  "Lots of outlets",
  "Good ventilation",
  "No pest issues",
] as const;

export const REVIEW_CON_TAGS = [
  "Thin walls",
  "Creaky floors",
  "Pest issues",
  "Slow maintenance",
  "Noisy neighbors",
  "Loud street noise",
  "Poor water pressure",
  "Unreliable heat",
  "No AC",
  "Drafty windows",
  "Paint peeling",
  "Water damage",
  "Mold or mildew",
  "Cracks in walls",
  "Uneven floors",
  "Small kitchen",
  "Outdated appliances",
  "No dishwasher",
  "No laundry in building",
  "No elevator",
  "Package theft",
  "Poor building security",
  "Dirty common areas",
  "Bad trash management",
  "Rodents",
  "Cockroaches",
  "Bed bugs",
  "Ants",
  "Unresponsive management",
  "Rude management",
  "Unfair rent increases",
  "Hard to get deposit back",
  "Hidden fees",
  "Poor lighting in hallways",
  "Broken buzzer/intercom",
  "Slow elevator",
  "No storage",
  "No bike storage",
  "No outdoor space",
  "Bad cell reception",
  "Limited internet options",
  "Noisy pipes",
  "Leaky faucets",
  "Low ceilings",
  "Not enough outlets",
  "Poor ventilation",
  "Smells from neighbors",
  "Construction noise",
  "Upstairs stomping",
  "Unsafe neighborhood",
] as const;

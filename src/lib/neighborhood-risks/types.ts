// Note: ConcernCategory includes "block_level" for UI purposes, but the
// nearby_concerns table CHECK constraint only allows the first three.
// Block-level groups are synthesized client-side from existing tables
// (nyc_311, dohmh_rats, hpd_bedbugs) — never written to nearby_concerns.
export type ConcernCategory = "public_safety" | "noise" | "environmental" | "block_level";

export type ConcernSubCategory =
  | "homeless_shelter_adult"
  | "supportive_housing"
  | "migrant_reception"
  | "methadone_clinic"
  | "halfway_house"
  | "sirens"
  | "active_construction"
  | "elevated_rail"
  | "highway"
  | "avenue_traffic"
  | "school"
  | "heliport"
  | "bus_depot"
  | "train_yard"
  | "dsny_garage"
  | "brownfield"
  | "industrial_zone"
  | "sewage_plant"
  | "power_plant"
  // Block-level (live from existing tables):
  | "rat_failures"
  | "noise_311"
  | "bedbug_history"
  // Special-case:
  | "sex_offender";

export interface ConcernRow {
  id: number;
  category: ConcernCategory;
  sub_category: ConcernSubCategory;
  name: string;
  address: string | null;
  source: string;
  source_url: string | null;
  distance_mi: number;
}

export interface ConcernSubCategoryGroup {
  sub_category: ConcernSubCategory;
  category: ConcernCategory;
  total_count: number;
  items: ConcernRow[];
}

export interface NeighborhoodRisksResult {
  building: {
    id: string;
    name: string;
    address: string;
    borough: string;
    neighborhood: string;
    lat: number;
    lng: number;
    slug: string;
  };
  groups: ConcernSubCategoryGroup[];
  sex_offender_count: number;
  block_level: {
    rat_failures: number;
    noise_311: number;
    noise_311_on_block: number;
    bedbug_history: number;
  };
  total_concerns: number;
  within_block_count: number;
}

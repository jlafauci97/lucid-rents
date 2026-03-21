import type { City } from "@/lib/cities";

export type Borough = "Manhattan" | "Brooklyn" | "Queens" | "Bronx" | "Staten Island";

export type LeaseType = "rent_stabilized" | "market_rate" | "rent_controlled" | "rso";

export type ReviewStatus = "draft" | "published" | "flagged" | "removed";

export interface Building {
  id: string;
  metro: City;
  bbl: string | null;
  bin: string | null;
  apn: string | null;
  borough: string;
  house_number: string | null;
  street_name: string;
  city: string;
  state: string;
  zip_code: string | null;
  full_address: string;
  year_built: number | null;
  num_floors: number | null;
  total_units: number | null;
  residential_units: number | null;
  commercial_units: number | null;
  building_class: string | null;
  land_use: string | null;
  owner_name: string | null;
  slug: string;
  overall_score: number | null;
  review_count: number;
  violation_count: number;
  complaint_count: number;
  litigation_count: number;
  dob_violation_count: number;
  crime_count: number;
  bedbug_report_count: number;
  eviction_count: number;
  permit_count: number;
  energy_star_score: number | null;
  is_rent_stabilized: boolean;
  stabilized_units: number | null;
  stabilized_year: number | null;
  latitude: number | null;
  longitude: number | null;
  is_soft_story: boolean;
  soft_story_status: string | null;
  is_rso: boolean;
  fire_risk_zone: string | null;
  created_at: string;
  updated_at: string;
}

export interface Unit {
  id: string;
  building_id: string;
  unit_number: string;
  floor: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  overall_score: number | null;
  review_count: number;
  created_at: string;
  updated_at: string;
}

export interface UnitListing {
  id: string;
  unit_id: string;
  building_id: string;
  source: string;
  unit_number: string;
  price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  listing_url: string | null;
  available: boolean;
  scraped_at: string;
}

export interface Profile {
  id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_verified_renter: boolean;
  neighborhoods_lived: string[] | null;
  review_count: number;
  helpful_count: number;
  reputation: number;
  created_at: string;
  updated_at: string;
}

export interface ReviewCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  display_order: number;
}

export interface ReviewSubcategory {
  id: string;
  category_id: string;
  slug: string;
  name: string;
  description: string | null;
  display_order: number;
}

export interface Review {
  id: string;
  user_id: string;
  building_id: string;
  unit_id: string | null;
  overall_rating: number;
  title: string | null;
  body: string | null;
  move_in_date: string | null;
  move_out_date: string | null;
  rent_amount: number | null;
  lease_type: LeaseType | null;
  status: ReviewStatus;
  helpful_count: number;
  created_at: string;
  updated_at: string;
}

export interface ReviewCategoryRating {
  id: string;
  review_id: string;
  category_id: string;
  rating: number;
  subcategory_flags: string[];
}

export interface ReviewWithDetails extends Review {
  profile: Pick<Profile, "id" | "display_name" | "avatar_url">;
  category_ratings: (ReviewCategoryRating & {
    category: Pick<ReviewCategory, "slug" | "name" | "icon">;
  })[];
  unit: Pick<Unit, "unit_number"> | null;
}

export interface HpdViolation {
  id: string;
  building_id: string | null;
  bbl: string | null;
  bin: string | null;
  violation_id: string;
  class: "A" | "B" | "C" | "I";
  inspection_date: string | null;
  nov_description: string | null;
  nov_issue_date: string | null;
  status: string | null;
  status_date: string | null;
  borough: string | null;
  house_number: string | null;
  street_name: string | null;
  apartment: string | null;
  imported_at: string;
}

export interface HpdLitigation {
  id: string;
  building_id: string | null;
  bbl: string | null;
  litigation_id: string;
  case_type: string | null;
  case_status: string | null;
  case_open_date: string | null;
  case_close_date: string | null;
  case_judgment: string | null;
  penalty: string | null;
  respondent: string | null;
  borough: string | null;
  house_number: string | null;
  street_name: string | null;
  zip: string | null;
  imported_at: string;
}

export interface DobViolation {
  id: string;
  building_id: string | null;
  bbl: string | null;
  bin: string | null;
  isn_dob_bis_vio: string;
  violation_type: string | null;
  violation_category: string | null;
  description: string | null;
  issue_date: string | null;
  disposition_date: string | null;
  disposition_comments: string | null;
  penalty_amount: number | null;
  borough: string | null;
  house_number: string | null;
  street_name: string | null;
  imported_at: string;
}

export interface Complaint311 {
  id: string;
  building_id: string | null;
  unique_key: string;
  complaint_type: string | null;
  descriptor: string | null;
  agency: string | null;
  status: string | null;
  created_date: string | null;
  closed_date: string | null;
  resolution_description: string | null;
  borough: string | null;
  incident_address: string | null;
  latitude: number | null;
  longitude: number | null;
  imported_at: string;
}

export type CrimeCategory = "violent" | "property" | "quality_of_life";

export interface NypdComplaint {
  id: string;
  cmplnt_num: string;
  cmplnt_date: string | null;
  borough: string | null;
  precinct: number | null;
  offense_description: string | null;
  law_category: string | null;
  crime_category: CrimeCategory | null;
  pd_description: string | null;
  latitude: number | null;
  longitude: number | null;
  zip_code: string | null;
  imported_at: string;
}

export interface BuildingScore {
  id: string;
  building_id: string;
  category_id: string;
  avg_rating: number | null;
  total_ratings: number;
  public_data_score: number | null;
  combined_score: number | null;
  updated_at: string;
}

export interface RentStabilization {
  id: string;
  building_id: string | null;
  bbl: string;
  year: number;
  units_stabilized: number | null;
  units_total: number | null;
  est_units_stabilized: number | null;
  diff_units_stabilized: number | null;
  imported_at: string;
}

export interface BedBugReport {
  id: string;
  building_id: string | null;
  bbl: string | null;
  bin: string | null;
  registration_id: string | null;
  house_number: string | null;
  street_name: string | null;
  borough: string | null;
  postcode: string | null;
  infested_dwelling_unit_count: number | null;
  eradicated_unit_count: number | null;
  reinfested_unit_count: number | null;
  total_dwelling_units: number | null;
  filing_date: string | null;
  filing_period_start_date: string | null;
  filing_period_end_date: string | null;
  imported_at: string;
}

export interface Eviction {
  id: string;
  building_id: string | null;
  bbl: string | null;
  bin: string | null;
  court_index_number: string;
  docket_number: string | null;
  eviction_address: string | null;
  eviction_apt_num: string | null;
  eviction_zip: string | null;
  borough: string | null;
  executed_date: string | null;
  residential_commercial: string | null;
  eviction_possession: string | null;
  ejectment: string | null;
  marshal_first_name: string | null;
  marshal_last_name: string | null;
  imported_at: string;
}


export interface EnergyBenchmark {
  id: string;
  building_id: string | null;
  bbl: string | null;
  property_id: string | null;
  property_name: string | null;
  property_type: string | null;
  report_year: number;
  address: string | null;
  borough: string | null;
  zip_code: string | null;
  energy_star_score: number | null;
  site_eui: number | null;
  weather_normalized_eui: number | null;
  total_ghg_emissions: number | null;
  electricity_use: number | null;
  natural_gas_use: number | null;
  water_use: number | null;
  year_built: number | null;
  number_of_buildings: number | null;
  property_gfa: number | null;
  imported_at: string;
}

export interface DobPermit {
  id: string;
  building_id: string | null;
  bbl: string | null;
  bin: string | null;
  work_permit: string;
  house_no: string | null;
  street_name: string | null;
  borough: string | null;
  zip_code: string | null;
  block: string | null;
  lot: string | null;
  work_type: string | null;
  permit_status: string | null;
  filing_reason: string | null;
  issued_date: string | null;
  expired_date: string | null;
  job_description: string | null;
  estimated_job_costs: number | null;
  owner_business_name: string | null;
  permittee_business_name: string | null;
  latitude: number | null;
  longitude: number | null;
  imported_at: string;
}

export interface NewsArticle {
  id: string;
  guid: string;
  slug: string;
  title: string;
  excerpt: string | null;
  url: string;
  source_name: string;
  source_slug: string;
  category: string;
  image_url: string | null;
  author: string | null;
  published_at: string;
  fetched_at: string;
  created_at: string;
}

export interface SearchResult {
  buildings: Building[];
  total: number;
  page: number;
}

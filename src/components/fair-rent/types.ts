export interface AnalyzeRequest {
  url: string;
  amenities?: string[];
}

export interface ListingData {
  asking_price: number;
  beds: number;
  baths: number | null;
  sqft: number | null;
  floor: number | null;
  zip_code: string;
  address: string;
  days_on_market: number | null;
  price_cut: { occurred: boolean; amount: number | null } | null;
  listed_amenities: string[];
}

export interface QualityFactor {
  name: string;
  signal: string;
  adjustment: number; // e.g. -0.05 = 5% discount
  dollar_impact: number; // actual dollar amount this factor contributed
  direction: "premium" | "discount" | "neutral";
  detail: string;
}

export interface PricingResult {
  base_price: number;
  comp_count: number;
  comp_prices: number[];
  fallback_triggered: boolean;
  zori_current: number | null;
  zori_12mo_avg: number | null;
  zori_blend_triggered: boolean;
  blended_base: number;
  amenity_multiplier: number;
  amenity_adjustments: { name: string; value: number }[];
  seasonal_factor: number;
  seasonal_signal: "high" | "low" | "neutral" | "unknown";
  seasonal_label: string;
  negotiation_tip: string;
  quality_factors: QualityFactor[];
  quality_adjustment: number; // combined multiplier from all quality factors
  fair_price: number;
  fair_range_low: number;
  fair_range_high: number;
  asking_vs_fair_pct: number;
}

export interface ViolationsSignal {
  open_a: number;
  open_b: number;
  open_c: number;
  closed_12mo: number;
  zip_median: number;
  classification: "above_average" | "average" | "below_average";
  summary: string;
}

export interface ComplaintsSignal {
  total_complaints: number;
  top_categories: { category: string; count: number }[];
  zip_median: number;
  classification: "above_average" | "average" | "below_average";
  summary: string;
}

export interface StabilizationSignal {
  is_stabilized: boolean;
  stabilized_units: number | null;
  total_units: number | null;
  yoy_unit_change_pct: number | null;
  summary: string;
}

export interface LitigationsSignal {
  active_litigations: number;
  closed_litigations_3yr: number;
  case_types: string[];
  has_harassment_case: boolean;
  zip_median: number;
  classification: "above_average" | "average" | "below_average";
  summary: string;
}

export interface CrimeSignal {
  violent_count: number;
  property_count: number;
  qol_count: number;
  yoy_violent_trend: number;
  per_1k_violent: number;
  safety_grade: "A" | "B" | "C" | "D" | "F";
  trend_label: "improving" | "stable" | "worsening";
  summary: string;
}

export interface ComparableBuilding {
  full_address: string;
  borough: string;
  slug: string;
  zip_code: string;
  total_units: number | null;
  violation_count: number;
  complaint_count: number;
  overall_score: string;
  is_rent_stabilized: boolean;
  year_built: number | null;
  crime_count: number | null;
  median_rent: number | null;
  amenities: string[];
}

export interface AnalyzeResponse {
  listing: ListingData;
  pricing: PricingResult;
  violations: ViolationsSignal | null;
  complaints: ComplaintsSignal | null;
  stabilization: StabilizationSignal | null;
  litigations: LitigationsSignal | null;
  crime: CrimeSignal | null;
  comparables: ComparableBuilding[];
}

export type Screen = "landing" | "loading" | "results" | "error";

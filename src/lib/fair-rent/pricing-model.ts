import type { PricingResult, ListingData, QualityFactor, ViolationsSignal, ComplaintsSignal, CrimeSignal, LitigationsSignal, StabilizationSignal } from "@/components/fair-rent/types";
import type { ZoriLookupResult } from "./zori-lookup";
import {
  AMENITY_MULTIPLIERS,
  AMENITY_POSITIVE_CAP,
  AMENITY_NEGATIVE_FLOOR,
  SEASONAL_HIGH_THRESHOLD,
  SEASONAL_LOW_THRESHOLD,
  ZORI_DIVERGENCE_THRESHOLD,
  ZORI_BLEND_WEIGHT_COMP,
  ZORI_BLEND_WEIGHT_ZORI,
} from "./constants";

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export interface QualitySignals {
  violations: ViolationsSignal | null;
  complaints: ComplaintsSignal | null;
  crime: CrimeSignal | null;
  litigations: LitigationsSignal | null;
  stabilization: StabilizationSignal | null;
}

/**
 * Compute quality adjustment factors from building/neighborhood signals.
 * Each factor produces a percentage adjustment (positive = premium, negative = discount).
 * The logic: worse-than-average conditions reduce fair rent; better-than-average increase it.
 */
function computeQualityFactors(signals: QualitySignals, preAdjustPrice: number): QualityFactor[] {
  const factors: QualityFactor[] = [];

  // 1. HPD Violations — high violations = discount (building is worse)
  if (signals.violations) {
    const total = signals.violations.open_a + signals.violations.open_b + signals.violations.open_c;
    const zipMedian = signals.violations.zip_median;
    let adj = 0;
    let direction: QualityFactor["direction"] = "neutral";
    let detail = "";

    if (signals.violations.classification === "above_average") {
      // Scale: 1.5x median = -3%, 3x median = -7%, 5x+ median = -10%
      const ratio = zipMedian > 0 ? total / zipMedian : 2;
      adj = -Math.min(0.10, Math.max(0.03, (ratio - 1) * 0.035));
      direction = "discount";
      detail = `${total} open violations (${signals.violations.open_c} Class C) vs ZIP median ${zipMedian}. Above-average issues warrant a discount.`;
    } else if (signals.violations.classification === "below_average") {
      adj = 0.02;
      direction = "premium";
      detail = `Only ${total} open violations vs ZIP median ${zipMedian}. Well-maintained building.`;
    } else {
      detail = `${total} open violations — in line with ZIP median ${zipMedian}.`;
    }

    factors.push({
      name: "HPD Violations",
      signal: `${total} open (${signals.violations.open_c} serious)`,
      adjustment: adj,
      dollar_impact: Math.round(preAdjustPrice * adj),
      direction,
      detail,
    });
  }

  // 2. 311 Complaints — high complaints = discount
  if (signals.complaints) {
    const total = signals.complaints.total_complaints;
    const zipMedian = signals.complaints.zip_median;
    let adj = 0;
    let direction: QualityFactor["direction"] = "neutral";
    let detail = "";

    if (signals.complaints.classification === "above_average") {
      const ratio = zipMedian > 0 ? total / zipMedian : 2;
      adj = -Math.min(0.06, Math.max(0.02, (ratio - 1) * 0.025));
      direction = "discount";
      const topIssues = signals.complaints.top_categories.slice(0, 2).map((c) => c.category).join(", ");
      detail = `${total} complaints in 12mo vs ZIP median ${zipMedian}. Top issues: ${topIssues}.`;
    } else if (signals.complaints.classification === "below_average") {
      adj = 0.015;
      direction = "premium";
      detail = `Only ${total} complaints vs ZIP median ${zipMedian}. Quiet building.`;
    } else {
      detail = `${total} complaints — average for the area.`;
    }

    factors.push({
      name: "311 Complaints",
      signal: `${total} past year`,
      adjustment: adj,
      dollar_impact: Math.round(preAdjustPrice * adj),
      direction,
      detail,
    });
  }

  // 3. Crime — high crime ZIP = discount
  if (signals.crime) {
    let adj = 0;
    let direction: QualityFactor["direction"] = "neutral";
    let detail = "";
    const grade = signals.crime.safety_grade;

    if (grade === "A") {
      adj = 0.04;
      direction = "premium";
      detail = "Top 20% safest ZIP in NYC. Low crime supports higher rents.";
    } else if (grade === "B") {
      adj = 0.02;
      direction = "premium";
      detail = "Above-average safety. Low crime is a value-add.";
    } else if (grade === "D") {
      adj = -0.04;
      direction = "discount";
      detail = "Below-average safety. Higher crime reduces fair market value.";
    } else if (grade === "F") {
      adj = -0.07;
      direction = "discount";
      detail = "Bottom 20% for crime in NYC. Significant safety discount warranted.";
    } else {
      detail = "Average crime levels for NYC.";
    }

    // Worsening trend adds extra discount
    if (signals.crime.trend_label === "worsening" && signals.crime.yoy_violent_trend > 10) {
      adj -= 0.02;
      if (direction === "neutral") direction = "discount";
      detail += ` Crime worsening ${Math.round(signals.crime.yoy_violent_trend)}% YoY — additional discount.`;
    } else if (signals.crime.trend_label === "improving" && signals.crime.yoy_violent_trend < -10) {
      adj += 0.01;
      if (direction === "neutral") direction = "premium";
      detail += ` Crime improving — positive trend.`;
    }

    factors.push({
      name: "Neighborhood Crime",
      signal: `Grade ${grade} · ${signals.crime.trend_label}`,
      adjustment: adj,
      dollar_impact: Math.round(preAdjustPrice * adj),
      direction,
      detail,
    });
  }

  // 4. Litigations — active cases = discount, harassment = severe discount
  if (signals.litigations) {
    let adj = 0;
    let direction: QualityFactor["direction"] = "neutral";
    let detail = "";

    if (signals.litigations.has_harassment_case) {
      adj = -0.08;
      direction = "discount";
      detail = `Tenant harassment case on record. ${signals.litigations.active_litigations} active cases. Serious red flag — significant discount.`;
    } else if (signals.litigations.classification === "above_average") {
      adj = -Math.min(0.05, 0.02 * signals.litigations.active_litigations);
      direction = "discount";
      detail = `${signals.litigations.active_litigations} active legal cases — above ZIP average. Ongoing legal issues reduce value.`;
    } else if (signals.litigations.active_litigations === 0 && signals.litigations.closed_litigations_3yr === 0) {
      adj = 0.02;
      direction = "premium";
      detail = "No litigation history. Clean legal record supports fair value.";
    } else {
      detail = `${signals.litigations.active_litigations} active cases — average for the area.`;
    }

    factors.push({
      name: "Legal Cases",
      signal: `${signals.litigations.active_litigations} active`,
      adjustment: adj,
      dollar_impact: Math.round(preAdjustPrice * adj),
      direction,
      detail,
    });
  }

  // 5. Rent Stabilization — stabilized buildings in deregulation trend = discount
  if (signals.stabilization) {
    let adj = 0;
    let direction: QualityFactor["direction"] = "neutral";
    let detail = "";

    if (signals.stabilization.is_stabilized) {
      adj = 0.0; // Stabilization itself is neutral for market-rate fair pricing
      detail = "Rent-stabilized building. If your unit is stabilized, legal rent may be lower than market rate.";
      if (signals.stabilization.yoy_unit_change_pct != null && signals.stabilization.yoy_unit_change_pct < -10) {
        adj = -0.03;
        direction = "discount";
        detail += ` Losing stabilized units (${Math.round(signals.stabilization.yoy_unit_change_pct)}% YoY) — possible deregulation pressure.`;
      }
    } else {
      detail = "Market rate building. No stabilization protections.";
    }

    factors.push({
      name: "Rent Stabilization",
      signal: signals.stabilization.is_stabilized ? "Stabilized" : "Market Rate",
      adjustment: adj,
      dollar_impact: Math.round(preAdjustPrice * adj),
      direction,
      detail,
    });
  }

  return factors;
}

export function calculateFairPrice(
  listing: ListingData,
  compPrices: number[],
  zori: ZoriLookupResult,
  selectedAmenities: string[],
  qualitySignals: QualitySignals
): PricingResult {
  // Step 1: Base price
  const comp_count = compPrices.length;
  const fallback_triggered = comp_count < 5;
  const base_price =
    comp_count > 0 ? median(compPrices) : (zori.current ?? listing.asking_price);

  // Step 2: ZORI validation
  let blended_base = base_price;
  let zori_blend_triggered = false;

  if (zori.current != null) {
    const divergence = Math.abs(base_price - zori.current) / zori.current;
    if (divergence > ZORI_DIVERGENCE_THRESHOLD) {
      blended_base =
        base_price * ZORI_BLEND_WEIGHT_COMP + zori.current * ZORI_BLEND_WEIGHT_ZORI;
      zori_blend_triggered = true;
    }
  }

  // Step 3: Amenity multiplier
  const amenity_adjustments: { name: string; value: number }[] = [];
  let positiveSum = 0;
  let negativeSum = 0;

  for (const amenity of selectedAmenities) {
    const val = AMENITY_MULTIPLIERS[amenity];
    if (val != null) {
      if (val > 0) positiveSum += val;
      else negativeSum += val;
      amenity_adjustments.push({ name: amenity, value: val });
    }
  }

  if (
    !selectedAmenities.includes("elevator") &&
    listing.floor != null &&
    listing.floor > 1
  ) {
    const walkupVal = AMENITY_MULTIPLIERS.no_elevator;
    negativeSum += walkupVal;
    amenity_adjustments.push({ name: "no_elevator (walkup)", value: walkupVal });
  }

  const clampedPositive = Math.min(positiveSum, AMENITY_POSITIVE_CAP);
  const clampedNegative = Math.max(negativeSum, AMENITY_NEGATIVE_FLOOR);
  const amenity_multiplier = 1 + clampedPositive + clampedNegative;

  // Step 4: Seasonal factor
  let seasonal_factor = 1.0;
  let seasonal_signal: PricingResult["seasonal_signal"] = "unknown";
  let seasonal_label = "Seasonal data unavailable";
  let negotiation_tip = "Standard negotiating conditions apply.";

  if (zori.current != null && zori.avg_12mo != null && zori.avg_12mo > 0) {
    seasonal_factor = zori.current / zori.avg_12mo;

    if (seasonal_factor > SEASONAL_HIGH_THRESHOLD) {
      seasonal_signal = "high";
      seasonal_label = "High season — prices are elevated right now";
      negotiation_tip = "Less negotiation room. Landlords know demand is strong.";
    } else if (seasonal_factor < SEASONAL_LOW_THRESHOLD) {
      seasonal_signal = "low";
      seasonal_label = "Low season — prices are soft right now";
      negotiation_tip = "Good time to negotiate. Offer 3-5% below asking.";
    } else {
      seasonal_signal = "neutral";
      seasonal_label = "Neutral season — normal market conditions";
      negotiation_tip = "Standard negotiating conditions apply.";
    }
  }

  // Step 5: Quality adjustment (NEW — building/neighborhood signals)
  const preQualityPrice = blended_base * amenity_multiplier * seasonal_factor;
  const quality_factors = computeQualityFactors(qualitySignals, preQualityPrice);
  const quality_adjustment = quality_factors.reduce((sum, f) => sum + f.adjustment, 0);
  // Clamp total quality adjustment between -20% and +10%
  const clamped_quality = Math.max(-0.20, Math.min(0.10, quality_adjustment));

  // Step 6: Final price
  const fair_price = preQualityPrice * (1 + clamped_quality);
  const fair_range_low = fair_price * 0.95;
  const fair_range_high = fair_price * 1.05;
  const asking_vs_fair_pct =
    ((listing.asking_price - fair_price) / fair_price) * 100;

  return {
    base_price,
    comp_count,
    comp_prices: compPrices,
    fallback_triggered,
    zori_current: zori.current,
    zori_12mo_avg: zori.avg_12mo,
    zori_blend_triggered,
    blended_base,
    amenity_multiplier,
    amenity_adjustments,
    seasonal_factor,
    seasonal_signal,
    seasonal_label,
    negotiation_tip,
    quality_factors,
    quality_adjustment: clamped_quality,
    fair_price,
    fair_range_low,
    fair_range_high,
    asking_vs_fair_pct,
  };
}

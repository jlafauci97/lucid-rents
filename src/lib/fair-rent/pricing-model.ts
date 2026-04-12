import type { PricingResult, ListingData } from "@/components/fair-rent/types";
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

export function calculateFairPrice(
  listing: ListingData,
  compPrices: number[],
  zori: ZoriLookupResult,
  selectedAmenities: string[]
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

  // Infer walkup
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

  // Step 5: Final price
  const fair_price = blended_base * amenity_multiplier * seasonal_factor;
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
    fair_price,
    fair_range_low,
    fair_range_high,
    asking_vs_fair_pct,
  };
}

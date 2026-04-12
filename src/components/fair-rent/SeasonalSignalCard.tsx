import type { PricingResult, ListingData } from "./types";

interface SeasonalSignalCardProps {
  pricing: PricingResult;
  listing: ListingData;
}

export function SeasonalSignalCard({ pricing, listing }: SeasonalSignalCardProps) {
  const { seasonal_signal, seasonal_label } = pricing;
  const dom = listing.days_on_market;

  // Combined negotiation tip using season + days on market
  let combinedTip = pricing.negotiation_tip;
  if (seasonal_signal === "low" && dom != null && dom > 30) {
    combinedTip = "Strong position — this unit has been sitting. Consider offering 5-7% below asking.";
  } else if (seasonal_signal === "high" && dom != null && dom < 14) {
    combinedTip = "Limited leverage — this unit is moving fast. Asking price is likely firm.";
  } else if (seasonal_signal === "high" && dom != null && dom > 30) {
    combinedTip = "Even in high season this unit has been sitting. There may be room to negotiate.";
  } else if (dom != null) {
    combinedTip = "Standard market conditions. A 2-3% below-ask offer is reasonable to try.";
  }

  const badgeColor =
    seasonal_signal === "high"
      ? "bg-red-50 text-red-700 border-red-200"
      : seasonal_signal === "low"
        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
        : "bg-gray-100 text-gray-600 border-gray-200";

  const badgeLabel =
    seasonal_signal === "high"
      ? "HIGH SEASON"
      : seasonal_signal === "low"
        ? "LOW SEASON"
        : seasonal_signal === "neutral"
          ? "NEUTRAL SEASON"
          : "SEASON UNKNOWN";

  return (
    <div className="bg-white border border-[#e8e6e1] rounded-2xl p-6 sm:p-8">
      <p className="text-[11px] font-semibold tracking-[2px] uppercase text-gray-300 mb-5">
        Seasonal Signal
      </p>

      <div className="flex items-center gap-3 mb-4">
        <span
          className={`inline-flex px-3 py-1 rounded-full text-[11px] font-semibold border ${badgeColor}`}
        >
          {badgeLabel}
        </span>
        {dom != null && (
          <span className="text-sm text-gray-400">
            {dom} days on market
          </span>
        )}
      </div>

      <p className="text-sm text-gray-500 mb-3">{seasonal_label}</p>
      <p className="text-sm text-gray-700 font-medium">{combinedTip}</p>

      <p className="text-[10px] text-gray-300 mt-5">
        Seasonal index based on Zillow ZORI monthly data
      </p>
    </div>
  );
}

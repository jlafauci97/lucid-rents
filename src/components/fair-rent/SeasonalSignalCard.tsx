"use client";

import { motion } from "framer-motion";
import type { PricingResult, ListingData } from "./types";
import { Clock, Flame, Snowflake, Sun } from "lucide-react";

interface SeasonalSignalCardProps {
  pricing: PricingResult;
  listing: ListingData;
}

export function SeasonalSignalCard({ pricing, listing }: SeasonalSignalCardProps) {
  const { seasonal_signal, seasonal_label, seasonal_factor } = pricing;
  const dom = listing.days_on_market;

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

  const seasonColor = seasonal_signal === "high" ? "#dc2626" : seasonal_signal === "low" ? "#059669" : "#6b7280";
  const SeasonIcon = seasonal_signal === "high" ? Flame : seasonal_signal === "low" ? Snowflake : Sun;

  // Meter: 0 = very low season, 100 = very high season. 50 = neutral.
  const meterPct = Math.max(0, Math.min(100, ((seasonal_factor - 0.94) / 0.12) * 100));

  return (
    <div className="bg-white border border-[#e8e6e1] rounded-2xl p-6 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <p className="text-[11px] font-semibold tracking-[2px] uppercase text-gray-300">
          Seasonal & Negotiation
        </p>
        <SeasonIcon size={16} style={{ color: seasonColor }} />
      </div>

      <div className="flex flex-col sm:flex-row gap-6 sm:gap-8">
        {/* Seasonal meter */}
        <div className="flex-1">
          <div className="flex items-center justify-between text-[9px] uppercase tracking-wide text-gray-400 mb-1.5">
            <span>Low season</span>
            <span>High season</span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden relative">
            <div
              className="absolute inset-0 rounded-full"
              style={{ background: "linear-gradient(90deg, #bbf7d0, #fef9c3, #fecaca)" }}
            />
            <motion.div
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-[3px] border-white shadow-md"
              style={{ backgroundColor: seasonColor }}
              initial={{ left: "50%" }}
              animate={{ left: `${meterPct}%` }}
              transition={{ type: "spring", stiffness: 80, damping: 15, delay: 0.3 }}
            />
          </div>
          <p className="text-sm text-gray-600 mt-3">{seasonal_label}</p>
          <p className="text-xs text-gray-400 mt-0.5">Factor: {seasonal_factor.toFixed(3)}x</p>
        </div>

        {/* Days on market */}
        {dom != null && (
          <div className="flex-shrink-0 text-center sm:text-right">
            <div className="flex items-center gap-1.5 justify-center sm:justify-end text-gray-400 mb-1">
              <Clock size={12} />
              <span className="text-[10px] uppercase tracking-wide">Days on market</span>
            </div>
            <p className="text-3xl font-bold text-[#0b0b0b]">{dom}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {dom > 30 ? "Sitting long — leverage" : dom < 14 ? "Moving fast" : "Average pace"}
            </p>
          </div>
        )}
      </div>

      {/* Negotiation tip */}
      <div className="mt-5 bg-[#f5f4f1] rounded-xl px-4 py-3.5">
        <p className="text-xs font-semibold text-gray-600 mb-0.5">Negotiation tip</p>
        <p className="text-sm text-gray-500 leading-relaxed">{combinedTip}</p>
      </div>

      <p className="text-[10px] text-gray-300 mt-4">
        Seasonal index based on Zillow ZORI monthly data
      </p>
    </div>
  );
}

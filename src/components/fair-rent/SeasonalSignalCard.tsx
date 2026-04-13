"use client";

import { motion } from "framer-motion";
import type { PricingResult, ListingData } from "./types";
import { Clock, Flame, Snowflake, Sun } from "lucide-react";

export function SeasonalSignalCard({ pricing, listing }: { pricing: PricingResult; listing: ListingData }) {
  const { seasonal_signal, seasonal_label, seasonal_factor } = pricing;
  const dom = listing.days_on_market;
  let combinedTip = pricing.negotiation_tip;
  if (seasonal_signal === "low" && dom != null && dom > 30) combinedTip = "Strong position — unit sitting long. Offer 5-7% below.";
  else if (seasonal_signal === "high" && dom != null && dom < 14) combinedTip = "Limited leverage — moving fast. Asking likely firm.";
  else if (seasonal_signal === "high" && dom != null && dom > 30) combinedTip = "Even in high season this unit sat. Room to negotiate.";
  else if (dom != null) combinedTip = "Standard conditions. 2-3% below ask is reasonable.";

  const seasonColor = seasonal_signal === "high" ? "#dc2626" : seasonal_signal === "low" ? "#059669" : "#6b7280";
  const SeasonIcon = seasonal_signal === "high" ? Flame : seasonal_signal === "low" ? Snowflake : Sun;
  const meterPct = Math.max(0, Math.min(100, ((seasonal_factor - 0.94) / 0.12) * 100));

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <p className="text-xs font-semibold uppercase tracking-[2px] text-gray-400">Seasonal & Negotiation</p>
        <SeasonIcon size={15} style={{ color: seasonColor }} />
      </div>
      <div className="flex flex-col sm:flex-row gap-6">
        <div className="flex-1">
          <div className="flex justify-between text-[9px] uppercase tracking-wide text-gray-400 mb-1.5"><span>Low</span><span>High</span></div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden relative">
            <div className="absolute inset-0 rounded-full" style={{ background: "linear-gradient(90deg, #bbf7d0, #fef9c3, #fecaca)" }} />
            <motion.div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-[3px] border-white shadow-md"
              style={{ backgroundColor: seasonColor }} initial={{ left: "50%" }} animate={{ left: `${meterPct}%` }}
              transition={{ type: "spring", stiffness: 80, damping: 15, delay: 0.3 }} />
          </div>
          <p className="text-sm text-gray-600 mt-3">{seasonal_label}</p>
        </div>
        {dom != null && (
          <div className="flex-shrink-0 text-center sm:text-right">
            <div className="flex items-center gap-1.5 justify-center sm:justify-end text-gray-400 mb-1"><Clock size={11} /><span className="text-[9px] uppercase tracking-wide">Days on Market</span></div>
            <p className="text-3xl font-bold text-gray-900">{dom}</p>
          </div>
        )}
      </div>
      <div className="mt-5 bg-gray-50 rounded-xl px-4 py-3.5 border border-gray-100">
        <p className="text-xs font-semibold text-gray-600 mb-0.5">Negotiation tip</p>
        <p className="text-sm text-gray-500">{combinedTip}</p>
      </div>
    </div>
  );
}

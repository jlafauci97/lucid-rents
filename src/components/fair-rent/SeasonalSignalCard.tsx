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

  const seasonColor = seasonal_signal === "high" ? "#ef4444" : seasonal_signal === "low" ? "#00D4FF" : "#6b7280";
  const SeasonIcon = seasonal_signal === "high" ? Flame : seasonal_signal === "low" ? Snowflake : Sun;
  const meterPct = Math.max(0, Math.min(100, ((seasonal_factor - 0.94) / 0.12) * 100));

  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 sm:p-8 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-6">
        <p className="text-[10px] font-mono font-bold tracking-[2px] uppercase text-[#00D4FF]/50">Seasonal & Negotiation</p>
        <SeasonIcon size={15} style={{ color: seasonColor }} />
      </div>

      <div className="flex flex-col sm:flex-row gap-6">
        <div className="flex-1">
          <div className="flex justify-between text-[8px] font-mono uppercase tracking-wide text-white/20 mb-1.5">
            <span>Low</span><span>High</span>
          </div>
          <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden relative">
            <div className="absolute inset-0 rounded-full" style={{ background: "linear-gradient(90deg, #00D4FF40, #fbbf2440, #ef444440)" }} />
            <motion.div
              className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 border-[#0a0e17]"
              style={{ backgroundColor: seasonColor, boxShadow: `0 0 12px ${seasonColor}60` }}
              initial={{ left: "50%" }}
              animate={{ left: `${meterPct}%` }}
              transition={{ type: "spring", stiffness: 80, damping: 15, delay: 0.3 }}
            />
          </div>
          <p className="text-xs font-mono text-white/40 mt-3">{seasonal_label}</p>
        </div>
        {dom != null && (
          <div className="flex-shrink-0 text-center sm:text-right">
            <div className="flex items-center gap-1.5 justify-center sm:justify-end text-white/20 mb-1">
              <Clock size={11} />
              <span className="text-[8px] font-mono uppercase tracking-wide">Days on Market</span>
            </div>
            <p className="text-3xl font-bold font-mono text-white">{dom}</p>
          </div>
        )}
      </div>

      <div className="mt-5 bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3">
        <p className="text-[9px] font-mono uppercase tracking-wider text-[#00D4FF]/40 mb-0.5">Negotiation Intel</p>
        <p className="text-xs font-mono text-white/40">{combinedTip}</p>
      </div>
    </div>
  );
}

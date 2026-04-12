"use client";

import { motion } from "framer-motion";

interface PricingVerdictProps { askingVsFairPct: number; fairPrice: number; askingPrice: number; redFlagCount: number; }

export function PricingVerdict({ askingVsFairPct, fairPrice, askingPrice, redFlagCount }: PricingVerdictProps) {
  const isOverpriced = askingVsFairPct > 5;
  const isUnderpriced = askingVsFairPct < -5;
  const clampedPct = Math.max(-40, Math.min(40, askingVsFairPct));
  const angle = 90 + (clampedPct / 40) * 90;
  const color = isOverpriced ? "#dc2626" : isUnderpriced ? "#059669" : "#6b7280";
  const label = isOverpriced
    ? `${redFlagCount > 0 ? `${redFlagCount} red flag${redFlagCount > 1 ? "s" : ""} · ` : ""}${Math.round(askingVsFairPct)}% overpriced`
    : isUnderpriced ? `${Math.abs(Math.round(askingVsFairPct))}% below fair value` : "Priced within fair range";
  const verdictWord = isOverpriced ? "Overpriced" : isUnderpriced ? "Good Deal" : "Fair";
  const fmt = (n: number) => "$" + Math.round(n).toLocaleString();

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm mb-1">
      <div className="flex flex-col sm:flex-row items-center gap-6">
        <div className="flex-shrink-0">
          <svg width="180" height="100" viewBox="0 0 180 100">
            <path d="M 15 90 A 75 75 0 0 1 165 90" fill="none" stroke="#f0f0f0" strokeWidth="8" strokeLinecap="round" />
            <path d="M 15 90 A 75 75 0 0 1 55 25" fill="none" stroke="#bbf7d0" strokeWidth="8" strokeLinecap="round" />
            <path d="M 55 25 A 75 75 0 0 1 125 25" fill="none" stroke="#fef9c3" strokeWidth="8" strokeLinecap="round" />
            <path d="M 125 25 A 75 75 0 0 1 165 90" fill="none" stroke="#fecaca" strokeWidth="8" strokeLinecap="round" />
            <motion.line x1="90" y1="90" x2="90" y2="24" stroke={color} strokeWidth="2.5" strokeLinecap="round"
              initial={{ rotate: 0 }} animate={{ rotate: angle - 90 }} transition={{ type: "spring", stiffness: 60, damping: 15, delay: 0.3 }}
              style={{ transformOrigin: "90px 90px" }} />
            <circle cx="90" cy="90" r="4" fill={color} />
            <text x="15" y="98" fontSize="7" fill="#bbb" textAnchor="middle">LOW</text>
            <text x="90" y="12" fontSize="7" fill="#bbb" textAnchor="middle">FAIR</text>
            <text x="165" y="98" fontSize="7" fill="#bbb" textAnchor="middle">HIGH</text>
          </svg>
        </div>
        <div className="text-center sm:text-left flex-1">
          <motion.p className="text-3xl sm:text-4xl font-black tracking-tight" style={{ color }}
            initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5, duration: 0.4 }}>
            {verdictWord}
          </motion.p>
          <p className="text-sm text-gray-500 mt-1">{label}</p>
          <div className="flex items-center gap-4 mt-4">
            {[
              { label: "FAIR", value: fmt(fairPrice), c: "#059669" },
              { label: "ASKING", value: fmt(askingPrice), c: color },
              { label: "DIFF", value: `${askingVsFairPct > 0 ? "+" : ""}${Math.round(askingVsFairPct)}%`, c: color },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-[9px] uppercase tracking-wider text-gray-400">{s.label}</p>
                <p className="text-base font-bold" style={{ color: s.c }}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="text-[10px] text-gray-300 mt-4 text-center sm:text-left">Based on ZORI index, building quality signals, amenities, and seasonal factors</p>
    </div>
  );
}

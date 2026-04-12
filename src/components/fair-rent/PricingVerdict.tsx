"use client";

import { motion } from "framer-motion";

interface PricingVerdictProps {
  askingVsFairPct: number;
  fairPrice: number;
  askingPrice: number;
  redFlagCount: number;
}

export function PricingVerdict({ askingVsFairPct, fairPrice, askingPrice, redFlagCount }: PricingVerdictProps) {
  const isOverpriced = askingVsFairPct > 5;
  const isUnderpriced = askingVsFairPct < -5;

  // Clamp percentage for gauge display (-40% to +40%)
  const clampedPct = Math.max(-40, Math.min(40, askingVsFairPct));
  // Map to 0-180 degrees (90 = fair)
  const angle = 90 + (clampedPct / 40) * 90;

  const color = isOverpriced ? "#dc2626" : isUnderpriced ? "#059669" : "#6b7280";
  const bgGlow = isOverpriced ? "rgba(220,38,38,0.06)" : isUnderpriced ? "rgba(5,150,105,0.06)" : "rgba(107,114,128,0.04)";
  const label = isOverpriced
    ? `${redFlagCount > 0 ? `${redFlagCount} red flag${redFlagCount > 1 ? "s" : ""} · ` : ""}${Math.round(askingVsFairPct)}% overpriced`
    : isUnderpriced
      ? `${Math.abs(Math.round(askingVsFairPct))}% below fair value`
      : "Priced within fair range";

  const verdictWord = isOverpriced ? "Overpriced" : isUnderpriced ? "Good Deal" : "Fair";

  const fmt = (n: number) => "$" + Math.round(n).toLocaleString();

  return (
    <div className="bg-white border border-[#e8e6e1] rounded-2xl p-6 sm:p-8 overflow-hidden" style={{ background: `linear-gradient(135deg, white 60%, ${bgGlow})` }}>
      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* SVG Gauge */}
        <div className="flex-shrink-0 relative">
          <svg width="180" height="100" viewBox="0 0 180 100">
            {/* Background arc */}
            <path
              d="M 15 90 A 75 75 0 0 1 165 90"
              fill="none"
              stroke="#eee"
              strokeWidth="10"
              strokeLinecap="round"
            />
            {/* Green zone */}
            <path
              d="M 15 90 A 75 75 0 0 1 55 25"
              fill="none"
              stroke="#bbf7d0"
              strokeWidth="10"
              strokeLinecap="round"
            />
            {/* Yellow zone */}
            <path
              d="M 55 25 A 75 75 0 0 1 125 25"
              fill="none"
              stroke="#fef9c3"
              strokeWidth="10"
              strokeLinecap="round"
            />
            {/* Red zone */}
            <path
              d="M 125 25 A 75 75 0 0 1 165 90"
              fill="none"
              stroke="#fecaca"
              strokeWidth="10"
              strokeLinecap="round"
            />
            {/* Needle */}
            <motion.line
              x1="90"
              y1="90"
              x2="90"
              y2="22"
              stroke={color}
              strokeWidth="2.5"
              strokeLinecap="round"
              initial={{ rotate: 0 }}
              animate={{ rotate: angle - 90 }}
              transition={{ type: "spring", stiffness: 60, damping: 15, delay: 0.3 }}
              style={{ transformOrigin: "90px 90px" }}
            />
            {/* Center dot */}
            <circle cx="90" cy="90" r="5" fill={color} />
            {/* Labels */}
            <text x="15" y="98" fontSize="8" fill="#aaa" textAnchor="middle">Low</text>
            <text x="90" y="12" fontSize="8" fill="#aaa" textAnchor="middle">Fair</text>
            <text x="165" y="98" fontSize="8" fill="#aaa" textAnchor="middle">High</text>
          </svg>
        </div>

        {/* Text verdict */}
        <div className="text-center sm:text-left flex-1">
          <motion.p
            className="text-3xl sm:text-4xl font-black tracking-tight"
            style={{ color }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 0.4 }}
          >
            {verdictWord}
          </motion.p>
          <p className="text-sm text-gray-500 mt-1">{label}</p>
          <div className="flex items-center gap-4 mt-3">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Fair</p>
              <p className="text-lg font-bold text-[#059669]">{fmt(fairPrice)}</p>
            </div>
            <div className="w-px h-8 bg-gray-200" />
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Asking</p>
              <p className="text-lg font-bold" style={{ color }}>{fmt(askingPrice)}</p>
            </div>
            <div className="w-px h-8 bg-gray-200" />
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Diff</p>
              <p className="text-lg font-bold" style={{ color }}>
                {askingVsFairPct > 0 ? "+" : ""}{Math.round(askingVsFairPct)}%
              </p>
            </div>
          </div>
        </div>
      </div>
      <p className="text-[10px] text-gray-300 mt-4 text-center sm:text-left">
        Based on Zillow ZORI index, comparable listings, amenity adjustments, and seasonal factors
      </p>
    </div>
  );
}

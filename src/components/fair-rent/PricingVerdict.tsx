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

  const clampedPct = Math.max(-40, Math.min(40, askingVsFairPct));
  const angle = 90 + (clampedPct / 40) * 90;

  const color = isOverpriced ? "#ef4444" : isUnderpriced ? "#00D4FF" : "#6b7280";
  const label = isOverpriced
    ? `${redFlagCount > 0 ? `${redFlagCount} red flag${redFlagCount > 1 ? "s" : ""} · ` : ""}${Math.round(askingVsFairPct)}% overpriced`
    : isUnderpriced
      ? `${Math.abs(Math.round(askingVsFairPct))}% below fair value`
      : "Priced within fair range";

  const verdictWord = isOverpriced ? "Overpriced" : isUnderpriced ? "Good Deal" : "Fair";
  const fmt = (n: number) => "$" + Math.round(n).toLocaleString();

  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 sm:p-8 mb-1 backdrop-blur-sm">
      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* SVG Gauge */}
        <div className="flex-shrink-0">
          <svg width="180" height="100" viewBox="0 0 180 100">
            <path d="M 15 90 A 75 75 0 0 1 165 90" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" strokeLinecap="round" />
            <path d="M 15 90 A 75 75 0 0 1 55 25" fill="none" stroke="#00D4FF" strokeWidth="8" strokeLinecap="round" opacity="0.3" />
            <path d="M 55 25 A 75 75 0 0 1 125 25" fill="none" stroke="#fbbf24" strokeWidth="8" strokeLinecap="round" opacity="0.3" />
            <path d="M 125 25 A 75 75 0 0 1 165 90" fill="none" stroke="#ef4444" strokeWidth="8" strokeLinecap="round" opacity="0.3" />
            <motion.line
              x1="90" y1="90" x2="90" y2="24"
              stroke={color}
              strokeWidth="2"
              strokeLinecap="round"
              initial={{ rotate: 0 }}
              animate={{ rotate: angle - 90 }}
              transition={{ type: "spring", stiffness: 60, damping: 15, delay: 0.3 }}
              style={{ transformOrigin: "90px 90px" }}
              filter="url(#glow)"
            />
            <defs>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            <circle cx="90" cy="90" r="4" fill={color} />
            <text x="15" y="98" fontSize="7" fill="rgba(255,255,255,0.2)" fontFamily="monospace" textAnchor="middle">LOW</text>
            <text x="90" y="12" fontSize="7" fill="rgba(255,255,255,0.2)" fontFamily="monospace" textAnchor="middle">FAIR</text>
            <text x="165" y="98" fontSize="7" fill="rgba(255,255,255,0.2)" fontFamily="monospace" textAnchor="middle">HIGH</text>
          </svg>
        </div>

        <div className="text-center sm:text-left flex-1">
          <motion.p
            className="text-3xl sm:text-4xl font-black font-mono tracking-tight"
            style={{ color }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 0.4 }}
          >
            {verdictWord}
          </motion.p>
          <p className="text-xs font-mono text-white/40 mt-1">{label}</p>
          <div className="flex items-center gap-4 mt-4">
            {[
              { label: "FAIR", value: fmt(fairPrice), color: "#00D4FF" },
              { label: "ASKING", value: fmt(askingPrice), color },
              { label: "DIFF", value: `${askingVsFairPct > 0 ? "+" : ""}${Math.round(askingVsFairPct)}%`, color },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-[9px] font-mono uppercase tracking-wider text-white/20">{s.label}</p>
                <p className="text-base font-bold font-mono" style={{ color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="text-[9px] font-mono text-white/15 mt-4 text-center sm:text-left">
        Based on Zillow ZORI index, amenity adjustments, and seasonal factors
      </p>
    </div>
  );
}

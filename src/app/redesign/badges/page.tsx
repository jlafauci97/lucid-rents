"use client";
// 10 badge options v2
import { motion } from "framer-motion";

const grade = "C";
const score = 4.2;
const pct = score / 10;

const AMBER = "#D4A853";
const BG = "#07090F";
const SURFACE = "#0F1319";
const BORDER = "#252D3D";
const TEXT1 = "#E8E4DC";
const TEXT2 = "#8B8D95";
const TEXT3 = "#4E5261";
const SUBTLE = "#1E2533";

/* ============================================================ */

/* 1: Hexagonal Seal */
function Badge1() {
  return (
    <div className="flex flex-col items-center">
      <svg width="150" height="150" viewBox="0 0 160 160">
        <path d="M80 8 L148 44 L148 116 L80 152 L12 116 L12 44 Z" fill={AMBER} />
        <path d="M80 20 L138 50 L138 110 L80 140 L22 110 L22 50 Z" fill={BG} />
        <text x="80" y="78" textAnchor="middle" fill={AMBER} fontSize="52" fontWeight="900" fontFamily="var(--font-display)">{grade}</text>
        <text x="80" y="102" textAnchor="middle" fill={TEXT2} fontSize="14" fontFamily="var(--font-mono)">{score.toFixed(1)}/10</text>
      </svg>
      <span className="mt-2 text-[10px] uppercase tracking-[0.15em] font-medium" style={{ color: TEXT3 }}>Hexagonal Seal</span>
    </div>
  );
}

/* 2: Giant Editorial Letter */
function Badge2() {
  return (
    <div className="flex flex-col items-center" style={{ width: 150 }}>
      <span className="text-[110px] font-black leading-none" style={{ fontFamily: "var(--font-display)", color: AMBER, lineHeight: 0.85 }}>{grade}</span>
      <div className="w-full flex items-center gap-2 mt-1">
        <div className="flex-1 h-[3px] rounded-full" style={{ backgroundColor: BORDER }}>
          <motion.div className="h-full rounded-full" style={{ backgroundColor: AMBER, width: `${pct * 100}%` }} />
        </div>
      </div>
      <div className="flex items-center justify-between w-full mt-1.5">
        <span className="text-[9px] uppercase tracking-[0.15em] font-semibold" style={{ color: TEXT3 }}>Grade</span>
        <span className="text-sm font-bold tabular-nums" style={{ color: TEXT2, fontFamily: "var(--font-mono)" }}>{score.toFixed(1)}</span>
      </div>
      <span className="mt-3 text-[10px] uppercase tracking-[0.15em] font-medium" style={{ color: TEXT3 }}>Editorial Typography</span>
    </div>
  );
}

/* 3: Gauge / Speedometer */
function Badge3() {
  const r = 55;
  const cx = 75;
  const cy = 80;
  const totalArc = 240;
  const circumference = 2 * Math.PI * r;
  const arcLength = (totalArc / 360) * circumference;
  const filledLength = arcLength * pct;

  return (
    <div className="flex flex-col items-center">
      <svg width={150} height={110} viewBox="0 0 150 110">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={BORDER} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={`${arcLength} ${circumference - arcLength}`}
          strokeDashoffset={-((360 - totalArc) / 2 / 360) * circumference - circumference * 0.25} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={AMBER} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={`${filledLength} ${circumference - filledLength}`}
          strokeDashoffset={-((360 - totalArc) / 2 / 360) * circumference - circumference * 0.25} />
        <text x={cx} y={cy - 6} textAnchor="middle" fill={AMBER} fontSize="38" fontWeight="900" fontFamily="var(--font-display)">{grade}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fill={TEXT2} fontSize="12" fontFamily="var(--font-mono)">{score.toFixed(1)}/10</text>
      </svg>
      <span className="text-[10px] uppercase tracking-[0.15em] font-medium" style={{ color: TEXT3 }}>Gauge Meter</span>
    </div>
  );
}

/* 4: Score Card with Segments */
function Badge4() {
  return (
    <div className="flex flex-col items-center">
      <div className="relative overflow-hidden rounded-2xl" style={{ width: 130, height: 155, backgroundColor: SURFACE, border: `1px solid ${BORDER}` }}>
        <div className="h-2" style={{ backgroundColor: AMBER }} />
        <div className="flex flex-col items-center justify-center px-4 pt-4 pb-3">
          <span className="text-5xl font-black leading-none" style={{ fontFamily: "var(--font-display)", color: AMBER }}>{grade}</span>
          <div className="w-full grid grid-cols-10 gap-[2px] mt-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-2 rounded-sm" style={{ backgroundColor: i < Math.round(score) ? AMBER : BORDER }} />
            ))}
          </div>
          <span className="mt-2 text-xs tabular-nums" style={{ color: TEXT2, fontFamily: "var(--font-mono)" }}>{score.toFixed(1)}/10</span>
        </div>
        <div className="absolute bottom-0 inset-x-0 py-1.5 text-center" style={{ backgroundColor: `${AMBER}10` }}>
          <span className="text-[8px] uppercase tracking-[0.2em] font-bold" style={{ color: AMBER }}>Building Grade</span>
        </div>
      </div>
      <span className="mt-2 text-[10px] uppercase tracking-[0.15em] font-medium" style={{ color: TEXT3 }}>Score Card</span>
    </div>
  );
}

/* 5: Double Ring Knockout */
function Badge5() {
  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: 140, height: 140 }}>
        <div className="absolute inset-0 rounded-full" style={{ border: `3px solid ${AMBER}` }} />
        <div className="absolute rounded-full flex flex-col items-center justify-center" style={{ inset: 10, backgroundColor: AMBER }}>
          <span className="text-5xl font-black leading-none" style={{ fontFamily: "var(--font-display)", color: BG }}>{grade}</span>
          <span className="text-[11px] font-bold tabular-nums -mt-0.5" style={{ fontFamily: "var(--font-mono)", color: `${BG}AA` }}>{score.toFixed(1)}/10</span>
        </div>
        <svg className="absolute inset-0" viewBox="0 0 140 140">
          <motion.circle cx="70" cy="70" r="67" fill="none" stroke={`${AMBER}30`} strokeWidth="1" strokeDasharray="3 6"
            animate={{ rotate: 360 }} transition={{ duration: 30, repeat: Infinity, ease: "linear" }} style={{ transformOrigin: "70px 70px" }} />
        </svg>
      </div>
      <span className="mt-2 text-[10px] uppercase tracking-[0.15em] font-medium" style={{ color: TEXT3 }}>Double Ring</span>
    </div>
  );
}

/* 6: Shield / Crest */
function Badge6() {
  return (
    <div className="flex flex-col items-center">
      <svg width="120" height="150" viewBox="0 0 120 150">
        <path d="M60 5 L110 25 L110 80 C110 115 60 145 60 145 C60 145 10 115 10 80 L10 25 Z" fill={AMBER} />
        <path d="M60 15 L100 32 L100 78 C100 108 60 133 60 133 C60 133 20 108 20 78 L20 32 Z" fill={BG} />
        <text x="60" y="72" textAnchor="middle" fill={AMBER} fontSize="44" fontWeight="900" fontFamily="var(--font-display)">{grade}</text>
        <text x="60" y="95" textAnchor="middle" fill={TEXT2} fontSize="12" fontFamily="var(--font-mono)">{score.toFixed(1)}/10</text>
      </svg>
      <span className="mt-1 text-[10px] uppercase tracking-[0.15em] font-medium" style={{ color: TEXT3 }}>Shield Crest</span>
    </div>
  );
}

/* 7: Diamond / Rotated Square */
function Badge7() {
  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: 130, height: 130 }}>
        <div className="absolute inset-3" style={{ transform: "rotate(45deg)", border: `3px solid ${AMBER}`, borderRadius: 12 }} />
        <div className="absolute inset-[18px]" style={{ transform: "rotate(45deg)", backgroundColor: `${AMBER}10`, borderRadius: 8 }} />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-5xl font-black leading-none" style={{ fontFamily: "var(--font-display)", color: AMBER }}>{grade}</span>
          <span className="text-xs tabular-nums mt-0.5" style={{ color: TEXT2, fontFamily: "var(--font-mono)" }}>{score.toFixed(1)}/10</span>
        </div>
      </div>
      <span className="mt-1 text-[10px] uppercase tracking-[0.15em] font-medium" style={{ color: TEXT3 }}>Diamond</span>
    </div>
  );
}

/* 8: Pill / Capsule */
function Badge8() {
  return (
    <div className="flex flex-col items-center">
      <div className="flex items-stretch rounded-full overflow-hidden" style={{ border: `2px solid ${BORDER}`, height: 80 }}>
        <div className="flex items-center justify-center px-5" style={{ backgroundColor: AMBER }}>
          <span className="text-4xl font-black leading-none" style={{ fontFamily: "var(--font-display)", color: BG }}>{grade}</span>
        </div>
        <div className="flex flex-col items-center justify-center px-5" style={{ backgroundColor: SURFACE }}>
          <span className="text-2xl font-bold tabular-nums" style={{ color: TEXT1, fontFamily: "var(--font-mono)" }}>{score.toFixed(1)}</span>
          <span className="text-[9px] uppercase tracking-wider -mt-0.5" style={{ color: TEXT3 }}>out of 10</span>
        </div>
      </div>
      <span className="mt-3 text-[10px] uppercase tracking-[0.15em] font-medium" style={{ color: TEXT3 }}>Pill Capsule</span>
    </div>
  );
}

/* 9: Stacked Vertical Bar */
function Badge9() {
  const filled = Math.round(score);
  return (
    <div className="flex flex-col items-center">
      <div className="flex items-end gap-1" style={{ height: 120 }}>
        {Array.from({ length: 10 }).map((_, i) => {
          const isActive = i < filled;
          const h = 20 + (i * 10);
          return (
            <div key={i} className="w-3 rounded-t transition-all" style={{
              height: h,
              backgroundColor: isActive ? AMBER : SUBTLE,
              opacity: isActive ? 1 : 0.4,
            }} />
          );
        })}
      </div>
      <div className="flex items-baseline gap-2 mt-2">
        <span className="text-3xl font-black" style={{ fontFamily: "var(--font-display)", color: AMBER }}>{grade}</span>
        <span className="text-sm tabular-nums" style={{ color: TEXT2, fontFamily: "var(--font-mono)" }}>{score.toFixed(1)}/10</span>
      </div>
      <span className="mt-1 text-[10px] uppercase tracking-[0.15em] font-medium" style={{ color: TEXT3 }}>Equalizer Bars</span>
    </div>
  );
}

/* 10: Stamp / Seal with Border Text */
function Badge10() {
  const r = 62;
  const textR = 55;
  const chars = "BUILDING GRADE · LUCID RENTS · ".split("");
  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: 140, height: 140 }}>
        <svg viewBox="0 0 140 140" className="w-full h-full">
          <circle cx="70" cy="70" r={r} fill="none" stroke={AMBER} strokeWidth="2" />
          <circle cx="70" cy="70" r={r - 6} fill="none" stroke={AMBER} strokeWidth="0.5" />
          {/* Rotating text around the circle */}
          {chars.map((char, i) => {
            const angle = (i / chars.length) * 360 - 90;
            const rad = (angle * Math.PI) / 180;
            const x = 70 + textR * Math.cos(rad);
            const y = 70 + textR * Math.sin(rad);
            return (
              <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="central"
                fill={`${AMBER}80`} fontSize="7" fontWeight="700" fontFamily="var(--font-body)"
                transform={`rotate(${angle + 90} ${x} ${y})`}
                style={{ letterSpacing: "0.1em", textTransform: "uppercase" }}
              >{char}</text>
            );
          })}
          <text x="70" y="65" textAnchor="middle" fill={AMBER} fontSize="48" fontWeight="900" fontFamily="var(--font-display)">{grade}</text>
          <text x="70" y="88" textAnchor="middle" fill={TEXT2} fontSize="13" fontFamily="var(--font-mono)">{score.toFixed(1)}/10</text>
        </svg>
      </div>
      <span className="mt-1 text-[10px] uppercase tracking-[0.15em] font-medium" style={{ color: TEXT3 }}>Stamp Seal</span>
    </div>
  );
}

/* ============================================================ */

const badges = [
  { label: "1", Component: Badge1 },
  { label: "2", Component: Badge2 },
  { label: "3", Component: Badge3 },
  { label: "4", Component: Badge4 },
  { label: "5", Component: Badge5 },
  { label: "6", Component: Badge6 },
  { label: "7", Component: Badge7 },
  { label: "8", Component: Badge8 },
  { label: "9", Component: Badge9 },
  { label: "10", Component: Badge10 },
];

export default function BadgeComparison() {
  return (
    <div className="min-h-screen py-12 px-6" style={{ backgroundColor: BG, fontFamily: "var(--font-body)" }}>
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl italic mb-1" style={{ fontFamily: "var(--font-display)", color: TEXT1 }}>
          Grade Badge Options
        </h1>
        <p className="text-sm mb-10" style={{ color: TEXT3 }}>
          10 concepts — pick one or mix elements.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6">
          {badges.map(({ label, Component }) => (
            <div key={label} className="flex flex-col items-center p-5 rounded-2xl border" style={{ borderColor: BORDER, backgroundColor: `${SURFACE}80` }}>
              <span className="text-[10px] font-bold uppercase tracking-wider mb-5" style={{ color: AMBER }}>Option {label}</span>
              <Component />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

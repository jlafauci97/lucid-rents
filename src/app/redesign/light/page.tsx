"use client";
// v2 - bold grade badge
import { motion, useInView } from "framer-motion";
import { useRef, useState } from "react";
import {
  MapPin, Building2, Calendar, Layers, Users, ShieldCheck,
  AlertTriangle, MessageSquareWarning, TrendingDown, TrendingUp,
  Heart, Share2, BarChart3, Zap, ArrowUpRight, ArrowDownRight,
  ChevronDown, ChevronRight, DollarSign, Wrench, Volume2,
  Shield, Eye, Bookmark, GitCompare, Bell, Star, ThumbsUp,
  ThumbsDown, Minus, Clock, Home, Train, TreePine, GraduationCap,
  ChevronUp, ExternalLink, Flame, HelpCircle,
} from "lucide-react";

/* ============================================================
   DESIGN TOKENS — "Bright Social" palette
   ============================================================ */

const T = {
  bg:         "#FAFBFD",
  surface:    "#FFFFFF",
  elevated:   "#F5F7FA",
  subtle:     "#EDF0F5",
  border:     "#E2E8F0",
  text1:      "#1A1F36",
  text2:      "#5E6687",
  text3:      "#A3ACBE",
  accent:     "#6366F1",
  pink:       "#EC4899",
  sage:       "#10B981",
  coral:      "#F97316",
  danger:     "#EF4444",
  blue:       "#3B82F6",
  gold:       "#F59E0B",
  gradeA:     "#10B981",
  gradeB:     "#3B82F6",
  gradeC:     "#F59E0B",
  gradeD:     "#F97316",
  gradeF:     "#EF4444",
};

function gradeColor(grade: string) {
  const g = grade.charAt(0).toUpperCase();
  if (g === "A") return T.gradeA;
  if (g === "B") return T.gradeB;
  if (g === "C") return T.gradeC;
  if (g === "D") return T.gradeD;
  return T.gradeF;
}

/* ============================================================
   SAMPLE DATA — 71 Broadway, Manhattan
   ============================================================ */

const building = {
  address: "71 Broadway",
  neighborhood: "Financial District",
  city: "Manhattan",
  state: "NY",
  zip: "10006",
  yearBuilt: 1898,
  floors: 23,
  totalUnits: 245,
  residentialUnits: 237,
  owner: "EQR-71 Broadway A, L.L.C.",
  management: "Equity Residential",
  overallScore: 2.1,
  reviewCount: 20,
  violations: 38,
  complaints: 117,
  litigations: 0,
  dobViolations: 5,
  bedbugs: 0,
  evictions: 0,
  permits: 18,
  sidewalkSheds: 2,
  energyStar: 75,
  isStabilized: true,
  stabilizedUnits: 12,
  buildingClass: "D5",
};

const rents = {
  studio: { min: 4190, max: 4345, median: 4224 },
  oneBr:  { min: 4725, max: 5396, median: 5030 },
  twoBr:  { min: 5858, max: 7196, median: 6542 },
};

const grades = {
  overall: { grade: "C", score: 2.1, label: "Overall" },
  management: { grade: "B-", score: 3.05, label: "Management" },
  maintenance: { grade: "C+", score: 2.7, label: "Maintenance" },
  value: { grade: "D+", score: 1.9, label: "Value" },
  safety: { grade: "B", score: 3.4, label: "Safety" },
  noise: { grade: "C", score: 2.5, label: "Noise" },
  responsiveness: { grade: "B-", score: 2.95, label: "Responsiveness" },
};

// 12-month rent trend data (approximated)
const rentTrend = [5100, 4980, 5050, 5200, 5350, 5300, 5280, 5150, 5030, 5100, 5193, 5030];
// 12-month violation trend
const violationTrend = [5, 4, 3, 6, 2, 4, 3, 2, 3, 1, 2, 3];
// 12-month complaint trend
const complaintTrend = [12, 15, 10, 8, 11, 14, 9, 7, 10, 8, 6, 11];

const amenityPremiums = [
  { amenity: "doorman", premium_dollars: 312 },
  { amenity: "elevator", premium_dollars: 185 },
  { amenity: "gym", premium_dollars: 89 },
  { amenity: "roof_deck", premium_dollars: 67 },
  { amenity: "laundry_in_building", premium_dollars: 45 },
];

const valueBreakdown = {
  neighborhoodMedian: 4850,
  buildingMedian: 5030,
  violationDiscount: -42,
  estimatedFairRent: 5506,
  difference: -476,
  valueGrade: "D+",
};

const sampleReviews = [
  {
    id: 1,
    author: "Kenneth Z.",
    rating: 4,
    date: "Mar 2026",
    title: "Good Value Rental Building in FiDi",
    pros: "Great location near subway, responsive maintenance team, clean common areas, nice roof deck.",
    cons: "Thin walls between units, elevators can be slow during rush hours, small closet space.",
    recommend: true,
  },
  {
    id: 2,
    author: "Elizabeth F.",
    rating: 3,
    date: "Feb 2026",
    title: "Avg apartment quality and limited amenities. Good location",
    pros: "Perfect location for commuting, doorman is friendly, building feels safe.",
    cons: "Appliances are dated, no in-unit laundry, gym is tiny and always crowded, rent is high for what you get.",
    recommend: false,
  },
  {
    id: 3,
    author: "Anthony T.",
    rating: 5,
    date: "Oct 2025",
    title: "71 Broadway team is awesome",
    pros: "Best management I've had in NYC. Maintenance requests handled same day. Great community events.",
    cons: "Wish there was a package room instead of just the doorman holding them.",
    recommend: true,
  },
];

/* ============================================================
   MICRO-COMPONENTS
   ============================================================ */

function Sparkline({
  data,
  color = T.accent,
  width = 120,
  height = 32,
}: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pad = 3;

  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = pad + (1 - (v - min) / range) * (height - pad * 2);
    return [x, y] as [number, number];
  });

  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  const gradId = `spark-${color.replace("#", "")}`;
  const last = pts[pts.length - 1];

  return (
    <svg width={width} height={height} className="overflow-visible shrink-0">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="2.5" fill={color} />
    </svg>
  );
}

function GradeBar({
  label,
  grade,
  score,
  maxScore = 5,
  delay = 0,
}: {
  label: string;
  grade: string;
  score: number;
  maxScore?: number;
  delay?: number;
}) {
  const pct = (score / maxScore) * 100;
  const color = gradeColor(grade);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <div ref={ref} className="flex items-center gap-3 sm:gap-4 group">
      <span
        className="w-[110px] sm:w-[130px] text-sm tracking-wide shrink-0"
        style={{ color: T.text2, fontFamily: "var(--font-body)" }}
      >
        {label}
      </span>
      <span
        className="w-8 text-sm font-bold shrink-0"
        style={{ color, fontFamily: "var(--font-mono)" }}
      >
        {grade}
      </span>
      <div className="flex-1 h-[6px] rounded-full overflow-hidden" style={{ backgroundColor: T.subtle }}>
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={inView ? { width: `${pct}%` } : { width: 0 }}
          transition={{ duration: 0.8, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
        />
      </div>
      <span
        className="w-10 text-right text-xs tabular-nums shrink-0"
        style={{ color: T.text3, fontFamily: "var(--font-mono)" }}
      >
        {score.toFixed(1)}
      </span>
    </div>
  );
}

function TrendBadge({ value, suffix = "%" }: { value: number; suffix?: string }) {
  const isUp = value > 0;
  const isDown = value < 0;
  const color = isDown ? T.sage : isUp ? T.coral : T.text2;
  const Icon = isDown ? ArrowDownRight : isUp ? ArrowUpRight : Minus;

  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ color, backgroundColor: `${color}12` }}
    >
      <Icon className="w-3 h-3" />
      {Math.abs(value).toFixed(1)}{suffix}
    </span>
  );
}

function SectionTitle({ children, subtitle }: { children: React.ReactNode; subtitle?: string }) {
  return (
    <div className="mb-8">
      <h2
        className="text-2xl sm:text-3xl italic tracking-tight"
        style={{ fontFamily: "var(--font-display)", color: T.text1 }}
      >
        {children}
      </h2>
      {subtitle && (
        <p className="mt-1.5 text-sm" style={{ color: T.text3, fontFamily: "var(--font-body)" }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

function FadeIn({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
      transition={{ duration: 0.6, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ============================================================
   HERO SECTION
   ============================================================ */

function HeroSection() {
  const grade = "C";
  const score = 4.2;

  return (
    <section
      className="relative"
      style={{ backgroundColor: T.surface }}
    >
      {/* Clean bottom border */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[1px]"
        style={{ backgroundColor: T.border }}
      />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="flex flex-col lg:flex-row lg:items-start gap-8 lg:gap-12">
          {/* Left: Address & Info */}
          <div className="flex-1 min-w-0">
            {/* Management badge */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              <span
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] px-3 py-1 rounded-full border"
                style={{ color: T.accent, borderColor: `${T.accent}30`, backgroundColor: `${T.accent}08` }}
              >
                <Building2 className="w-3 h-3" />
                Managed by Equity Residential
              </span>
            </motion.div>

            {/* Address */}
            <motion.h1
              className="mt-4 text-4xl sm:text-5xl lg:text-[3.5rem] leading-[1.05] tracking-tight"
              style={{ fontFamily: "var(--font-display)", color: T.text1 }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              71 Broadway
            </motion.h1>

            <motion.p
              className="mt-2 text-base sm:text-lg"
              style={{ color: T.text2, fontFamily: "var(--font-body)" }}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              Financial District, Manhattan, NY 10006
            </motion.p>

            {/* Quick stats row */}
            <motion.div
              className="flex flex-wrap gap-x-5 gap-y-2 mt-5"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              {[
                { icon: Calendar, text: "Built 1898" },
                { icon: Layers, text: "23 floors" },
                { icon: Home, text: "245 units" },
                { icon: ShieldCheck, text: "Rent Stabilized", accent: true },
              ].map(({ icon: Icon, text, accent }) => (
                <span
                  key={text}
                  className="inline-flex items-center gap-1.5 text-sm"
                  style={{ color: accent ? T.sage : T.text2 }}
                >
                  <Icon className="w-3.5 h-3.5" style={{ opacity: 0.7 }} />
                  {text}
                </span>
              ))}
            </motion.div>

            {/* Vital signs -- key metrics with sparklines */}
            <motion.div
              className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              {[
                {
                  label: "Median Rent",
                  value: "$5,030",
                  sub: "1BR · 8% below area",
                  color: T.sage,
                  trend: rentTrend,
                  tint: "#10B98108",
                },
                {
                  label: "Violations",
                  value: "38",
                  sub: "0.16 per unit",
                  color: T.coral,
                  trend: violationTrend,
                  tint: "#F9731608",
                },
                {
                  label: "Complaints",
                  value: "117",
                  sub: "0.49 per unit",
                  color: T.gold,
                  trend: complaintTrend,
                  tint: "#F59E0B08",
                },
                {
                  label: "Reviews",
                  value: "20",
                  sub: "75% recommend",
                  color: T.blue,
                  trend: [12, 14, 13, 15, 16, 15, 17, 18, 17, 19, 20, 20],
                  tint: "#3B82F608",
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl p-3.5 border shadow-sm"
                  style={{
                    backgroundColor: T.surface,
                    borderColor: T.border,
                  }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] uppercase tracking-wider font-medium" style={{ color: T.text3 }}>
                      {stat.label}
                    </span>
                  </div>
                  <div className="flex items-end justify-between gap-2">
                    <div>
                      <span
                        className="text-xl font-bold tabular-nums"
                        style={{ color: stat.color, fontFamily: "var(--font-mono)" }}
                      >
                        {stat.value}
                      </span>
                      <p className="text-[10px] mt-0.5" style={{ color: T.text3 }}>
                        {stat.sub}
                      </p>
                    </div>
                    <Sparkline data={stat.trend} color={stat.color} width={64} height={24} />
                  </div>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right: Score Ring */}
          <motion.div
            className="shrink-0 flex flex-col items-center lg:pt-4"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2, type: "spring", stiffness: 100 }}
          >
            <div className="relative" style={{ width: 140, height: 140 }}>
              <div className="absolute inset-0 rounded-full" style={{ border: `3px solid ${gradeColor(grade)}` }} />
              <div className="absolute rounded-full flex flex-col items-center justify-center" style={{ inset: 10, backgroundColor: gradeColor(grade) }}>
                <span className="text-5xl font-black leading-none" style={{ fontFamily: "var(--font-display)", color: "#fff" }}>{grade}</span>
                <span className="text-[11px] font-bold tabular-nums -mt-0.5" style={{ fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.7)" }}>{score.toFixed(1)}/5</span>
              </div>
              <svg className="absolute inset-0" viewBox="0 0 140 140">
                <motion.circle cx="70" cy="70" r="67" fill="none" stroke={`${gradeColor(grade)}30`} strokeWidth="1" strokeDasharray="3 6"
                  animate={{ rotate: 360 }} transition={{ duration: 30, repeat: Infinity, ease: "linear" }} style={{ transformOrigin: "70px 70px" }} />
              </svg>
            </div>
            <span className="mt-3 text-[11px] uppercase tracking-[0.15em] font-medium" style={{ color: T.text3 }}>
              Building Grade
            </span>

            {/* Action buttons */}
            <div className="flex items-center gap-2 mt-6">
              {[
                { icon: Bookmark, label: "Save" },
                { icon: GitCompare, label: "Compare" },
                { icon: Share2, label: "Share" },
                { icon: Bell, label: "Monitor" },
              ].map(({ icon: Icon, label }) => (
                <button
                  key={label}
                  className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg border transition-all duration-200 hover:shadow-md hover:border-indigo-200"
                  style={{
                    borderColor: T.border,
                    backgroundColor: T.surface,
                    color: T.text2,
                  }}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-[10px]" style={{ fontFamily: "var(--font-body)" }}>{label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   STICKY NAV
   ============================================================ */

function StickyNav() {
  const [active, setActive] = useState("verdict");
  const sections = [
    { id: "verdict", label: "Verdict", icon: Star },
    { id: "report-card", label: "Report Card", icon: BarChart3 },
    { id: "rent-intel", label: "Rent Intel", icon: DollarSign },
    { id: "pulse", label: "Building Pulse", icon: TrendingUp },
    { id: "reviews", label: "Reviews", icon: MessageSquareWarning },
    { id: "transit", label: "Transit", icon: Train },
    { id: "schools", label: "Schools", icon: GraduationCap },
    { id: "parks", label: "Parks", icon: TreePine },
    { id: "crime", label: "Crime", icon: Shield },
    { id: "faq", label: "FAQ", icon: HelpCircle },
  ];

  return (
    <nav
      className="sticky top-0 z-40 border-b backdrop-blur-xl shadow-sm"
      style={{
        backgroundColor: `${T.surface}E6`,
        borderColor: T.border,
      }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          className="flex overflow-x-auto gap-1 py-1 -mb-px"
          style={{ scrollbarWidth: "none" }}
        >
          {sections.map((s) => {
            const Icon = s.icon;
            const isActive = active === s.id;
            return (
              <button
                key={s.id}
                onClick={() => {
                  setActive(s.id);
                  document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className="shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150"
                style={{
                  fontFamily: "var(--font-body)",
                  color: isActive ? T.accent : T.text3,
                  backgroundColor: isActive ? `${T.accent}0A` : "transparent",
                }}
              >
                <Icon className="w-3.5 h-3.5" style={{ opacity: isActive ? 1 : 0.5 }} />
                <span className="whitespace-nowrap">{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

/* ============================================================
   VERDICT BANNER
   ============================================================ */

function VerdictBanner() {
  const recommendPct = 75; // 15 of 20 reviewers recommend

  return (
    <FadeIn>
      <section id="verdict" className="scroll-mt-16">
        <div
          className="rounded-2xl border overflow-hidden shadow-sm"
          style={{
            backgroundColor: T.surface,
            borderColor: T.border,
            background: `linear-gradient(135deg, ${T.surface} 0%, #FAFAFE 50%, #F8F7FF 100%)`,
          }}
        >
          <div className="p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center gap-6 sm:gap-10">
              {/* Recommendation stat */}
              <div className="shrink-0 text-center sm:text-left">
                <div className="flex items-baseline gap-1 justify-center sm:justify-start">
                  <span
                    className="text-5xl sm:text-6xl font-bold tabular-nums"
                    style={{ color: T.sage, fontFamily: "var(--font-mono)" }}
                  >
                    {recommendPct}
                  </span>
                  <span className="text-2xl font-bold" style={{ color: T.sage }}>%</span>
                </div>
                <p className="text-sm mt-1" style={{ color: T.text2 }}>
                  of tenants recommend
                </p>
                <p className="text-xs mt-0.5" style={{ color: T.text3 }}>
                  Based on {building.reviewCount} verified reviews
                </p>
              </div>

              {/* Divider */}
              <div className="hidden sm:block w-px h-24" style={{ backgroundColor: T.border }} />

              {/* Pro & Con excerpts */}
              <div className="flex-1 grid sm:grid-cols-2 gap-4">
                {/* Best positive */}
                <div
                  className="rounded-xl p-4 border-l-[3px]"
                  style={{
                    backgroundColor: `${T.sage}06`,
                    borderLeftColor: T.sage,
                    borderTop: `1px solid ${T.sage}15`,
                    borderRight: `1px solid ${T.sage}15`,
                    borderBottom: `1px solid ${T.sage}15`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <ThumbsUp className="w-3.5 h-3.5" style={{ color: T.sage }} />
                    <span className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: T.sage }}>
                      Most Helpful Positive
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed italic" style={{ color: T.text1, fontFamily: "var(--font-display)" }}>
                    &ldquo;Best management I&apos;ve had in NYC. Maintenance requests handled same day.&rdquo;
                  </p>
                  <p className="text-xs mt-2" style={{ color: T.text3 }}>— Anthony T., Oct 2025</p>
                </div>

                {/* Most critical */}
                <div
                  className="rounded-xl p-4 border-l-[3px]"
                  style={{
                    backgroundColor: `${T.pink}04`,
                    borderLeftColor: T.pink,
                    borderTop: `1px solid ${T.pink}15`,
                    borderRight: `1px solid ${T.pink}15`,
                    borderBottom: `1px solid ${T.pink}15`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <ThumbsDown className="w-3.5 h-3.5" style={{ color: T.pink }} />
                    <span className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: T.pink }}>
                      Most Helpful Critical
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed italic" style={{ color: T.text1, fontFamily: "var(--font-display)" }}>
                    &ldquo;Appliances are dated, no in-unit laundry, gym is tiny and always crowded.&rdquo;
                  </p>
                  <p className="text-xs mt-2" style={{ color: T.text3 }}>— Elizabeth F., Feb 2026</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </FadeIn>
  );
}

/* ============================================================
   REPORT CARD
   ============================================================ */

function ReportCard() {
  return (
    <FadeIn>
      <section id="report-card" className="scroll-mt-16">
        <SectionTitle subtitle="Composite scores based on tenant reviews, public records, and complaint data">
          Building Report Card
        </SectionTitle>

        <div
          className="rounded-2xl border p-6 sm:p-8 shadow-sm"
          style={{ backgroundColor: T.surface, borderColor: T.border }}
        >
          {/* Overall grade hero */}
          <div className="flex items-center gap-6 mb-8 pb-8" style={{ borderBottom: `1px solid ${T.border}` }}>
            <div
              className="w-20 h-20 rounded-2xl flex flex-col items-center justify-center shadow-sm"
              style={{ backgroundColor: `${gradeColor(grades.overall.grade)}10` }}
            >
              <span
                className="text-3xl font-bold"
                style={{ color: gradeColor(grades.overall.grade), fontFamily: "var(--font-display)" }}
              >
                {grades.overall.grade}
              </span>
              <span
                className="text-[10px] -mt-0.5 tabular-nums"
                style={{ color: T.text3, fontFamily: "var(--font-mono)" }}
              >
                {grades.overall.score.toFixed(1)}/5
              </span>
            </div>
            <div>
              <h3 className="text-lg font-semibold" style={{ color: T.text1, fontFamily: "var(--font-body)" }}>
                Overall Grade: C
              </h3>
              <p className="text-sm mt-0.5" style={{ color: T.text2 }}>
                Decent building with good management but overpriced for what you get.
                Low violation density for the area.
              </p>
            </div>
          </div>

          {/* Grade bars */}
          <div className="space-y-4">
            {Object.entries(grades)
              .filter(([k]) => k !== "overall")
              .map(([key, { grade, score, label }], i) => (
                <GradeBar key={key} label={label} grade={grade} score={score} delay={i * 0.08} />
              ))}
          </div>
        </div>
      </section>
    </FadeIn>
  );
}

/* ============================================================
   RENT INTELLIGENCE DASHBOARD
   ============================================================ */

function RentDashboard() {
  const neighborhoodMedian1BR = 5450;
  const buildingMedian1BR = 5030;
  const savings = neighborhoodMedian1BR - buildingMedian1BR;
  const savingsPct = ((savings / neighborhoodMedian1BR) * 100).toFixed(1);

  return (
    <FadeIn>
      <section id="rent-intel" className="scroll-mt-16">
        <SectionTitle subtitle="Real-time pricing intelligence from Dewey, StreetEasy & Zillow">
          Rent Intelligence
        </SectionTitle>

        {/* Metric cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {/* Median Rent */}
          <div className="rounded-2xl border p-5 shadow-sm" style={{ backgroundColor: T.surface, borderColor: T.border }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] uppercase tracking-wider font-medium" style={{ color: T.text3 }}>
                Median 1BR
              </span>
              <TrendBadge value={-2.3} />
            </div>
            <div className="flex items-end justify-between">
              <span
                className="text-3xl font-bold tabular-nums"
                style={{ color: T.text1, fontFamily: "var(--font-mono)" }}
              >
                $5,030
              </span>
              <Sparkline data={rentTrend} color={T.sage} width={80} height={28} />
            </div>
            <p className="text-xs mt-2" style={{ color: T.text3 }}>
              <span style={{ color: T.sage }}>&#8595; {savingsPct}% below</span> area median
            </p>
          </div>

          {/* Price per sqft */}
          <div className="rounded-2xl border p-5 shadow-sm" style={{ backgroundColor: T.surface, borderColor: T.border }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] uppercase tracking-wider font-medium" style={{ color: T.text3 }}>
                Price / Sqft
              </span>
              <TrendBadge value={3.8} />
            </div>
            <div className="flex items-end justify-between">
              <span
                className="text-3xl font-bold tabular-nums"
                style={{ color: T.text1, fontFamily: "var(--font-mono)" }}
              >
                $7.28
              </span>
              <Sparkline data={[6.9, 7.1, 7.0, 7.2, 7.3, 7.4, 7.2, 7.1, 7.0, 7.2, 7.5, 7.3]} color={T.gold} width={80} height={28} />
            </div>
            <p className="text-xs mt-2" style={{ color: T.text3 }}>
              1BR avg · 691 sqft
            </p>
          </div>

          {/* Value Grade */}
          <div className="rounded-2xl border p-5 shadow-sm" style={{ backgroundColor: T.surface, borderColor: T.border }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] uppercase tracking-wider font-medium" style={{ color: T.text3 }}>
                Value Assessment
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${gradeColor("D+")}10` }}
              >
                <span
                  className="text-2xl font-bold"
                  style={{ color: gradeColor("D+"), fontFamily: "var(--font-display)" }}
                >
                  D+
                </span>
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: T.text1 }}>Below Average Value</p>
                <p className="text-xs mt-0.5" style={{ color: T.text3 }}>
                  High rents relative to building condition and amenity package
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Neighborhood Comparison Bar */}
        <div className="rounded-2xl border p-5 sm:p-6 shadow-sm" style={{ backgroundColor: T.surface, borderColor: T.border }}>
          <h4 className="text-sm font-semibold mb-5" style={{ color: T.text1, fontFamily: "var(--font-body)" }}>
            How 71 Broadway compares to ZIP 10006
          </h4>

          <div className="space-y-5">
            {[
              { label: "Studio", building: rents.studio.median, area: 4500 },
              { label: "1 Bedroom", building: rents.oneBr.median, area: neighborhoodMedian1BR },
              { label: "2 Bedroom", building: rents.twoBr.median, area: 7200 },
            ].map((row) => {
              const maxVal = Math.max(row.building, row.area) * 1.1;
              const bPct = (row.building / maxVal) * 100;
              const aPct = (row.area / maxVal) * 100;
              const diff = row.building - row.area;
              const isBelow = diff < 0;

              return (
                <div key={row.label}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm" style={{ color: T.text2 }}>{row.label}</span>
                    <span
                      className="text-xs font-semibold"
                      style={{ color: isBelow ? T.sage : T.coral }}
                    >
                      {isBelow ? "Save" : "Pay"} ${Math.abs(diff).toLocaleString()}/mo vs area
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] w-20 text-right shrink-0" style={{ color: T.text3 }}>
                        This building
                      </span>
                      <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ backgroundColor: T.subtle }}>
                        <motion.div
                          className="h-full rounded-full"
                          style={{ backgroundColor: T.accent }}
                          initial={{ width: 0 }}
                          whileInView={{ width: `${bPct}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                        />
                      </div>
                      <span
                        className="text-xs tabular-nums font-semibold w-16 shrink-0"
                        style={{ color: T.text1, fontFamily: "var(--font-mono)" }}
                      >
                        ${row.building.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] w-20 text-right shrink-0" style={{ color: T.text3 }}>
                        Area median
                      </span>
                      <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ backgroundColor: T.subtle }}>
                        <motion.div
                          className="h-full rounded-full"
                          style={{ backgroundColor: T.text3 }}
                          initial={{ width: 0 }}
                          whileInView={{ width: `${aPct}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.8, delay: 0.15, ease: "easeOut" }}
                        />
                      </div>
                      <span
                        className="text-xs tabular-nums w-16 shrink-0"
                        style={{ color: T.text3, fontFamily: "var(--font-mono)" }}
                      >
                        ${row.area.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div
            className="mt-6 pt-4 flex items-center gap-2"
            style={{ borderTop: `1px solid ${T.border}` }}
          >
            <Zap className="w-4 h-4" style={{ color: T.sage }} />
            <p className="text-sm" style={{ color: T.text2 }}>
              <span style={{ color: T.sage }} className="font-semibold">You save ~${savings}/mo</span>{" "}
              on a 1BR vs the FiDi average — but value grade factors in building condition.
            </p>
          </div>
        </div>
      </section>
    </FadeIn>
  );
}

/* ============================================================
   AMENITY PREMIUMS / VALUE BREAKDOWN
   ============================================================ */

function AmenityPremiums() {
  const formatDollars = (n: number) => `$${Math.abs(n).toLocaleString()}`;
  const formatLabel = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  const totalPremiums = amenityPremiums.reduce((s, a) => s + a.premium_dollars, 0);
  const estimatedFair = valueBreakdown.neighborhoodMedian + totalPremiums + valueBreakdown.violationDiscount;
  const diff = valueBreakdown.buildingMedian - estimatedFair;
  const isGoodValue = diff <= 0;

  return (
    <div>
      <section className="scroll-mt-16">
        <SectionTitle subtitle="How amenities, location, and building condition affect your rent">
          What You're Paying For
        </SectionTitle>

        <div className="rounded-2xl border p-5 sm:p-6" style={{ backgroundColor: T.surface, borderColor: T.border }}>
          {/* Receipt-style breakdown */}
          <div className="space-y-3">
            {/* Base rate */}
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: T.text2 }}>Neighborhood base (1BR)</span>
              <span className="text-sm font-semibold tabular-nums" style={{ color: T.text1, fontFamily: "var(--font-mono)" }}>
                {formatDollars(valueBreakdown.neighborhoodMedian)}
              </span>
            </div>

            {/* Each amenity premium */}
            {amenityPremiums.map(a => (
              <div key={a.amenity} className="flex items-center justify-between">
                <span className="text-sm" style={{ color: T.text2 }}>+ {formatLabel(a.amenity)}</span>
                <span className="text-sm font-semibold tabular-nums" style={{ color: T.sage, fontFamily: "var(--font-mono)" }}>
                  +{formatDollars(a.premium_dollars)}
                </span>
              </div>
            ))}

            {/* Violation discount */}
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: T.text2 }}>&minus; Building condition adj.</span>
              <span className="text-sm font-semibold tabular-nums" style={{ color: T.danger, fontFamily: "var(--font-mono)" }}>
                &minus;{formatDollars(Math.abs(valueBreakdown.violationDiscount))}
              </span>
            </div>

            {/* Dashed divider */}
            <div style={{ borderTop: `1px dashed ${T.border}` }} />

            {/* Estimated fair rent */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold" style={{ color: T.text1 }}>Estimated fair rent</span>
              <span className="text-sm font-bold tabular-nums" style={{ color: T.text1, fontFamily: "var(--font-mono)" }}>
                {formatDollars(estimatedFair)}
              </span>
            </div>

            {/* Actual rent */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold" style={{ color: T.text1 }}>Actual median rent</span>
              <span className="text-sm font-bold tabular-nums" style={{ color: T.gold, fontFamily: "var(--font-mono)" }}>
                {formatDollars(valueBreakdown.buildingMedian)}
              </span>
            </div>

            {/* Value verdict */}
            <div
              className="flex items-center gap-3 rounded-xl px-4 py-3 mt-2"
              style={{
                backgroundColor: isGoodValue ? `${T.sage}10` : `${T.danger}10`,
                border: `1px solid ${isGoodValue ? T.sage : T.danger}25`,
              }}
            >
              <span className="text-sm font-semibold" style={{ color: isGoodValue ? T.sage : T.danger }}>
                {isGoodValue
                  ? `${formatDollars(Math.abs(diff))}/mo below fair rent`
                  : `${formatDollars(diff)}/mo above fair rent`}
              </span>
              <span
                className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full"
                style={{
                  color: gradeColor(valueBreakdown.valueGrade),
                  backgroundColor: `${gradeColor(valueBreakdown.valueGrade)}15`,
                }}
              >
                Value: {valueBreakdown.valueGrade}
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ============================================================
   BUILDING PULSE (Violations & Health)
   ============================================================ */

const commonViolations = [
  { type: "Paint/Plaster — Peeling", count: 12, pct: 32 },
  { type: "Water Leak — Ceiling", count: 8, pct: 21 },
  { type: "Vermin — Roach", count: 5, pct: 13 },
  { type: "Door/Window — Defective", count: 4, pct: 11 },
  { type: "Smoke Detector — Missing", count: 3, pct: 8 },
];

const commonComplaints = [
  { type: "Elevator Not Working", count: 28, pct: 24 },
  { type: "Heat/Hot Water", count: 22, pct: 19 },
  { type: "Noise — Neighbors", count: 18, pct: 15 },
  { type: "Water Leak", count: 14, pct: 12 },
  { type: "Pest Control", count: 11, pct: 9 },
];

function BuildingPulse() {
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);

  const issueCategories = [
    { key: "violations", label: "HPD Violations", count: 38, color: T.danger, icon: AlertTriangle, trend: -15, density: "0.16/unit" },
    { key: "complaints", label: "311 Complaints", count: 117, color: T.gold, icon: MessageSquareWarning, trend: 8, density: "0.49/unit" },
    { key: "dob", label: "DOB Violations", count: 5, color: T.accent, icon: Wrench, trend: 0, density: "0.02/unit" },
    { key: "permits", label: "Building Permits", count: 18, color: T.blue, icon: Eye, trend: 12, density: "Active" },
  ];

  return (
    <FadeIn>
      <section id="pulse" className="scroll-mt-16">
        <SectionTitle subtitle="Violation trends, complaint patterns, and building health indicators">
          Building Pulse
        </SectionTitle>

        {/* Health verdict */}
        <div
          className="rounded-2xl border p-5 sm:p-6 mb-6 shadow-sm"
          style={{ backgroundColor: T.surface, borderColor: T.border }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${T.sage}12` }}
            >
              <TrendingDown className="w-5 h-5" style={{ color: T.sage }} />
            </div>
            <div>
              <h4 className="text-sm font-semibold" style={{ color: T.sage }}>Improving</h4>
              <p className="text-xs" style={{ color: T.text3 }}>
                Violations down 15% year-over-year · Complaints stable
              </p>
            </div>
          </div>

          {/* 12-month sparkline */}
          <div className="flex items-end gap-1" style={{ height: 64 }}>
            {violationTrend.map((v, i) => {
              const maxV = Math.max(...violationTrend);
              const h = maxV > 0 ? (v / maxV) * 100 : 0;
              const isLast = i === violationTrend.length - 1;
              return (
                <motion.div
                  key={i}
                  className="flex-1 rounded-t"
                  style={{ backgroundColor: isLast ? T.danger : `${T.danger}40` }}
                  initial={{ height: 0 }}
                  whileInView={{ height: `${Math.max(h, 4)}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.04, ease: "easeOut" }}
                />
              );
            })}
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[10px]" style={{ color: T.text3 }}>Apr 2025</span>
            <span className="text-[10px]" style={{ color: T.text3 }}>Mar 2026</span>
          </div>
        </div>

        {/* Issue categories */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {issueCategories.map(({ key, label, count, color, icon: Icon, trend, density }) => (
            <button
              key={key}
              onClick={() => setExpandedIssue(expandedIssue === key ? null : key)}
              className="rounded-xl border p-4 text-left transition-all duration-200 group shadow-sm hover:shadow-md"
              style={{
                backgroundColor: expandedIssue === key ? `${color}06` : T.surface,
                borderColor: expandedIssue === key ? `${color}40` : T.border,
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4" style={{ color }} />
                  <span className="text-sm font-medium" style={{ color: T.text1 }}>{label}</span>
                </div>
                <ChevronDown
                  className="w-4 h-4 transition-transform duration-200"
                  style={{
                    color: T.text3,
                    transform: expandedIssue === key ? "rotate(180deg)" : "rotate(0deg)",
                  }}
                />
              </div>
              <div className="flex items-baseline gap-3 mt-2">
                <span
                  className="text-2xl font-bold tabular-nums"
                  style={{ color, fontFamily: "var(--font-mono)" }}
                >
                  {count}
                </span>
                <span className="text-xs" style={{ color: T.text3 }}>{density}</span>
                {trend !== 0 && <TrendBadge value={trend} />}
              </div>
            </button>
          ))}
        </div>

        {/* Common Issues Breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
          {/* Top Violations */}
          <div className="rounded-xl border p-4" style={{ backgroundColor: T.surface, borderColor: T.border }}>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4" style={{ color: T.danger }} />
              <h4 className="text-sm font-semibold" style={{ color: T.text1 }}>Top Violations</h4>
            </div>
            <div className="space-y-2.5">
              {commonViolations.map(v => (
                <div key={v.type}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs" style={{ color: T.text2 }}>{v.type}</span>
                    <span className="text-xs tabular-nums font-medium" style={{ color: T.text3, fontFamily: "var(--font-mono)" }}>{v.count}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: T.subtle }}>
                    <div className="h-full rounded-full" style={{ backgroundColor: T.danger, width: `${v.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top 311 Complaints */}
          <div className="rounded-xl border p-4" style={{ backgroundColor: T.surface, borderColor: T.border }}>
            <div className="flex items-center gap-2 mb-3">
              <MessageSquareWarning className="w-4 h-4" style={{ color: T.gold }} />
              <h4 className="text-sm font-semibold" style={{ color: T.text1 }}>Top 311 Complaints</h4>
            </div>
            <div className="space-y-2.5">
              {commonComplaints.map(c => (
                <div key={c.type}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs" style={{ color: T.text2 }}>{c.type}</span>
                    <span className="text-xs tabular-nums font-medium" style={{ color: T.text3, fontFamily: "var(--font-mono)" }}>{c.count}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: T.subtle }}>
                    <div className="h-full rounded-full" style={{ backgroundColor: T.gold, width: `${c.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </FadeIn>
  );
}

/* ============================================================
   REVIEWS SECTION
   ============================================================ */

function ReviewsSection() {
  return (
    <FadeIn>
      <section id="reviews" className="scroll-mt-16">
        <SectionTitle subtitle={`${building.reviewCount} verified tenant reviews · Structured pros & cons`}>
          Tenant Reviews
        </SectionTitle>

        <div className="space-y-4">
          {sampleReviews.map((review) => (
            <div
              key={review.id}
              className="rounded-2xl border p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow duration-200"
              style={{ backgroundColor: T.surface, borderColor: T.border }}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h4 className="text-sm font-semibold" style={{ color: T.text1 }}>
                    {review.title}
                  </h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs" style={{ color: T.text3 }}>{review.author}</span>
                    <span style={{ color: T.text3 }}>·</span>
                    <span className="text-xs" style={{ color: T.text3 }}>{review.date}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className="w-3.5 h-3.5"
                      fill={i < review.rating ? T.gold : "transparent"}
                      style={{ color: i < review.rating ? T.gold : T.text3 }}
                    />
                  ))}
                </div>
              </div>

              {/* Pros / Cons with colored left borders */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div
                  className="pl-3 border-l-[3px]"
                  style={{ borderLeftColor: T.sage }}
                >
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <ThumbsUp className="w-3 h-3" style={{ color: T.sage }} />
                    <span className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: T.sage }}>
                      Pros
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: T.text2 }}>
                    {review.pros}
                  </p>
                </div>
                <div
                  className="pl-3 border-l-[3px]"
                  style={{ borderLeftColor: T.pink }}
                >
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <ThumbsDown className="w-3 h-3" style={{ color: T.pink }} />
                    <span className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: T.pink }}>
                      Cons
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: T.text2 }}>
                    {review.cons}
                  </p>
                </div>
              </div>

              {/* Recommend badge */}
              <div className="mt-4 pt-3" style={{ borderTop: `1px solid ${T.border}` }}>
                <span
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
                  style={{
                    color: review.recommend ? T.sage : T.pink,
                    backgroundColor: review.recommend ? `${T.sage}10` : `${T.pink}10`,
                  }}
                >
                  {review.recommend ? (
                    <><ThumbsUp className="w-3 h-3" /> Would recommend</>
                  ) : (
                    <><ThumbsDown className="w-3 h-3" /> Would not recommend</>
                  )}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Show all button */}
        <button
          className="w-full mt-4 py-3 rounded-xl border text-sm font-medium transition-all duration-200 hover:shadow-md hover:border-indigo-200"
          style={{ borderColor: T.border, color: T.accent, backgroundColor: T.surface }}
        >
          View all {building.reviewCount} reviews
          <ChevronRight className="w-4 h-4 inline ml-1" />
        </button>
      </section>
    </FadeIn>
  );
}

/* ============================================================
   BUILDING DETAILS SIDEBAR
   ============================================================ */

function BuildingDetails() {
  const details = [
    { label: "Owner", value: building.owner },
    { label: "Management", value: building.management, link: true },
    { label: "Building Class", value: building.buildingClass },
    { label: "Year Built", value: String(building.yearBuilt) },
    { label: "Total Units", value: String(building.totalUnits) },
    { label: "Residential", value: String(building.residentialUnits) },
    { label: "Floors", value: String(building.floors) },
    { label: "BBL", value: "1000210006", mono: true },
  ];

  return (
    <FadeIn delay={0.1}>
      <div
        className="rounded-2xl border p-5 shadow-sm"
        style={{ backgroundColor: T.surface, borderColor: T.border }}
      >
        <h3 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: T.text1 }}>
          Building Details
        </h3>
        <dl className="space-y-3">
          {details.map(({ label, value, link, mono }) => (
            <div key={label} className="flex justify-between items-baseline">
              <dt className="text-xs" style={{ color: T.text3 }}>{label}</dt>
              <dd
                className={`text-sm font-medium text-right max-w-[60%] truncate ${link ? "hover:underline cursor-pointer" : ""}`}
                style={{
                  color: link ? T.accent : T.text1,
                  fontFamily: mono ? "var(--font-mono)" : "var(--font-body)",
                  fontSize: mono ? "11px" : undefined,
                }}
              >
                {value}
                {link && <ExternalLink className="w-3 h-3 inline ml-1 opacity-50" />}
              </dd>
            </div>
          ))}
        </dl>

        {/* Rent Stabilization callout */}
        <div
          className="mt-5 pt-4 flex items-start gap-3"
          style={{ borderTop: `1px solid ${T.border}` }}
        >
          <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" style={{ color: T.sage }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: T.sage }}>Rent Stabilized</p>
            <p className="text-xs mt-0.5" style={{ color: T.text3 }}>
              12 of 245 units stabilized as of 2024
            </p>
          </div>
        </div>

        {/* Energy Score */}
        <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${T.border}` }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs" style={{ color: T.text3 }}>Energy Star Score</span>
            <span
              className="text-sm font-bold tabular-nums"
              style={{ color: T.blue, fontFamily: "var(--font-mono)" }}
            >
              75
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: T.subtle }}>
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: T.blue }}
              initial={{ width: 0 }}
              whileInView={{ width: "75%" }}
              viewport={{ once: true }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>
          <p className="text-[10px] mt-1" style={{ color: T.text3 }}>
            Above average · Down from 84 in 2022
          </p>
        </div>
      </div>
    </FadeIn>
  );
}

/* ============================================================
   RENT LISTINGS STRIP
   ============================================================ */

function RentListings() {
  const listings = [
    { beds: "Studio", price: "$4,190 - $4,345", sqft: "568", source: "Zillow + Dewey" },
    { beds: "1 Bedroom", price: "$4,725 - $5,396", sqft: "687 - 691", source: "Zillow + OpenIgloo" },
    { beds: "2 Bedroom", price: "$5,858 - $7,196", sqft: "1,072 - 1,219", source: "Zillow + Dewey" },
  ];

  return (
    <FadeIn delay={0.1}>
      <div
        className="rounded-2xl border overflow-hidden shadow-sm"
        style={{ backgroundColor: T.surface, borderColor: T.border }}
      >
        <div className="p-5 pb-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: T.text1 }}>
            Current Listings
          </h3>
        </div>
        <div className="divide-y" style={{ borderColor: T.border }}>
          {listings.map((l) => (
            <div
              key={l.beds}
              className="px-5 py-3 flex items-center justify-between transition-colors"
              style={{ borderColor: T.border }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = T.elevated; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
            >
              <div>
                <span className="text-sm font-medium" style={{ color: T.text1 }}>{l.beds}</span>
                <span className="text-xs ml-2" style={{ color: T.text3 }}>{l.sqft} sqft</span>
              </div>
              <div className="text-right">
                <span
                  className="text-sm font-bold tabular-nums"
                  style={{ color: T.accent, fontFamily: "var(--font-mono)" }}
                >
                  {l.price}
                </span>
                <p className="text-[10px]" style={{ color: T.text3 }}>{l.source}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </FadeIn>
  );
}

/* ============================================================
   NEARBY TRANSIT (Sidebar)
   ============================================================ */

const transitStops = [
  {
    name: "Rector St",
    lines: [{ label: "1", color: "#EE352E" }],
    distance: "0.1 mi",
    walkMin: 2,
  },
  {
    name: "Wall St",
    lines: [{ label: "2", color: "#EE352E" }, { label: "3", color: "#EE352E" }],
    distance: "0.2 mi",
    walkMin: 4,
  },
  {
    name: "Bowling Green",
    lines: [{ label: "4", color: "#00933C" }, { label: "5", color: "#00933C" }],
    distance: "0.2 mi",
    walkMin: 4,
  },
  {
    name: "Broad St",
    lines: [{ label: "J", color: "#996633" }, { label: "Z", color: "#996633" }],
    distance: "0.3 mi",
    walkMin: 5,
  },
  {
    name: "Whitehall St",
    lines: [{ label: "R", color: "#FCCC0A" }, { label: "W", color: "#FCCC0A" }],
    distance: "0.3 mi",
    walkMin: 6,
  },
];

function NearbyTransit() {
  return (
    <div>
      <div
        id="transit"
        className="rounded-2xl border p-5 scroll-mt-16"
        style={{ backgroundColor: T.surface, borderColor: T.border, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Train className="w-4 h-4" style={{ color: T.blue }} />
          <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: T.text1 }}>
            Nearby Transit
          </h3>
        </div>
        <div className="space-y-3">
          {transitStops.map((stop) => (
            <div
              key={stop.name}
              className="flex items-center justify-between py-2"
              style={{ borderBottom: `1px solid ${T.border}` }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex items-center gap-1 shrink-0">
                  {stop.lines.map((line) => (
                    <span
                      key={line.label}
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                      style={{
                        backgroundColor: line.color,
                        color: line.color === "#FCCC0A" ? "#000" : "#fff",
                      }}
                    >
                      {line.label}
                    </span>
                  ))}
                </div>
                <span className="text-sm truncate" style={{ color: T.text1 }}>
                  {stop.name}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <span className="text-xs tabular-nums" style={{ color: T.text3, fontFamily: "var(--font-mono)" }}>
                  {stop.distance}
                </span>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: `${T.blue}10`, color: T.blue }}
                >
                  {stop.walkMin} min
                </span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] mt-3" style={{ color: T.text3 }}>
          Transit Score: <span style={{ color: T.sage }} className="font-semibold">98 / 100</span> — Walker&apos;s Paradise
        </p>
      </div>
    </div>
  );
}

/* ============================================================
   NEARBY SCHOOLS (Sidebar)
   ============================================================ */

const nearbySchools = [
  { name: "PS 234 Independence School", type: "Elementary", rating: 9, distance: "0.4 mi" },
  { name: "IS 289 Hudson River MS", type: "Middle", rating: 7, distance: "0.5 mi" },
  { name: "Millennium High School", type: "High", rating: 8, distance: "0.6 mi" },
  { name: "Stuyvesant High School", type: "High", rating: 10, distance: "1.2 mi" },
];

function NearbySchools() {
  return (
    <div>
      <div
        id="schools"
        className="rounded-2xl border p-5 scroll-mt-16"
        style={{ backgroundColor: T.surface, borderColor: T.border, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
      >
        <div className="flex items-center gap-2 mb-4">
          <GraduationCap className="w-4 h-4" style={{ color: T.accent }} />
          <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: T.text1 }}>
            Nearby Schools
          </h3>
        </div>
        <div className="space-y-3">
          {nearbySchools.map((school) => {
            const ratingColor = school.rating >= 8 ? T.sage : school.rating >= 6 ? T.gold : T.danger;
            return (
              <div
                key={school.name}
                className="py-2"
                style={{ borderBottom: `1px solid ${T.border}` }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: T.text1 }}>
                      {school.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] uppercase tracking-wider" style={{ color: T.text3 }}>
                        {school.type}
                      </span>
                      <span style={{ color: T.text3 }}>·</span>
                      <span className="text-xs tabular-nums" style={{ color: T.text3, fontFamily: "var(--font-mono)" }}>
                        {school.distance}
                      </span>
                    </div>
                  </div>
                  <div
                    className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${ratingColor}10` }}
                  >
                    <span
                      className="text-sm font-bold tabular-nums"
                      style={{ color: ratingColor, fontFamily: "var(--font-mono)" }}
                    >
                      {school.rating}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[10px] mt-3" style={{ color: T.text3 }}>
          Ratings from GreatSchools (1-10 scale)
        </p>
      </div>
    </div>
  );
}

/* ============================================================
   NEARBY RECREATION (Sidebar)
   ============================================================ */

const nearbyParks = [
  { name: "Battery Park", type: "Waterfront Park", distance: "0.2 mi" },
  { name: "Bowling Green", type: "Public Park", distance: "0.1 mi" },
  { name: "Zuccotti Park", type: "Public Plaza", distance: "0.3 mi" },
  { name: "The Battery", type: "Historic Park", distance: "0.3 mi" },
];

function NearbyRecreation() {
  return (
    <div>
      <div
        id="parks"
        className="rounded-2xl border p-5 scroll-mt-16"
        style={{ backgroundColor: T.surface, borderColor: T.border, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
      >
        <div className="flex items-center gap-2 mb-4">
          <TreePine className="w-4 h-4" style={{ color: T.sage }} />
          <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: T.text1 }}>
            Parks & Recreation
          </h3>
        </div>
        <div className="space-y-3">
          {nearbyParks.map((park) => (
            <div
              key={park.name}
              className="flex items-center justify-between py-2"
              style={{ borderBottom: `1px solid ${T.border}` }}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: T.text1 }}>
                  {park.name}
                </p>
                <span className="text-[10px] uppercase tracking-wider" style={{ color: T.text3 }}>
                  {park.type}
                </span>
              </div>
              <span className="text-xs tabular-nums shrink-0 ml-2" style={{ color: T.text3, fontFamily: "var(--font-mono)" }}>
                {park.distance}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   CRIME SUMMARY (Sidebar)
   ============================================================ */

const crimeCategories = [
  { label: "Theft", count: 142, trend: -8 },
  { label: "Assault", count: 67, trend: -12 },
  { label: "Burglary", count: 31, trend: 5 },
  { label: "Robbery", count: 24, trend: -3 },
];

function CrimeSummary() {
  const totalCrime = crimeCategories.reduce((s, c) => s + c.count, 0);
  const crimeLevel = "Low";
  const crimeLevelColor = crimeLevel === "Low" ? T.sage : crimeLevel === "Medium" ? T.gold : T.danger;
  const crimeLevelPct = crimeLevel === "Low" ? 28 : crimeLevel === "Medium" ? 55 : 82;

  return (
    <div>
      <div
        id="crime"
        className="rounded-2xl border p-5 scroll-mt-16"
        style={{ backgroundColor: T.surface, borderColor: T.border, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4" style={{ color: T.blue }} />
          <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: T.text1 }}>
            Crime Summary
          </h3>
        </div>

        {/* Crime level indicator */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs" style={{ color: T.text3 }}>vs City Average</span>
            <span className="text-sm font-semibold" style={{ color: crimeLevelColor }}>
              {crimeLevel}
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: T.subtle }}>
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: crimeLevelColor }}
              initial={{ width: 0 }}
              whileInView={{ width: `${crimeLevelPct}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[9px]" style={{ color: T.text3 }}>Low</span>
            <span className="text-[9px]" style={{ color: T.text3 }}>High</span>
          </div>
        </div>

        {/* Category breakdown */}
        <div className="space-y-2.5">
          {crimeCategories.map((cat) => {
            const barPct = (cat.count / totalCrime) * 100;
            return (
              <div key={cat.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs" style={{ color: T.text2 }}>{cat.label}</span>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs font-semibold tabular-nums"
                      style={{ color: T.text1, fontFamily: "var(--font-mono)" }}
                    >
                      {cat.count}
                    </span>
                    <TrendBadge value={cat.trend} />
                  </div>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: T.subtle }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${barPct}%`, backgroundColor: `${T.blue}60` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-[10px] mt-4" style={{ color: T.text3 }}>
          ZIP 10006 · Last 12 months · Source: NYPD CompStat
        </p>
      </div>
    </div>
  );
}

/* ============================================================
   BUILDING MAP (Full-width)
   ============================================================ */

function BuildingMap() {
  return (
    <div>
      <div
        className="rounded-2xl border overflow-hidden"
        style={{ backgroundColor: T.surface, borderColor: T.border, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
      >
        <div
          className="relative h-64 sm:h-80 flex items-center justify-center"
          style={{
            background: `
              radial-gradient(ellipse at 30% 50%, ${T.blue}0C 0%, transparent 60%),
              radial-gradient(ellipse at 70% 30%, ${T.accent}0A 0%, transparent 50%),
              radial-gradient(ellipse at 50% 80%, ${T.sage}08 0%, transparent 50%),
              linear-gradient(180deg, ${T.elevated} 0%, ${T.surface} 100%)
            `,
          }}
        >
          {/* Grid lines to suggest map */}
          <div className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage: `
                linear-gradient(${T.text2} 1px, transparent 1px),
                linear-gradient(90deg, ${T.text2} 1px, transparent 1px)
              `,
              backgroundSize: "40px 40px",
            }}
          />

          {/* Map pin */}
          <div className="relative flex flex-col items-center z-10">
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, type: "spring", stiffness: 120 }}
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg"
                style={{ backgroundColor: T.accent, boxShadow: `0 0 24px ${T.accent}30` }}
              >
                <MapPin className="w-6 h-6 text-white" />
              </div>
            </motion.div>
            <div
              className="mt-3 px-4 py-2 rounded-xl border backdrop-blur-sm"
              style={{ backgroundColor: `${T.surface}E6`, borderColor: T.border }}
            >
              <p className="text-sm font-semibold" style={{ color: T.text1 }}>
                {building.address}
              </p>
              <p className="text-[10px] tabular-nums mt-0.5" style={{ color: T.text3, fontFamily: "var(--font-mono)" }}>
                40.7074&deg; N, 74.0113&deg; W
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   SAME LANDLORD BUILDINGS (Full-width)
   ============================================================ */

const sameLandlordBuildings = [
  { address: "10 Hanover Square", neighborhood: "Financial District", score: 2.25, grade: "C+", units: 493 },
  { address: "170 Amsterdam Ave", neighborhood: "Upper West Side", score: 1.9, grade: "D+", units: 230 },
  { address: "2 Gold St", neighborhood: "Financial District", score: 2.0, grade: "C", units: 638 },
];

function SameLandlordBuildings() {
  return (
    <div>
      <div>
        <SectionTitle subtitle="Other buildings managed by Equity Residential">
          Same Landlord
        </SectionTitle>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {sameLandlordBuildings.map((b) => {
            const color = gradeColor(b.grade);
            return (
              <div
                key={b.address}
                className="rounded-2xl border p-5 group cursor-pointer transition-all duration-200 hover:shadow-md"
                style={{ backgroundColor: T.surface, borderColor: T.border, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: T.text1 }}>
                      {b.address}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: T.text3 }}>
                      {b.neighborhood}
                    </p>
                  </div>
                  <div
                    className="shrink-0 w-10 h-10 rounded-xl flex flex-col items-center justify-center ml-2"
                    style={{ backgroundColor: `${color}10` }}
                  >
                    <span className="text-sm font-bold" style={{ color, fontFamily: "var(--font-display)" }}>
                      {b.grade}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs" style={{ color: T.text3 }}>
                    <Home className="w-3 h-3 inline mr-1 opacity-60" />
                    {b.units} units
                  </span>
                  <span className="text-xs tabular-nums" style={{ color: T.text2, fontFamily: "var(--font-mono)" }}>
                    {b.score.toFixed(1)}/5
                  </span>
                </div>
                <div className="h-1 rounded-full mt-3 overflow-hidden" style={{ backgroundColor: T.subtle }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(b.score / 5) * 100}%`, backgroundColor: color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   NEARBY BUILDINGS (Full-width)
   ============================================================ */

const nearbyBuildingsList = [
  { address: "75 Wall St", neighborhood: "Financial District", score: 1.8, grade: "D+", distance: "0.1 mi" },
  { address: "20 Exchange Pl", neighborhood: "Financial District", score: 2.55, grade: "C+", distance: "0.2 mi" },
  { address: "90 Washington St", neighborhood: "Financial District", score: 2.4, grade: "C", distance: "0.2 mi" },
  { address: "2 Rector St", neighborhood: "Financial District", score: 1.6, grade: "D", distance: "0.3 mi" },
];

function NearbyBuildings() {
  return (
    <div>
      <div>
        <SectionTitle subtitle="Rated buildings within walking distance">
          Nearby Buildings
        </SectionTitle>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {nearbyBuildingsList.map((b) => {
            const color = gradeColor(b.grade);
            return (
              <div
                key={b.address}
                className="rounded-2xl border p-5 group cursor-pointer transition-all duration-200 hover:shadow-md"
                style={{ backgroundColor: T.surface, borderColor: T.border, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${color}10` }}
                  >
                    <span className="text-xs font-bold" style={{ color, fontFamily: "var(--font-display)" }}>
                      {b.grade}
                    </span>
                  </div>
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full"
                    style={{ backgroundColor: `${T.text3}10`, color: T.text3 }}
                  >
                    {b.distance}
                  </span>
                </div>
                <p className="text-sm font-semibold truncate" style={{ color: T.text1 }}>
                  {b.address}
                </p>
                <p className="text-xs mt-0.5" style={{ color: T.text3 }}>
                  {b.neighborhood}
                </p>
                <p
                  className="text-xs tabular-nums mt-2"
                  style={{ color: T.text2, fontFamily: "var(--font-mono)" }}
                >
                  {b.score.toFixed(1)}/5
                </p>
                <div className="h-1 rounded-full mt-2 overflow-hidden" style={{ backgroundColor: T.subtle }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(b.score / 5) * 100}%`, backgroundColor: color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   FAQ SECTION (Full-width)
   ============================================================ */

function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = [
    { q: "Is 71 Broadway rent stabilized?", a: "Yes — 12 of 245 units are rent stabilized as of 2024. However, most units are market rate." },
    { q: "How does this building compare to the neighborhood?", a: "Rents are 8% below the Financial District median. The building scores a C overall based on tenant reviews and public records." },
    { q: "What are the main complaints?", a: "The most common complaints relate to elevator wait times, thin walls between units, and limited amenity space. Management is generally responsive." },
    { q: "Is the building safe?", a: "The building has a B safety rating. The Financial District (ZIP 10006) has low crime relative to the city average, with theft being the most common category." },
    { q: "Who manages 71 Broadway?", a: "The building is managed by Equity Residential, one of the largest REITs in the US. They also manage 10 Hanover Square and 170 Amsterdam Ave in NYC." },
  ];

  return (
    <div id="faq" className="scroll-mt-16">
      <SectionTitle subtitle="Common questions about 71 Broadway">
        Frequently Asked Questions
      </SectionTitle>

      <div
        className="rounded-2xl border overflow-hidden"
        style={{ backgroundColor: T.surface, borderColor: T.border, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
      >
        {faqs.map((faq, i) => {
          const isOpen = openIndex === i;
          return (
            <div
              key={i}
              style={{ borderBottom: i < faqs.length - 1 ? `1px solid ${T.border}` : undefined }}
            >
              <button
                onClick={() => setOpenIndex(isOpen ? null : i)}
                className="w-full flex items-center justify-between px-5 sm:px-6 py-4 text-left transition-colors duration-150"
                style={{ backgroundColor: isOpen ? T.elevated : "transparent" }}
              >
                <span className="text-sm font-medium pr-4" style={{ color: T.text1 }}>
                  {faq.q}
                </span>
                <ChevronDown
                  className="w-4 h-4 shrink-0 transition-transform duration-200"
                  style={{
                    color: T.text3,
                    transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                  }}
                />
              </button>
              {isOpen && (
                <div className="px-5 sm:px-6 pb-4">
                  <p className="text-sm leading-relaxed" style={{ color: T.text2 }}>
                    {faq.a}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   MAIN PAGE
   ============================================================ */

export default function RedesignLightPage() {
  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: T.bg,
        fontFamily: "var(--font-body)",
        color: T.text1,
      }}
    >
      {/* Hero */}
      <HeroSection />

      {/* Sticky Nav */}
      <StickyNav />

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-10">
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-12">
            <VerdictBanner />
            <ReportCard />
            <RentDashboard />
            <AmenityPremiums />
            <BuildingPulse />
            <ReviewsSection />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <BuildingDetails />
            <RentListings />
            <NearbyTransit />
            <NearbySchools />
            <NearbyRecreation />
            <CrimeSummary />
          </div>
        </div>

        {/* Full-width sections below the grid */}
        <div className="mt-12 space-y-12">
          <BuildingMap />
          <SameLandlordBuildings />
          <NearbyBuildings />
          <FAQSection />
        </div>
      </div>

      {/* Footer accent line */}
      <div
        className="h-[1px]"
        style={{
          background: `linear-gradient(90deg, transparent, ${T.accent}30, ${T.pink}30, ${T.accent}30, transparent)`,
        }}
      />
    </div>
  );
}

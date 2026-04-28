import type { Metadata } from "next";
import Link from "next/link";
import {
  Search, ArrowRight, ArrowUpRight, Building2, Trophy, Flame, Scale, FileWarning,
  Snowflake, Sparkles, AlertTriangle, TrendingUp, TrendingDown, MapPin, Calendar, Layers, Quote,
} from "lucide-react";
import {
  HALL_OF_WORST, HALL_OF_BEST, RANKING_STRIPS, CITY_TOTALS,
  PULL_QUOTE, BOROUGH_BREAKDOWN, WATCHLIST, MOVERS, BY_ERA, BY_SIZE, TOP_ZIPS, COMPLAINT_CLOUD,
} from "../_building-rankings-mock-data";
import { BentoWayfinder } from "./BentoWayfinder";

export const metadata: Metadata = {
  title: "Mockup · Building Rankings (Bento)",
  robots: { index: false, follow: false },
};

const SANS = `"Geist", "Inter", system-ui, sans-serif`;
const MONO = `"Geist Mono", ui-monospace, monospace`;
const INK = "#0a0e1a";
const INK_SOFT = "#3a3f54";
const INK_MUTE = "#73798f";
const PAPER = "#fafbfd";
const BORDER = "rgba(10,14,26,0.08)";

const G = {
  rose:    "linear-gradient(135deg, #fff0f4 0%, #ffd6e3 100%)",
  iris:    "linear-gradient(135deg, #f0eaff 0%, #d9d0ff 100%)",
  sky:     "linear-gradient(135deg, #e6f1ff 0%, #c5dcff 100%)",
  mint:    "linear-gradient(135deg, #e0f7ee 0%, #b8efd6 100%)",
  amber:   "linear-gradient(135deg, #fff5dc 0%, #ffe5a8 100%)",
  peach:   "linear-gradient(135deg, #fff0e8 0%, #ffd2bc 100%)",
  ember:   "linear-gradient(135deg, #fee4d6 0%, #ffb38a 100%)",
  graphite:"linear-gradient(135deg, #1a1d2b 0%, #0a0e1a 100%)",
};
const ACCENT = {
  rose:  "#ec4899",
  iris:  "#7c3aed",
  sky:   "#3b82f6",
  mint:  "#10b981",
  amber: "#f59e0b",
  peach: "#f97316",
  ember: "#ea580c",
  red:   "#dc2626",
};

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 100_000) return `${Math.round(n / 1_000)}K`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function MonoLabel({ children, color = INK_MUTE }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color, fontWeight: 600 }}>
      {children}
    </span>
  );
}

const SHADOW = "0 1px 2px rgba(10,14,26,0.04), 0 8px 24px -12px rgba(10,14,26,0.08)";

export default function MockBuildingRankingsBento() {
  return (
    <main style={{ background: PAPER, color: INK, fontFamily: SANS, minHeight: "100vh" }} className="pb-24 md:pb-0">
      <div className="bg-amber-300 text-[#0F1D2E] text-center text-xs sm:text-sm font-semibold py-1.5">
        MOCKUP · Building rankings · BENTO style.{" "}
        <Link href="/mock/building-rankings-aurora" className="underline">Aurora →</Link>{" "}
        <span className="opacity-50">|</span>{" "}
        <Link href="/mock/building-rankings-editorial" className="underline">Editorial →</Link>{" "}
        <span className="opacity-50">|</span>{" "}
        <Link href="/mock/building-rankings-mono" className="underline">Mono →</Link>
      </div>

      <div className="max-w-[1320px] mx-auto px-6 sm:px-10 pt-12 sm:pt-16">

        {/* Hero */}
        <header className="mb-10 text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: ACCENT.rose }} />
            <MonoLabel>NYC · Building Rankings · {compact(CITY_TOTALS.buildings)} indexed</MonoLabel>
          </div>
          <h1 style={{ fontFamily: SANS, fontSize: "clamp(48px, 7vw, 84px)", lineHeight: 1.0, letterSpacing: "-0.035em", margin: 0, fontWeight: 700, color: INK }}>
            Every building in{" "}
            <span style={{ background: "linear-gradient(135deg, #ec4899, #7c3aed 60%, #3b82f6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              New York City.
            </span>
          </h1>
          <p style={{ fontSize: "clamp(17px, 1.5vw, 21px)", lineHeight: 1.5, color: INK_SOFT, maxWidth: 720, margin: "20px auto 0", fontWeight: 400 }}>
            Ranked by violations, evictions, lawsuits, and what tenants actually report. Pull up any building's
            full file before you sign a lease.
          </p>

          <div className="mt-8 max-w-2xl mx-auto">
            <div className="flex items-center" style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, padding: 6, boxShadow: SHADOW }}>
              <span style={{ padding: "0 14px", color: INK_MUTE }}>
                <Search size={20} strokeWidth={2} />
              </span>
              <input
                type="text"
                placeholder="Search any building by address…"
                className="flex-1 bg-transparent py-3 text-base focus:outline-none"
                style={{ fontFamily: SANS, color: INK }}
              />
              <button className="px-5 py-3 font-semibold text-white text-sm flex items-center gap-2" style={{ background: "linear-gradient(135deg, #ec4899, #7c3aed)", borderRadius: 12 }}>
                Search
                <ArrowRight size={16} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </header>
      </div>

      {/* Wayfinder — sticky in-page nav */}
      <BentoWayfinder />

      <div className="max-w-[1320px] mx-auto px-6 sm:px-10 pt-10 pb-16">

        {/* Stats Bento + Pull Quote */}
        <section id="stats" className="mb-14 scroll-mt-24">
          <div className="grid grid-cols-12 grid-rows-[auto] gap-4">
            <div className="col-span-12 md:col-span-6 row-span-2 p-7 sm:p-9 flex flex-col justify-between" style={{ background: G.rose, borderRadius: 24, minHeight: 220 }}>
              <div>
                <MonoLabel color={ACCENT.rose}>Buildings indexed</MonoLabel>
                <div style={{ fontSize: "clamp(56px, 7vw, 96px)", fontWeight: 800, lineHeight: 0.9, letterSpacing: "-0.04em", marginTop: 14, color: INK, fontVariantNumeric: "tabular-nums" }}>
                  {compact(CITY_TOTALS.buildings)}
                </div>
                <p style={{ marginTop: 12, fontSize: 14, color: INK_SOFT, maxWidth: 360 }}>
                  Every multi-family building in NYC, scored on violations, complaints, lawsuits, and tenant ratings.
                </p>
              </div>
              <div className="flex items-center gap-3 mt-6">
                <span style={{ background: "rgba(255,255,255,0.7)", padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, color: INK }}>
                  Live · cached 60m
                </span>
              </div>
            </div>

            <div className="col-span-6 md:col-span-3 p-6" style={{ background: G.sky, borderRadius: 20 }}>
              <MonoLabel color={ACCENT.sky}>With violations</MonoLabel>
              <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1, marginTop: 8, color: INK, fontVariantNumeric: "tabular-nums" }}>
                {compact(CITY_TOTALS.buildingsWithViolations)}
              </div>
              <div style={{ fontSize: 12, color: INK_SOFT, marginTop: 6 }}>open HPD/DOB cases</div>
            </div>

            <div className="col-span-6 md:col-span-3 p-6" style={{ background: G.iris, borderRadius: 20 }}>
              <MonoLabel color={ACCENT.iris}>Total violations</MonoLabel>
              <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1, marginTop: 8, color: INK, fontVariantNumeric: "tabular-nums" }}>
                {compact(CITY_TOTALS.totalViolations)}
              </div>
              <div style={{ fontSize: 12, color: INK_SOFT, marginTop: 6 }}>citywide, all sources</div>
            </div>

            <div className="col-span-6 md:col-span-3 p-6" style={{ background: G.amber, borderRadius: 20 }}>
              <MonoLabel color={ACCENT.amber}>311 complaints</MonoLabel>
              <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1, marginTop: 8, color: INK, fontVariantNumeric: "tabular-nums" }}>
                {compact(CITY_TOTALS.totalComplaints)}
              </div>
              <div style={{ fontSize: 12, color: INK_SOFT, marginTop: 6 }}>filed last 12 months</div>
            </div>

            <div className="col-span-6 md:col-span-3 p-6" style={{ background: G.mint, borderRadius: 20 }}>
              <MonoLabel color={ACCENT.mint}>Evictions filed</MonoLabel>
              <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1, marginTop: 8, color: INK, fontVariantNumeric: "tabular-nums" }}>
                {compact(CITY_TOTALS.evictionsLastYear)}
              </div>
              <div style={{ fontSize: 12, color: INK_SOFT, marginTop: 6 }}>housing court · last year</div>
            </div>
          </div>

          {/* Pull-quote tile — full-width, dark graphite */}
          <div className="mt-4 p-7 sm:p-10 grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-7 items-center" style={{ background: G.graphite, borderRadius: 24, color: "#fff" }}>
            <div className="hidden lg:flex items-center justify-center" style={{ width: 72, height: 72, borderRadius: 20, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", flexShrink: 0 }}>
              <Quote size={28} style={{ color: "#ff6bb1" }} />
            </div>
            <div>
              <MonoLabel color="rgba(255,255,255,0.5)">Striking number</MonoLabel>
              <p style={{ fontSize: "clamp(22px, 2.6vw, 36px)", lineHeight: 1.2, letterSpacing: "-0.02em", margin: "10px 0 0", fontWeight: 600 }}>
                {PULL_QUOTE.text}{" "}
                <span style={{ background: "linear-gradient(135deg, #ec4899, #7c3aed 60%, #3b82f6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                  {PULL_QUOTE.emphasis}
                </span>
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1" style={{ fontFamily: MONO, fontSize: 12, color: "rgba(255,255,255,0.6)", letterSpacing: "0.04em" }}>
                <span>{PULL_QUOTE.context}</span>
                <span style={{ opacity: 0.4 }}>·</span>
                <span>{PULL_QUOTE.source}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Hall of Worst — Bento mosaic */}
        <section id="worst" className="mb-14 scroll-mt-24">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 mb-6">
            <div>
              <MonoLabel color={ACCENT.rose}>Section 01</MonoLabel>
              <h2 style={{ fontSize: "clamp(28px, 3.5vw, 44px)", lineHeight: 1.05, letterSpacing: "-0.025em", margin: "6px 0 0", fontWeight: 700, color: INK }}>
                Hall of Shame
              </h2>
            </div>
            <MonoLabel>Top 6 by violations</MonoLabel>
          </div>

          <div className="grid grid-cols-12 gap-4">
            <Link href="#" className="col-span-12 lg:col-span-7 p-7 sm:p-8 group transition-all" style={{ background: "#fff", borderRadius: 24, border: `1px solid ${BORDER}`, boxShadow: SHADOW, textDecoration: "none", color: "inherit" }}>
              <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-3">
                  <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.1em", color: ACCENT.rose, fontWeight: 700 }}>NO. 01</span>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "rgba(236,72,153,0.1)", color: ACCENT.rose, fontWeight: 600 }}>Worst overall</span>
                </div>
                <span style={{ width: 40, height: 40, borderRadius: 12, background: G.rose, display: "inline-flex", alignItems: "center", justifyContent: "center", color: ACCENT.rose }}>
                  <Trophy size={18} strokeWidth={2.25} />
                </span>
              </div>
              <h3 style={{ fontSize: "clamp(24px, 3vw, 36px)", lineHeight: 1.05, letterSpacing: "-0.02em", margin: "0 0 6px", fontWeight: 700, color: INK }}>
                {HALL_OF_WORST[0].address}
              </h3>
              <div style={{ fontSize: 14, color: INK_MUTE, marginBottom: 22 }}>
                {HALL_OF_WORST[0].borough} · {HALL_OF_WORST[0].zip} · {HALL_OF_WORST[0].units.toLocaleString()} units · built {HALL_OF_WORST[0].yearBuilt}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                {[
                  { k: "Violations", v: HALL_OF_WORST[0].violations.toLocaleString(), c: ACCENT.rose },
                  { k: "Complaints", v: HALL_OF_WORST[0].complaints.toLocaleString(), c: ACCENT.amber },
                  { k: "Evictions",  v: HALL_OF_WORST[0].evictions.toLocaleString(), c: ACCENT.iris },
                  { k: "LucidIQ",    v: HALL_OF_WORST[0].lucidIQ + "/100", c: ACCENT.peach },
                ].map((s) => (
                  <div key={s.k}>
                    <MonoLabel>{s.k}</MonoLabel>
                    <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4, color: s.c, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
                      {s.v}
                    </div>
                  </div>
                ))}
              </div>
              <div className="pt-5" style={{ borderTop: `1px solid ${BORDER}` }}>
                <MonoLabel color={ACCENT.rose}>Owner of record</MonoLabel>
                <div style={{ marginTop: 6, fontSize: 14, color: INK_SOFT }}>
                  {HALL_OF_WORST[0].ownerName} · <strong style={{ color: INK }}>{HALL_OF_WORST[0].noHeatComplaints.toLocaleString()} no-heat calls</strong> last winter
                </div>
              </div>
            </Link>

            <Link href="#" className="col-span-12 sm:col-span-6 lg:col-span-5 p-6 sm:p-7 flex flex-col justify-between" style={{ background: G.iris, borderRadius: 24, textDecoration: "none", color: "inherit", minHeight: 280 }}>
              <div>
                <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.1em", color: ACCENT.iris, fontWeight: 700 }}>NO. 02</span>
                <h3 style={{ fontSize: 22, lineHeight: 1.15, letterSpacing: "-0.015em", margin: "12px 0 0", fontWeight: 700, color: INK }}>
                  {HALL_OF_WORST[1].address}
                </h3>
                <div style={{ fontSize: 13, color: INK_MUTE, marginTop: 4 }}>
                  {HALL_OF_WORST[1].borough} · {HALL_OF_WORST[1].units.toLocaleString()} units
                </div>
              </div>
              <div className="mt-6">
                <div style={{ fontSize: 56, fontWeight: 800, lineHeight: 0.9, color: INK, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.03em" }}>
                  {compact(HALL_OF_WORST[1].violations)}
                </div>
                <MonoLabel color={INK_SOFT}>open violations</MonoLabel>
                <div style={{ marginTop: 10, fontSize: 12, color: INK_SOFT }}>
                  {HALL_OF_WORST[1].evictions} evictions · {HALL_OF_WORST[1].lawsuits} lawsuits
                </div>
              </div>
            </Link>

            {HALL_OF_WORST.slice(2, 6).map((b, idx) => {
              const palette = [G.amber, G.mint, G.peach, G.sky][idx];
              const accent = [ACCENT.amber, ACCENT.mint, ACCENT.peach, ACCENT.sky][idx];
              return (
                <Link key={b.address} href="#" className="col-span-6 sm:col-span-6 lg:col-span-3 p-5 sm:p-6 flex flex-col" style={{ background: palette, borderRadius: 20, textDecoration: "none", color: "inherit", minHeight: 200 }}>
                  <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", color: accent, fontWeight: 700 }}>
                    NO. {String(idx + 3).padStart(2, "0")}
                  </span>
                  <h3 style={{ fontSize: 14, lineHeight: 1.2, letterSpacing: "-0.005em", margin: "8px 0 0", fontWeight: 700, color: INK, minHeight: "2.4em", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {b.address}
                  </h3>
                  <div style={{ fontSize: 11, color: INK_MUTE, marginTop: 4 }}>
                    {b.borough} · {b.units} units
                  </div>
                  <div style={{ marginTop: "auto", paddingTop: 14 }}>
                    <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 0.9, color: INK, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
                      {compact(b.violations)}
                    </div>
                    <div style={{ fontSize: 11, color: INK_SOFT, marginTop: 4, fontFamily: MONO, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      viol · IQ {b.lucidIQ}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* THE WATCHLIST — pre-foreclosure + rapidly deteriorating */}
        <section id="watchlist" className="mb-14 scroll-mt-24">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 mb-6">
            <div>
              <MonoLabel color={ACCENT.ember}>Section 02</MonoLabel>
              <h2 style={{ fontSize: "clamp(28px, 3.5vw, 44px)", lineHeight: 1.05, letterSpacing: "-0.025em", margin: "6px 0 0", fontWeight: 700, color: INK }}>
                The watchlist
              </h2>
              <p style={{ fontSize: 14, color: INK_SOFT, marginTop: 6, maxWidth: 560 }}>
                Buildings about to crash — pre-foreclosure filings, sudden violation spikes, owners gone missing.
              </p>
            </div>
            <MonoLabel color={ACCENT.ember}>● updated daily</MonoLabel>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {WATCHLIST.map((w) => {
              const sigColor = w.signal === "critical" ? ACCENT.red : w.signal === "high" ? ACCENT.ember : ACCENT.amber;
              const sigBg = w.signal === "critical" ? G.ember : w.signal === "high" ? G.peach : G.amber;
              return (
                <Link key={w.address} href="#" className="p-6 flex flex-col group transition-all" style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 20, boxShadow: SHADOW, textDecoration: "none", color: "inherit", minHeight: 240, position: "relative", overflow: "hidden" }}>
                  {/* Signal stripe */}
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: sigColor }} />

                  <div className="flex items-start justify-between mb-4 mt-1">
                    <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 999, background: sigBg, color: sigColor, fontWeight: 700, fontFamily: MONO, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      {w.signal}
                    </span>
                    <span style={{ width: 36, height: 36, borderRadius: 10, background: sigBg, color: sigColor, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                      <AlertTriangle size={16} strokeWidth={2.25} />
                    </span>
                  </div>

                  <h3 style={{ fontSize: 17, lineHeight: 1.2, letterSpacing: "-0.01em", margin: 0, fontWeight: 700, color: INK }}>
                    {w.address}
                  </h3>
                  <div style={{ fontSize: 12, color: INK_MUTE, marginTop: 4 }}>
                    {w.borough} · {w.units.toLocaleString()} units
                  </div>

                  <div className="mt-5 mb-4 p-3" style={{ background: PAPER, borderRadius: 10, border: `1px solid ${BORDER}` }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: sigColor }}>{w.reasonLabel}</div>
                  </div>

                  <div className="mt-auto pt-4 grid grid-cols-3 gap-3" style={{ borderTop: `1px solid ${BORDER}` }}>
                    <div>
                      <MonoLabel>Violations</MonoLabel>
                      <div style={{ fontSize: 18, fontWeight: 700, color: INK, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{w.currentViolations.toLocaleString()}</div>
                    </div>
                    <div>
                      <MonoLabel>Trend</MonoLabel>
                      <div style={{ fontSize: 18, fontWeight: 700, color: sigColor, marginTop: 2, fontVariantNumeric: "tabular-nums", display: "inline-flex", alignItems: "center", gap: 2 }}>
                        <TrendingUp size={14} strokeWidth={2.5} />
                        {w.trend}%
                      </div>
                    </div>
                    <div>
                      <MonoLabel>On watch</MonoLabel>
                      <div style={{ fontSize: 18, fontWeight: 700, color: INK, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{w.daysOnWatch}d</div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Six rankings */}
        <section id="rankings" className="mb-14 scroll-mt-24">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 mb-6">
            <div>
              <MonoLabel color={ACCENT.iris}>Section 03</MonoLabel>
              <h2 style={{ fontSize: "clamp(28px, 3.5vw, 44px)", lineHeight: 1.05, letterSpacing: "-0.025em", margin: "6px 0 0", fontWeight: 700, color: INK }}>
                Six rankings
              </h2>
            </div>
            <MonoLabel>Top 3 each</MonoLabel>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {RANKING_STRIPS.map((strip, idx) => {
              const palette = [G.rose, G.amber, G.iris, G.peach, G.sky, G.mint][idx];
              const accent = [ACCENT.rose, ACCENT.amber, ACCENT.iris, ACCENT.peach, ACCENT.sky, ACCENT.mint][idx];
              const Icon = [Trophy, Flame, Scale, Building2, FileWarning, Snowflake][idx];
              return (
                <div key={strip.id} className="p-5 sm:p-6" style={{ background: "#fff", borderRadius: 20, border: `1px solid ${BORDER}`, boxShadow: SHADOW }}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span style={{ width: 36, height: 36, borderRadius: 12, background: palette, color: accent, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                        <Icon size={16} strokeWidth={2.25} />
                      </span>
                      <div>
                        <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: INK, lineHeight: 1.2 }}>{strip.label}</h3>
                        <div style={{ fontSize: 11, color: INK_MUTE, marginTop: 2 }}>{strip.description}</div>
                      </div>
                    </div>
                    {strip.metroOnly && (
                      <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: accent, fontWeight: 700, padding: "3px 7px", border: `1px solid ${accent}33`, borderRadius: 4 }}>
                        NYC only
                      </span>
                    )}
                  </div>
                  <ol className="m-0 p-0 list-none">
                    {strip.top3.map((r, i) => (
                      <li key={r.address} className="flex items-center gap-3 py-3" style={{ borderTop: i > 0 ? `1px solid ${BORDER}` : "none" }}>
                        <span style={{ width: 24, height: 24, borderRadius: 8, background: palette, color: accent, fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div style={{ fontSize: 13, fontWeight: 600, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {r.address}
                          </div>
                          <div style={{ fontFamily: MONO, fontSize: 11, color: INK_MUTE, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
                            <span style={{ color: INK, fontWeight: 700 }}>
                              {strip.unit === "viol/unit" ? r.value.toFixed(2) : r.value.toLocaleString()}
                            </span>
                            <span style={{ textTransform: "lowercase" }}> {strip.unit}</span> · {r.sub}
                          </div>
                        </div>
                        <ArrowUpRight size={16} style={{ color: INK_MUTE, flexShrink: 0 }} />
                      </li>
                    ))}
                  </ol>
                </div>
              );
            })}
          </div>
        </section>

        {/* MOVERS — improved + deteriorated */}
        <section id="movers" className="mb-14 scroll-mt-24">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 mb-6">
            <div>
              <MonoLabel color={ACCENT.mint}>Section 04</MonoLabel>
              <h2 style={{ fontSize: "clamp(28px, 3.5vw, 44px)", lineHeight: 1.05, letterSpacing: "-0.025em", margin: "6px 0 0", fontWeight: 700, color: INK }}>
                Movers
              </h2>
              <p style={{ fontSize: 14, color: INK_SOFT, marginTop: 6 }}>
                Where the trajectory matters more than the snapshot. Last 90 days.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Most improved */}
            <div className="p-6 sm:p-7" style={{ background: G.mint, borderRadius: 22 }}>
              <div className="flex items-center gap-3 mb-5">
                <span style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(255,255,255,0.6)", color: ACCENT.mint, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                  <TrendingDown size={18} strokeWidth={2.5} />
                </span>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: INK }}>Most improved</h3>
                  <div style={{ fontSize: 12, color: INK_SOFT, marginTop: 2 }}>Violations dropped most in 90 days</div>
                </div>
              </div>
              <ol className="m-0 p-0 list-none">
                {MOVERS.improved.map((m, i) => (
                  <li key={m.address} className="flex items-center gap-3 py-3.5" style={{ borderTop: i > 0 ? `1px solid rgba(10,14,26,0.08)` : "none" }}>
                    <span style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(255,255,255,0.7)", color: ACCENT.mint, fontSize: 13, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>{m.address}</div>
                      <div style={{ fontFamily: MONO, fontSize: 11, color: INK_SOFT, marginTop: 2, letterSpacing: "0.04em" }}>
                        {m.borough} · {m.units} units · {m.current.toLocaleString()} violations
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: ACCENT.mint, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em", display: "inline-flex", alignItems: "center", gap: 2 }}>
                        <TrendingDown size={14} strokeWidth={2.5} />
                        {m.pct.toFixed(0)}%
                      </div>
                      <div style={{ fontFamily: MONO, fontSize: 10, color: INK_SOFT, letterSpacing: "0.06em" }}>
                        {m.delta.toLocaleString()} viol
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {/* Worst deteriorated */}
            <div className="p-6 sm:p-7" style={{ background: G.ember, borderRadius: 22 }}>
              <div className="flex items-center gap-3 mb-5">
                <span style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(255,255,255,0.6)", color: ACCENT.red, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                  <TrendingUp size={18} strokeWidth={2.5} />
                </span>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: INK }}>Worst deteriorated</h3>
                  <div style={{ fontSize: 12, color: INK_SOFT, marginTop: 2 }}>Violations spiked most in 90 days</div>
                </div>
              </div>
              <ol className="m-0 p-0 list-none">
                {MOVERS.deteriorated.map((m, i) => (
                  <li key={m.address} className="flex items-center gap-3 py-3.5" style={{ borderTop: i > 0 ? `1px solid rgba(10,14,26,0.08)` : "none" }}>
                    <span style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(255,255,255,0.7)", color: ACCENT.red, fontSize: 13, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>{m.address}</div>
                      <div style={{ fontFamily: MONO, fontSize: 11, color: INK_SOFT, marginTop: 2, letterSpacing: "0.04em" }}>
                        {m.borough} · {m.units} units · {m.current.toLocaleString()} violations
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: ACCENT.red, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em", display: "inline-flex", alignItems: "center", gap: 2 }}>
                        <TrendingUp size={14} strokeWidth={2.5} />
                        +{m.pct.toFixed(0)}%
                      </div>
                      <div style={{ fontFamily: MONO, fontSize: 10, color: INK_SOFT, letterSpacing: "0.06em" }}>
                        +{m.delta.toLocaleString()} viol
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* BY ERA & SIZE */}
        <section id="era-size" className="mb-14 scroll-mt-24">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 mb-6">
            <div>
              <MonoLabel color={ACCENT.sky}>Section 05</MonoLabel>
              <h2 style={{ fontSize: "clamp(28px, 3.5vw, 44px)", lineHeight: 1.05, letterSpacing: "-0.025em", margin: "6px 0 0", fontWeight: 700, color: INK }}>
                By era & size
              </h2>
              <p style={{ fontSize: 14, color: INK_SOFT, marginTop: 6 }}>
                Find your kind of building. Worst on the books, per category.
              </p>
            </div>
          </div>

          {/* Era — 4 cards */}
          <div className="mb-3">
            <MonoLabel color={ACCENT.sky}>Construction era</MonoLabel>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            {BY_ERA.map((e, idx) => {
              const palette = [G.peach, G.amber, G.sky, G.mint][idx];
              const accent = [ACCENT.peach, ACCENT.amber, ACCENT.sky, ACCENT.mint][idx];
              return (
                <Link key={e.era} href="#" className="p-5 flex flex-col" style={{ background: palette, borderRadius: 18, textDecoration: "none", color: "inherit", minHeight: 200 }}>
                  <div className="flex items-center justify-between mb-3">
                    <Calendar size={16} style={{ color: accent }} strokeWidth={2.25} />
                    <MonoLabel color={accent}>{compact(e.buildings)} bldg</MonoLabel>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: INK, lineHeight: 1.1, letterSpacing: "-0.01em" }}>
                    {e.era}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 11, color: INK_SOFT, marginTop: 4, letterSpacing: "0.06em" }}>
                    {e.range}
                  </div>
                  <div className="mt-auto pt-4" style={{ borderTop: `1px solid rgba(10,14,26,0.08)` }}>
                    <div style={{ fontSize: 12, color: INK_SOFT, marginBottom: 4 }}>Worst on record</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {e.topAddress}
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: 11, color: accent, marginTop: 2, letterSpacing: "0.04em", fontWeight: 700 }}>
                      {e.topViolations.toLocaleString()} VIOL · {e.topYear}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Size — 3 cards */}
          <div className="mb-3 mt-6">
            <MonoLabel color={ACCENT.iris}>Building size</MonoLabel>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {BY_SIZE.map((s, idx) => {
              const palette = [G.iris, G.rose, G.graphite][idx];
              const accent = [ACCENT.iris, ACCENT.rose, "#fff"][idx];
              const ink = idx === 2 ? "#fff" : INK;
              const inkSoft = idx === 2 ? "rgba(255,255,255,0.7)" : INK_SOFT;
              const borderC = idx === 2 ? "rgba(255,255,255,0.15)" : "rgba(10,14,26,0.08)";
              return (
                <Link key={s.size} href="#" className="p-6 flex flex-col" style={{ background: palette, borderRadius: 20, textDecoration: "none", color: ink, minHeight: 200 }}>
                  <div className="flex items-center justify-between mb-3">
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <Layers size={16} style={{ color: accent }} strokeWidth={2.25} />
                      <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: accent, fontWeight: 700 }}>
                        {s.size}
                      </span>
                    </span>
                    <MonoLabel color={inkSoft}>{compact(s.buildings)} bldg</MonoLabel>
                  </div>
                  <div style={{ fontSize: 13, color: inkSoft, marginBottom: 12 }}>
                    {s.range}
                  </div>
                  <div className="mt-auto">
                    <div style={{ fontSize: 11, color: inkSoft, fontFamily: MONO, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>
                      Worst on record
                    </div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: ink, lineHeight: 1.2, letterSpacing: "-0.01em" }}>
                      {s.topAddress}
                    </div>
                    <div className="mt-3 pt-3 grid grid-cols-2 gap-3" style={{ borderTop: `1px solid ${borderC}` }}>
                      <div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: accent, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
                          {compact(s.topViolations)}
                        </div>
                        <div style={{ fontFamily: MONO, fontSize: 10, color: inkSoft, letterSpacing: "0.06em" }}>VIOLATIONS</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: accent, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
                          {s.topPerUnit.toFixed(2)}
                        </div>
                        <div style={{ fontFamily: MONO, fontSize: 10, color: inkSoft, letterSpacing: "0.06em" }}>PER UNIT</div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* BOROUGH BREAKDOWN */}
        <section id="boroughs" className="mb-14 scroll-mt-24">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 mb-6">
            <div>
              <MonoLabel color={ACCENT.amber}>Section 06</MonoLabel>
              <h2 style={{ fontSize: "clamp(28px, 3.5vw, 44px)", lineHeight: 1.05, letterSpacing: "-0.025em", margin: "6px 0 0", fontWeight: 700, color: INK }}>
                Borough breakdown
              </h2>
              <p style={{ fontSize: 14, color: INK_SOFT, marginTop: 6 }}>
                Where the worst clusters. Top 3 per borough.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-3">
            {BOROUGH_BREAKDOWN.map((b, idx) => {
              const palette = [G.rose, G.iris, G.sky, G.amber, G.mint][idx];
              const accent = [ACCENT.rose, ACCENT.iris, ACCENT.sky, ACCENT.amber, ACCENT.mint][idx];
              // Brooklyn (largest) gets bigger tile
              const span = idx === 0 ? "col-span-12 lg:col-span-7" : idx === 1 ? "col-span-12 sm:col-span-6 lg:col-span-5" : "col-span-12 sm:col-span-6 lg:col-span-4";
              return (
                <Link key={b.name} href="#" className={`${span} p-6 flex flex-col`} style={{ background: palette, borderRadius: 20, textDecoration: "none", color: "inherit", minHeight: 240 }}>
                  <div className="flex items-baseline justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <MapPin size={16} style={{ color: accent }} strokeWidth={2.25} />
                      <h3 style={{ fontSize: idx === 0 ? 26 : 18, fontWeight: 700, margin: 0, color: INK, lineHeight: 1.1, letterSpacing: "-0.015em" }}>
                        {b.name}
                      </h3>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: idx === 0 ? 28 : 20, fontWeight: 800, color: INK, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.025em", lineHeight: 1 }}>
                        {compact(b.violations)}
                      </div>
                      <MonoLabel color={INK_SOFT}>violations</MonoLabel>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, fontFamily: MONO, color: INK_SOFT, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>
                    {compact(b.buildings)} buildings indexed
                  </div>
                  <ol className="m-0 p-0 list-none mt-auto">
                    {b.top3.map((t, i) => (
                      <li key={t.address} className="flex items-center gap-3 py-2.5" style={{ borderTop: `1px solid rgba(10,14,26,0.08)` }}>
                        <span style={{ width: 20, height: 20, borderRadius: 6, background: "rgba(255,255,255,0.7)", color: accent, fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div style={{ fontSize: 13, fontWeight: 600, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {t.address}
                          </div>
                          <div style={{ fontFamily: MONO, fontSize: 11, color: INK_SOFT, fontVariantNumeric: "tabular-nums", letterSpacing: "0.04em" }}>
                            <span style={{ color: accent, fontWeight: 700 }}>{t.value.toLocaleString()}</span> viol · {t.sub}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                </Link>
              );
            })}
          </div>
        </section>

        {/* TOP 10 ZIP CODES */}
        <section id="zips" className="mb-14 scroll-mt-24">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 mb-6">
            <div>
              <MonoLabel color={ACCENT.iris}>Section 07</MonoLabel>
              <h2 style={{ fontSize: "clamp(28px, 3.5vw, 44px)", lineHeight: 1.05, letterSpacing: "-0.025em", margin: "6px 0 0", fontWeight: 700, color: INK }}>
                Top 10 zip codes
              </h2>
              <p style={{ fontSize: 14, color: INK_SOFT, marginTop: 6 }}>
                By violation density (per 1,000 units). Where you really don't want to land.
              </p>
            </div>
          </div>

          <div style={{ background: "#fff", borderRadius: 20, border: `1px solid ${BORDER}`, boxShadow: SHADOW, overflow: "hidden" }}>
            <div className="hidden sm:grid" style={{ gridTemplateColumns: "60px 72px 1fr 120px 120px 120px", gap: 16, padding: "12px 24px", background: PAPER, borderBottom: `1px solid ${BORDER}` }}>
              <MonoLabel>#</MonoLabel>
              <MonoLabel>Zip</MonoLabel>
              <MonoLabel>Neighborhood</MonoLabel>
              <MonoLabel>Buildings</MonoLabel>
              <MonoLabel>Violations</MonoLabel>
              <MonoLabel>Per 1K units</MonoLabel>
            </div>
            <ol className="m-0 p-0 list-none">
              {TOP_ZIPS.map((z, idx) => {
                const heat = z.perKUnit > 130 ? ACCENT.red : z.perKUnit > 110 ? ACCENT.ember : z.perKUnit > 95 ? ACCENT.peach : ACCENT.amber;
                const heatBg = z.perKUnit > 130 ? G.ember : z.perKUnit > 110 ? G.peach : z.perKUnit > 95 ? G.amber : G.amber;
                return (
                  <li key={z.zip} className="group" style={{ borderTop: idx > 0 ? `1px solid ${BORDER}` : "none" }}>
                    <Link
                      href="#"
                      className="zip-row transition-colors hover:bg-[#fafbfd]"
                      style={{ display: "grid", alignItems: "center", gap: 16, padding: "16px 24px", textDecoration: "none", color: "inherit" }}
                    >
                      <span style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700, color: idx < 3 ? ACCENT.rose : INK_MUTE, fontVariantNumeric: "tabular-nums" }}>
                        {String(z.rank).padStart(2, "0")}
                      </span>
                      <span className="zip-code" style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>
                        {z.zip}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: INK, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {z.neighborhood}
                        </div>
                        <div style={{ fontSize: 11, color: INK_MUTE, marginTop: 2 }}>
                          <span className="zip-mobile">{z.zip} · </span>{z.borough}
                        </div>
                      </div>
                      <span className="zip-bldg" style={{ fontFamily: MONO, fontSize: 13, color: INK_SOFT, fontVariantNumeric: "tabular-nums", textAlign: "right" }}>
                        {z.buildings.toLocaleString()}
                      </span>
                      <span className="zip-viol" style={{ fontFamily: MONO, fontSize: 13, color: INK, fontWeight: 600, fontVariantNumeric: "tabular-nums", textAlign: "right" }}>
                        {compact(z.violations)}
                      </span>
                      <span style={{ textAlign: "right" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "flex-end", gap: 6, padding: "4px 10px", borderRadius: 999, background: heatBg, color: heat, fontFamily: MONO, fontSize: 12, fontWeight: 700, fontVariantNumeric: "tabular-nums", letterSpacing: "0.04em" }}>
                          {z.perKUnit}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
            <style>{`
              .zip-row { grid-template-columns: 50px 1fr 80px; }
              .zip-code, .zip-bldg, .zip-viol { display: none; }
              @media (min-width: 640px) {
                .zip-row { grid-template-columns: 60px 72px 1fr 120px 120px 120px; }
                .zip-code, .zip-bldg, .zip-viol { display: inline; }
                .zip-mobile { display: none; }
              }
            `}</style>
          </div>
        </section>

        {/* COMPLAINT CLOUD — bento mosaic where tile size = frequency */}
        <section id="complaints" className="mb-14 scroll-mt-24">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 mb-6">
            <div>
              <MonoLabel color={ACCENT.rose}>Section 08</MonoLabel>
              <h2 style={{ fontSize: "clamp(28px, 3.5vw, 44px)", lineHeight: 1.05, letterSpacing: "-0.025em", margin: "6px 0 0", fontWeight: 700, color: INK }}>
                What people complain about
              </h2>
              <p style={{ fontSize: 14, color: INK_SOFT, marginTop: 6 }}>
                Every 311 call last year, by category. Heat dominates everything.
              </p>
            </div>
            <MonoLabel>{compact(CITY_TOTALS.totalComplaints)} calls · 12 mo</MonoLabel>
          </div>

          {/* Bento mosaic — tiles sized by share */}
          <div className="grid grid-cols-12 grid-flow-row-dense gap-3 auto-rows-[110px]">
            {COMPLAINT_CLOUD.map((c, idx) => {
              // Map size to grid + tile look
              const span =
                c.size === "xl" ? "col-span-12 sm:col-span-7 row-span-2" :
                c.size === "lg" ? "col-span-12 sm:col-span-5 row-span-2" :
                c.size === "md" ? "col-span-6 sm:col-span-4 row-span-2" :
                c.size === "sm" ? "col-span-6 sm:col-span-3 row-span-1" :
                "col-span-6 sm:col-span-3 row-span-1";

              // Palette rotation, but xl/lg use the strongest accents
              const palette = c.size === "xl"
                ? G.rose
                : c.size === "lg"
                ? [G.amber, G.iris][idx % 2]
                : c.size === "md"
                ? [G.sky, G.peach, G.mint][idx % 3]
                : c.size === "sm"
                ? [G.amber, G.iris, G.peach][idx % 3]
                : [G.sky, G.mint, G.amber, G.peach][idx % 4];

              const accent = c.size === "xl"
                ? ACCENT.rose
                : c.size === "lg"
                ? [ACCENT.amber, ACCENT.iris][idx % 2]
                : c.size === "md"
                ? [ACCENT.sky, ACCENT.peach, ACCENT.mint][idx % 3]
                : c.size === "sm"
                ? [ACCENT.amber, ACCENT.iris, ACCENT.peach][idx % 3]
                : [ACCENT.sky, ACCENT.mint, ACCENT.amber, ACCENT.peach][idx % 4];

              const titleSize =
                c.size === "xl" ? "clamp(28px, 3.6vw, 48px)" :
                c.size === "lg" ? "clamp(20px, 2.4vw, 32px)" :
                c.size === "md" ? "clamp(16px, 1.6vw, 22px)" :
                c.size === "sm" ? "15px" : "13px";

              const valueSize =
                c.size === "xl" ? "clamp(48px, 6vw, 80px)" :
                c.size === "lg" ? "clamp(36px, 4vw, 52px)" :
                c.size === "md" ? "clamp(24px, 2.6vw, 32px)" :
                c.size === "sm" ? "20px" : "16px";

              return (
                <Link
                  key={c.category}
                  href="#"
                  className={`${span} flex flex-col justify-between transition-all`}
                  style={{
                    background: palette,
                    borderRadius: c.size === "xl" || c.size === "lg" ? 22 : 16,
                    padding: c.size === "xl" ? "28px" : c.size === "lg" ? "22px" : c.size === "md" ? "18px" : "14px",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <div>
                    <MonoLabel color={accent}>{c.share.toFixed(1)}% of all calls</MonoLabel>
                    <h3 style={{ fontSize: titleSize, fontWeight: 700, lineHeight: 1.0, letterSpacing: "-0.025em", margin: "8px 0 0", color: INK }}>
                      {c.size === "xs" || c.size === "sm" ? c.short : c.category}
                    </h3>
                  </div>
                  <div className="mt-auto pt-3 flex items-baseline justify-between">
                    <div style={{ fontSize: valueSize, fontWeight: 800, lineHeight: 0.9, color: INK, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.04em" }}>
                      {compact(c.count)}
                    </div>
                    {(c.size === "xl" || c.size === "lg") && (
                      <ArrowUpRight size={20} style={{ color: accent }} />
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Tenant favorites */}
        <section id="best" className="mb-14 scroll-mt-24">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 mb-6">
            <div>
              <MonoLabel color={ACCENT.mint}>Section 09</MonoLabel>
              <h2 style={{ fontSize: "clamp(28px, 3.5vw, 44px)", lineHeight: 1.05, letterSpacing: "-0.025em", margin: "6px 0 0", fontWeight: 700, color: INK }}>
                Tenant favorites
              </h2>
            </div>
            <MonoLabel>Top 5 by rating · 50+ reviews</MonoLabel>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {HALL_OF_BEST.map((b, idx) => (
              <Link key={b.address} href="#" className="p-5 flex flex-col" style={{ background: G.mint, borderRadius: 18, textDecoration: "none", color: "inherit", minHeight: 200 }}>
                <div className="flex items-center justify-between mb-3">
                  <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", color: ACCENT.mint, fontWeight: 700 }}>
                    NO. {String(idx + 1).padStart(2, "0")}
                  </span>
                  <Sparkles size={14} style={{ color: ACCENT.mint }} />
                </div>
                <h3 style={{ fontSize: 14, lineHeight: 1.2, margin: 0, fontWeight: 700, color: INK, minHeight: "2.4em", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {b.address}
                </h3>
                <div style={{ fontSize: 11, color: INK_MUTE, marginTop: 4 }}>
                  {b.borough} · built {b.yearBuilt}
                </div>
                <div style={{ marginTop: "auto", paddingTop: 14 }}>
                  <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1, color: INK, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
                    {b.rating.toFixed(1)}<span style={{ fontSize: 16, color: ACCENT.mint }}>★</span>
                  </div>
                  <div style={{ fontSize: 11, color: INK_SOFT, marginTop: 4, fontFamily: MONO, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                    {b.reviewCount} reviews · IQ {b.lucidIQ}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Directory */}
        <section id="directory" className="mb-14 scroll-mt-24">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 mb-6">
            <div>
              <MonoLabel color={ACCENT.sky}>Section 10</MonoLabel>
              <h2 style={{ fontSize: "clamp(28px, 3.5vw, 44px)", lineHeight: 1.05, letterSpacing: "-0.025em", margin: "6px 0 0", fontWeight: 700, color: INK }}>
                Browse the directory
              </h2>
            </div>
            <MonoLabel>{compact(CITY_TOTALS.buildings)} total</MonoLabel>
          </div>

          <div className="flex flex-wrap gap-2 mb-5">
            {["Violations", "Complaints", "Evictions", "Per-unit", "Lawsuits", "No-heat"].map((s, i) => (
              <button key={s} className="px-4 py-2 text-sm font-semibold transition-colors" style={{ background: i === 0 ? INK : "#fff", color: i === 0 ? "#fff" : INK_SOFT, borderRadius: 999, border: `1px solid ${i === 0 ? INK : BORDER}` }}>
                {s}
              </button>
            ))}
          </div>

          <div style={{ background: "#fff", borderRadius: 20, border: `1px solid ${BORDER}`, boxShadow: SHADOW, overflow: "hidden" }}>
            <ol className="m-0 p-0 list-none">
              {HALL_OF_WORST.slice(0, 5).map((b, idx) => (
                <li key={b.address} className="group" style={{ borderTop: idx > 0 ? `1px solid ${BORDER}` : "none" }}>
                  <Link href="#" className="flex items-center gap-4 sm:gap-6 px-5 sm:px-7 py-4 sm:py-5 transition-colors hover:bg-[#fafbfd]" style={{ textDecoration: "none", color: "inherit" }}>
                    <span style={{ minWidth: 40, fontFamily: MONO, fontSize: 18, fontWeight: 700, color: INK_MUTE, fontVariantNumeric: "tabular-nums" }}>
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <div className="flex-1 min-w-0">
                      <h3 style={{ fontSize: "clamp(15px, 1.4vw, 18px)", fontWeight: 700, margin: "0 0 2px", color: INK, letterSpacing: "-0.005em" }}>
                        {b.address}
                      </h3>
                      <div style={{ fontSize: 12, color: INK_MUTE, marginBottom: 6 }}>
                        {b.borough} · {b.zip} · {b.units.toLocaleString()} units · {b.ownerName}
                      </div>
                      <div className="flex flex-wrap gap-x-5 gap-y-1" style={{ fontFamily: MONO, fontSize: 11, color: INK_MUTE, fontVariantNumeric: "tabular-nums" }}>
                        <span><span style={{ color: ACCENT.rose, fontWeight: 700 }}>{b.violations.toLocaleString()}</span> viol</span>
                        <span><span style={{ color: ACCENT.amber, fontWeight: 700 }}>{b.complaints.toLocaleString()}</span> calls</span>
                        <span><span style={{ color: ACCENT.iris, fontWeight: 700 }}>{b.evictions}</span> evict</span>
                        <span><span style={{ color: ACCENT.peach, fontWeight: 700 }}>{b.lawsuits}</span> cases</span>
                        <span><span style={{ color: INK, fontWeight: 700 }}>IQ {b.lucidIQ}</span></span>
                      </div>
                    </div>
                    <span className="hidden sm:inline-flex items-center justify-center" style={{ width: 32, height: 32, borderRadius: 10, background: PAPER, color: INK_MUTE }}>
                      <ArrowUpRight size={16} className="group-hover:scale-110 transition-transform" />
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* CTA */}
        <section className="p-8 sm:p-12 text-center" style={{ background: G.graphite, borderRadius: 28, color: "#fff" }}>
          <MonoLabel color="rgba(255,255,255,0.5)">Tenant testimony</MonoLabel>
          <h2 style={{ fontSize: "clamp(28px, 4vw, 48px)", lineHeight: 1.05, letterSpacing: "-0.025em", margin: "12px 0 16px", fontWeight: 700 }}>
            Review your building.
          </h2>
          <p style={{ fontSize: "clamp(15px, 1.4vw, 18px)", color: "rgba(255,255,255,0.7)", maxWidth: 540, margin: "0 auto 28px", lineHeight: 1.5 }}>
            Public records show what was reported. Reviews from former tenants show what it was actually like.
            Two minutes saves the next renter from a year of mistakes.
          </p>
          <Link href="/nyc/review/new" className="inline-flex items-center gap-2 px-7 py-4 font-semibold" style={{ background: "linear-gradient(135deg, #ec4899, #7c3aed)", color: "#fff", borderRadius: 14, fontSize: 16 }}>
            Write a review
            <ArrowRight size={18} strokeWidth={2.5} />
          </Link>
        </section>
      </div>
    </main>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Search, ArrowRight, ArrowUpRight, Trophy, Flame, Scale, FileWarning, Building2, Snowflake, Sparkles } from "lucide-react";
import { HALL_OF_WORST, HALL_OF_BEST, RANKING_STRIPS, CITY_TOTALS } from "../_building-rankings-mock-data";

export const metadata: Metadata = {
  title: "Mockup · Building Rankings (Editorial)",
  robots: { index: false, follow: false },
};

const SANS = `"Geist", "Inter", system-ui, sans-serif`;
const SERIF = `"Young Serif", "Tiempos", Georgia, serif`;
const MONO = `"Geist Mono", ui-monospace, monospace`;

const PAPER = "#f5f3ee"; // warm cream
const INK = "#0d0e12";
const INK_SOFT = "#3a3d48";
const INK_MUTE = "#6b6e7a";
const BORDER = "rgba(13,14,18,0.12)";
const BORDER_HI = "rgba(13,14,18,0.85)";

const CRIMSON = "#c8252e";
const COBALT = "#1a3aa8";
const SAFFRON = "#e8a04a";
const FOREST = "#2a5d3f";
const PLUM = "#5a2d6e";
const TEAL = "#0e7c8e";

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 100_000) return `${Math.round(n / 1_000)}K`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function MonoLabel({ children, color = INK_MUTE }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color, fontWeight: 600 }}>
      {children}
    </span>
  );
}

export default function MockBuildingRankingsEditorial() {
  return (
    <main style={{ background: PAPER, color: INK, fontFamily: SANS, minHeight: "100vh" }}>
      <div className="bg-amber-300 text-[#0F1D2E] text-center text-xs sm:text-sm font-semibold py-1.5">
        MOCKUP · Building rankings · EDITORIAL style.{" "}
        <Link href="/mock/building-rankings-bento" className="underline">Bento →</Link>{" "}
        <span className="opacity-50">|</span>{" "}
        <Link href="/mock/building-rankings-aurora" className="underline">Aurora →</Link>{" "}
        <span className="opacity-50">|</span>{" "}
        <Link href="/mock/building-rankings-mono" className="underline">Mono →</Link>
      </div>

      <div className="max-w-[1320px] mx-auto px-6 sm:px-10 py-12 sm:py-16">

        {/* Hero — masthead */}
        <header className="mb-12 sm:mb-16 pb-10" style={{ borderBottom: `2px solid ${BORDER_HI}` }}>
          <div className="flex items-center justify-between mb-8">
            <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: CRIMSON, fontWeight: 700 }}>
              <span style={{ background: CRIMSON, color: PAPER, padding: "3px 8px", marginRight: 10 }}>VOL 02</span>
              The Building Index · NYC
            </div>
            <MonoLabel>Updated daily</MonoLabel>
          </div>

          <h1 style={{ fontFamily: SERIF, fontSize: "clamp(56px, 8.5vw, 132px)", lineHeight: 0.92, letterSpacing: "-0.025em", margin: 0, fontWeight: 400, color: INK }}>
            Every building.<br />
            <span style={{ fontStyle: "italic", color: CRIMSON }}>On the record.</span>
          </h1>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8 mt-10 items-end">
            <p style={{ fontFamily: SERIF, fontSize: "clamp(20px, 2vw, 28px)", lineHeight: 1.3, maxWidth: 680, margin: 0, color: INK_SOFT, fontStyle: "italic" }}>
              Searchable. Sortable. <span style={{ background: SAFFRON, color: INK, padding: "0 8px", fontStyle: "normal", fontWeight: 700 }}>Receipts.</span>
              All <span style={{ color: CRIMSON, fontWeight: 700, fontStyle: "normal" }}>{compact(CITY_TOTALS.buildings)}</span> of them.
            </p>
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
              {[
                { v: compact(CITY_TOTALS.buildings), k: "buildings", c: CRIMSON },
                { v: compact(CITY_TOTALS.totalViolations), k: "violations", c: COBALT },
                { v: compact(CITY_TOTALS.evictionsLastYear), k: "evictions", c: SAFFRON },
              ].map((s) => (
                <div key={s.k}>
                  <div style={{ fontFamily: SANS, fontSize: 38, fontWeight: 800, lineHeight: 1, color: s.c, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.03em" }}>
                    {s.v}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: INK_MUTE, marginTop: 4, fontWeight: 600 }}>
                    {s.k}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Search */}
          <div className="mt-10 flex items-stretch overflow-hidden max-w-3xl" style={{ border: `2px solid ${BORDER_HI}`, background: "#fff" }}>
            <span className="pl-6 pr-2 flex items-center" style={{ color: INK }}>
              <Search size={22} strokeWidth={2.5} />
            </span>
            <input
              type="text"
              placeholder="Search any building by address…"
              className="flex-1 px-3 py-5 text-lg font-semibold focus:outline-none"
              style={{ fontFamily: SANS, color: INK }}
            />
            <button
              className="px-7 sm:px-10 font-bold uppercase tracking-wider text-sm"
              style={{ background: CRIMSON, color: PAPER, fontFamily: SANS, letterSpacing: "0.08em" }}
            >
              SEARCH →
            </button>
          </div>
        </header>

        {/* Hall of Worst — bento mosaic with editorial typography */}
        <section className="mb-14 sm:mb-20">
          <div className="flex items-end justify-between mb-8">
            <div>
              <MonoLabel color={CRIMSON}>Section 01 · Above the fold</MonoLabel>
              <h2 style={{ fontFamily: SERIF, fontSize: "clamp(36px, 5vw, 64px)", lineHeight: 1.0, letterSpacing: "-0.02em", margin: "8px 0 0", fontWeight: 400, color: INK }}>
                Hall of <span style={{ fontStyle: "italic", color: CRIMSON }}>worst</span>
              </h2>
            </div>
            <MonoLabel>Top 6 by violations</MonoLabel>
          </div>

          <div className="grid grid-cols-12 gap-3">
            {/* #1 — large featured, white card with crimson accent */}
            <Link href="#" className="col-span-12 lg:col-span-7 p-8 sm:p-10 group" style={{ background: "#fff", border: `2px solid ${BORDER_HI}`, color: "inherit", textDecoration: "none" }}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-baseline gap-3">
                  <span style={{ fontFamily: SERIF, fontSize: 88, fontWeight: 400, lineHeight: 0.85, color: CRIMSON, letterSpacing: "-0.04em" }}>01</span>
                  <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: CRIMSON, fontWeight: 700, padding: "3px 8px", border: `1px solid ${CRIMSON}`, marginLeft: 6 }}>
                    Worst overall
                  </span>
                </div>
                <Trophy size={24} strokeWidth={2} style={{ color: CRIMSON }} />
              </div>
              <h3 style={{ fontFamily: SERIF, fontSize: "clamp(28px, 3.5vw, 44px)", lineHeight: 1.05, letterSpacing: "-0.02em", margin: 0, fontWeight: 400, color: INK }}>
                {HALL_OF_WORST[0].address}
              </h3>
              <div style={{ fontFamily: MONO, fontSize: 12, color: INK_MUTE, marginTop: 8, letterSpacing: "0.06em" }}>
                {HALL_OF_WORST[0].borough.toUpperCase()} · {HALL_OF_WORST[0].zip} · {HALL_OF_WORST[0].units.toLocaleString()} UNITS · BUILT {HALL_OF_WORST[0].yearBuilt}
              </div>
              <div className="grid grid-cols-4 gap-6 mt-8 pt-6" style={{ borderTop: `1px solid ${BORDER}` }}>
                {[
                  { k: "Violations", v: compact(HALL_OF_WORST[0].violations), c: CRIMSON },
                  { k: "Complaints", v: compact(HALL_OF_WORST[0].complaints), c: SAFFRON },
                  { k: "Evictions", v: HALL_OF_WORST[0].evictions.toString(), c: PLUM },
                  { k: "LucidIQ", v: HALL_OF_WORST[0].lucidIQ + "/100", c: COBALT },
                ].map((s) => (
                  <div key={s.k}>
                    <div style={{ fontFamily: SERIF, fontSize: 38, fontWeight: 400, lineHeight: 1, color: s.c, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.03em" }}>
                      {s.v}
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: INK_MUTE, marginTop: 4, fontWeight: 600 }}>
                      {s.k}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 pt-5 flex items-baseline justify-between" style={{ borderTop: `1px solid ${BORDER}` }}>
                <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: INK_MUTE, fontWeight: 600 }}>
                  Owner: <span style={{ color: INK, fontWeight: 700 }}>{HALL_OF_WORST[0].ownerName}</span>
                </div>
                <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700, color: CRIMSON }}>
                  Open file →
                </span>
              </div>
            </Link>

            {/* #2 — vertical, full crimson block */}
            <Link href="#" className="col-span-12 sm:col-span-6 lg:col-span-5 p-8 flex flex-col justify-between" style={{ background: CRIMSON, color: PAPER, textDecoration: "none", minHeight: 320 }}>
              <div>
                <span style={{ fontFamily: SERIF, fontSize: 88, fontWeight: 400, lineHeight: 0.85, color: PAPER, letterSpacing: "-0.04em", opacity: 0.95 }}>02</span>
                <h3 style={{ fontFamily: SERIF, fontSize: 28, lineHeight: 1.05, letterSpacing: "-0.015em", margin: "16px 0 0", fontWeight: 400 }}>
                  {HALL_OF_WORST[1].address}
                </h3>
                <div style={{ fontFamily: MONO, fontSize: 11, marginTop: 8, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.85 }}>
                  {HALL_OF_WORST[1].borough} · {HALL_OF_WORST[1].units.toLocaleString()} units
                </div>
              </div>
              <div>
                <div style={{ fontFamily: SANS, fontSize: 80, fontWeight: 800, lineHeight: 0.85, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.04em" }}>
                  {compact(HALL_OF_WORST[1].violations)}
                </div>
                <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", marginTop: 8, fontWeight: 700, opacity: 0.9 }}>
                  open violations
                </div>
                <div className="mt-5 pt-4 flex items-center justify-between" style={{ borderTop: `1px solid rgba(255,255,255,0.3)` }}>
                  <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.85 }}>
                    {HALL_OF_WORST[1].evictions} evictions · {HALL_OF_WORST[1].lawsuits} cases
                  </span>
                  <ArrowUpRight size={20} strokeWidth={2.5} />
                </div>
              </div>
            </Link>

            {/* #3-6 — color blocks */}
            {HALL_OF_WORST.slice(2, 6).map((b, idx) => {
              const palette = [COBALT, SAFFRON, FOREST, PLUM][idx];
              const fg = idx === 1 ? INK : PAPER;
              return (
                <Link key={b.address} href="#" className="col-span-6 sm:col-span-6 lg:col-span-3 p-6 flex flex-col" style={{ background: palette, color: fg, textDecoration: "none", minHeight: 220 }}>
                  <span style={{ fontFamily: SERIF, fontSize: 56, fontWeight: 400, lineHeight: 0.85, letterSpacing: "-0.04em", opacity: 0.95 }}>
                    {String(idx + 3).padStart(2, "0")}
                  </span>
                  <h3 style={{ fontFamily: SERIF, fontSize: 18, lineHeight: 1.15, margin: "10px 0 0", fontWeight: 400 }}>
                    {b.address}
                  </h3>
                  <div style={{ fontFamily: MONO, fontSize: 10, marginTop: 6, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.8 }}>
                    {b.borough} · {b.units} units
                  </div>
                  <div style={{ marginTop: "auto", paddingTop: 14 }}>
                    <div style={{ fontFamily: SANS, fontSize: 36, fontWeight: 800, lineHeight: 0.9, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.03em" }}>
                      {compact(b.violations)}
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: 10, marginTop: 4, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.85, fontWeight: 700 }}>
                      VIOL · IQ {b.lucidIQ}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Pull quote */}
        <section className="mb-14 sm:mb-20" style={{ background: SAFFRON, color: INK, borderTop: `2px solid ${BORDER_HI}`, borderBottom: `2px solid ${BORDER_HI}`, marginLeft: "calc(50% - 50vw)", marginRight: "calc(50% - 50vw)" }}>
          <div className="max-w-[1100px] mx-auto px-6 sm:px-10 py-14 sm:py-20">
            <MonoLabel color={INK}>❝ From the record</MonoLabel>
            <p style={{ fontFamily: SERIF, fontSize: "clamp(28px, 4vw, 56px)", lineHeight: 1.1, letterSpacing: "-0.015em", margin: "20px 0 0", fontStyle: "italic", fontWeight: 400 }}>
              765 Lincoln Avenue carries{" "}
              <span style={{ background: INK, color: SAFFRON, padding: "0 14px", fontStyle: "normal", fontWeight: 700 }}>
                14,374 open violations
              </span>{" "}
              and {HALL_OF_WORST[0].noHeatComplaints.toLocaleString()} no-heat calls last winter alone — across {HALL_OF_WORST[0].units.toLocaleString()} apartments.
            </p>
            <MonoLabel color={INK}>— Linden Plaza · NO. 01 in the index</MonoLabel>
          </div>
        </section>

        {/* Six rankings — bento grid with editorial type */}
        <section className="mb-14 sm:mb-20">
          <div className="flex items-end justify-between mb-8">
            <div>
              <MonoLabel color={COBALT}>Section 02 · Lenses</MonoLabel>
              <h2 style={{ fontFamily: SERIF, fontSize: "clamp(36px, 5vw, 64px)", lineHeight: 1.0, letterSpacing: "-0.02em", margin: "8px 0 0", fontWeight: 400, color: INK }}>
                Six <span style={{ fontStyle: "italic", color: COBALT }}>rankings</span>
              </h2>
            </div>
            <MonoLabel>Top 3 each</MonoLabel>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {RANKING_STRIPS.map((strip, idx) => {
              const palette = [CRIMSON, SAFFRON, COBALT, PLUM, FOREST, TEAL][idx];
              const Icon = [Trophy, Flame, Scale, Building2, FileWarning, Snowflake][idx];
              return (
                <article key={strip.id} style={{ background: "#fff", border: `2px solid ${BORDER_HI}` }}>
                  <header className="p-5 flex items-start justify-between" style={{ borderBottom: `2px solid ${BORDER_HI}`, background: palette, color: idx === 1 ? INK : PAPER }}>
                    <div className="flex items-center gap-3">
                      <Icon size={20} strokeWidth={2.25} />
                      <div>
                        <h3 style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 400, margin: 0, lineHeight: 1.1, letterSpacing: "-0.015em" }}>
                          {strip.label}
                        </h3>
                        <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 4, opacity: 0.85, fontWeight: 600 }}>
                          {strip.description}
                        </div>
                      </div>
                    </div>
                    {strip.metroOnly && (
                      <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700, padding: "3px 7px", border: `1px solid currentColor`, opacity: 0.95, flexShrink: 0 }}>
                        NYC
                      </span>
                    )}
                  </header>
                  <ol className="list-none m-0 p-0">
                    {strip.top3.map((r, i) => (
                      <li key={r.address} className="px-5 py-4 flex items-center gap-4" style={{ borderTop: i > 0 ? `1px solid ${BORDER}` : "none" }}>
                        <span style={{ fontFamily: SERIF, fontSize: 36, lineHeight: 0.85, color: palette, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.04em", minWidth: 36 }}>
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div style={{ fontFamily: SANS, fontSize: 14, fontWeight: 700, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {r.address}
                          </div>
                          <div style={{ fontFamily: MONO, fontSize: 11, color: INK_MUTE, marginTop: 2, fontVariantNumeric: "tabular-nums", letterSpacing: "0.04em" }}>
                            <span style={{ color: palette, fontWeight: 700 }}>
                              {strip.unit === "viol/unit" ? r.value.toFixed(2) : r.value.toLocaleString()}
                            </span>{" "}
                            <span style={{ textTransform: "uppercase", letterSpacing: "0.1em" }}>{strip.unit}</span> · {r.sub}
                          </div>
                        </div>
                        <ArrowUpRight size={16} style={{ color: INK_MUTE, flexShrink: 0 }} />
                      </li>
                    ))}
                  </ol>
                </article>
              );
            })}
          </div>
        </section>

        {/* Tenant favorites */}
        <section className="mb-14 sm:mb-20">
          <div className="flex items-end justify-between mb-8">
            <div>
              <MonoLabel color={FOREST}>Section 03 · The good news</MonoLabel>
              <h2 style={{ fontFamily: SERIF, fontSize: "clamp(36px, 5vw, 64px)", lineHeight: 1.0, letterSpacing: "-0.02em", margin: "8px 0 0", fontWeight: 400, color: INK }}>
                Tenant <span style={{ fontStyle: "italic", color: FOREST }}>favorites</span>
              </h2>
            </div>
            <MonoLabel>Top 5 by rating · 50+ reviews</MonoLabel>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {HALL_OF_BEST.map((b, idx) => (
              <Link key={b.address} href="#" className="p-5 flex flex-col" style={{ background: "#fff", border: `2px solid ${BORDER_HI}`, color: "inherit", textDecoration: "none", minHeight: 220 }}>
                <div className="flex items-center justify-between mb-3">
                  <span style={{ fontFamily: SERIF, fontSize: 36, fontWeight: 400, lineHeight: 0.85, color: FOREST, letterSpacing: "-0.04em" }}>
                    0{idx + 1}
                  </span>
                  <Sparkles size={16} style={{ color: FOREST }} />
                </div>
                <h3 style={{ fontFamily: SERIF, fontSize: 16, lineHeight: 1.15, margin: 0, fontWeight: 400, color: INK }}>
                  {b.address}
                </h3>
                <div style={{ fontFamily: MONO, fontSize: 10, color: INK_MUTE, marginTop: 4, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                  {b.borough} · {b.yearBuilt}
                </div>
                <div style={{ marginTop: "auto", paddingTop: 14 }}>
                  <div style={{ fontFamily: SERIF, fontSize: 40, fontWeight: 400, lineHeight: 0.85, color: FOREST, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.03em" }}>
                    {b.rating.toFixed(1)}<span style={{ fontSize: 18 }}>★</span>
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 10, color: INK_MUTE, marginTop: 4, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>
                    {b.reviewCount} REVIEWS · IQ {b.lucidIQ}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Directory */}
        <section className="mb-14 sm:mb-20">
          <div className="flex items-end justify-between mb-8">
            <div>
              <MonoLabel color={PLUM}>Section 04 · The full record</MonoLabel>
              <h2 style={{ fontFamily: SERIF, fontSize: "clamp(36px, 5vw, 64px)", lineHeight: 1.0, letterSpacing: "-0.02em", margin: "8px 0 0", fontWeight: 400, color: INK }}>
                Browse the <span style={{ fontStyle: "italic", color: PLUM }}>directory</span>
              </h2>
            </div>
            <MonoLabel>{compact(CITY_TOTALS.buildings)} total</MonoLabel>
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            {["Violations", "Complaints", "Evictions", "Per-unit", "Lawsuits", "No-heat"].map((s, i) => (
              <button key={s} className="px-4 py-2 font-bold uppercase tracking-wider text-xs" style={{ border: `2px solid ${BORDER_HI}`, background: i === 0 ? INK : "transparent", color: i === 0 ? PAPER : INK, fontFamily: SANS, letterSpacing: "0.08em" }}>
                {s}
              </button>
            ))}
          </div>

          <ol className="list-none m-0 p-0">
            {HALL_OF_WORST.slice(0, 5).map((b, idx) => (
              <li key={b.address}>
                <Link href="#" className="group flex items-center gap-5 sm:gap-8 py-5 transition-colors hover:bg-[#0d0e12] hover:text-[#f5f3ee] -mx-6 sm:-mx-10 px-6 sm:px-10" style={{ borderTop: idx === 0 ? `2px solid ${BORDER_HI}` : "none", borderBottom: `2px solid ${BORDER_HI}`, color: INK, textDecoration: "none" }}>
                  <span style={{ fontFamily: SERIF, fontSize: 56, fontWeight: 400, lineHeight: 0.9, color: CRIMSON, letterSpacing: "-0.04em", minWidth: 70, fontVariantNumeric: "tabular-nums" }}>
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <div className="flex-1 min-w-0">
                    <h3 style={{ fontFamily: SERIF, fontSize: "clamp(20px, 2vw, 28px)", fontWeight: 400, lineHeight: 1.1, margin: "0 0 4px", letterSpacing: "-0.01em" }}>
                      {b.address}
                    </h3>
                    <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600, opacity: 0.7 }}>
                      {b.borough} · {b.zip} · {b.units.toLocaleString()} UNITS · {b.ownerName}
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: 11, marginTop: 6, fontVariantNumeric: "tabular-nums", letterSpacing: "0.04em", opacity: 0.8 }}>
                      {b.violations.toLocaleString()} VIOL · {b.complaints.toLocaleString()} CALLS · {b.evictions} EVICT · {b.lawsuits} CASES · IQ {b.lucidIQ}
                    </div>
                  </div>
                  <ArrowRight size={28} strokeWidth={2.25} className="group-hover:translate-x-1 transition-transform" />
                </Link>
              </li>
            ))}
          </ol>
        </section>

        {/* CTA */}
        <section style={{ background: CRIMSON, color: PAPER, marginLeft: "calc(50% - 50vw)", marginRight: "calc(50% - 50vw)", borderTop: `2px solid ${BORDER_HI}` }}>
          <div className="max-w-[1100px] mx-auto px-6 sm:px-10 py-16 sm:py-24 text-center">
            <h2 style={{ fontFamily: SERIF, fontSize: "clamp(48px, 8vw, 110px)", fontWeight: 400, lineHeight: 0.9, letterSpacing: "-0.025em", margin: 0 }}>
              Add your <span style={{ fontStyle: "italic" }}>receipts</span>.
            </h2>
            <p style={{ fontFamily: SERIF, fontSize: "clamp(18px, 2vw, 24px)", maxWidth: 560, margin: "20px auto 0", fontStyle: "italic", lineHeight: 1.4, opacity: 0.95, fontWeight: 400 }}>
              Public records show what was reported. Reviews from former tenants show what it was actually like.
            </p>
            <Link href="/nyc/review/new" className="inline-flex items-center gap-3 mt-10 px-10 py-5 font-bold uppercase tracking-wider" style={{ background: PAPER, color: CRIMSON, fontFamily: SANS, fontSize: 16, border: `2px solid ${PAPER}`, letterSpacing: "0.1em" }}>
              Write a review <ArrowRight size={22} strokeWidth={2.5} />
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

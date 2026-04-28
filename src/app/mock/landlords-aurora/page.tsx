import type { Metadata } from "next";
import Link from "next/link";
import { Search, ArrowRight, ArrowUpRight, Trophy, Flame, Scale, FileWarning, Building2, Sparkles } from "lucide-react";
import { HALL_OF_SHAME, RANKING_STRIPS, CITY_TOTALS } from "../_landlords-mock-data";

export const metadata: Metadata = {
  title: "Mockup · Landlords (Aurora)",
  robots: { index: false, follow: false },
};

const SANS = `"Geist", "Inter", system-ui, sans-serif`;
const MONO = `"Geist Mono", ui-monospace, monospace`;

const BG = "#06070d";
const SURFACE = "rgba(255,255,255,0.03)";
const SURFACE_HI = "rgba(255,255,255,0.06)";
const STROKE = "rgba(255,255,255,0.08)";
const STROKE_HI = "rgba(255,255,255,0.16)";
const INK = "#f6f7fb";
const INK_DIM = "rgba(246,247,251,0.65)";
const INK_MUTE = "rgba(246,247,251,0.4)";

const PINK = "#ff6bb1";
const PURPLE = "#a855f7";
const INDIGO = "#6366f1";
const SKY = "#38bdf8";
const TEAL = "#2dd4bf";
const AMBER = "#fbbf24";
const RED = "#fb7185";

const AURORA_TEXT = "linear-gradient(120deg, #ff6bb1 0%, #a855f7 40%, #6366f1 70%, #38bdf8 100%)";
const AURORA_BG = "radial-gradient(80% 60% at 70% 0%, rgba(168,85,247,0.35) 0%, rgba(168,85,247,0) 60%), radial-gradient(70% 60% at 0% 30%, rgba(255,107,177,0.28) 0%, rgba(255,107,177,0) 55%), radial-gradient(60% 60% at 100% 100%, rgba(56,189,248,0.25) 0%, rgba(56,189,248,0) 60%)";
const GLASS = "rgba(255,255,255,0.04)";

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 100_000) return `${Math.round(n / 1_000)}K`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function MonoLabel({ children, color = INK_MUTE }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color, fontWeight: 600 }}>
      {children}
    </span>
  );
}

export default function MockLandlordsAurora() {
  return (
    <main style={{ background: BG, color: INK, fontFamily: SANS, minHeight: "100vh", position: "relative" }}>
      {/* Aurora background */}
      <div style={{ position: "absolute", inset: 0, background: AURORA_BG, pointerEvents: "none" }} />

      <div className="relative">
        <div className="bg-amber-300 text-[#0F1D2E] text-center text-xs sm:text-sm font-semibold py-1.5">
          MOCKUP · Landlord directory · AURORA style.{" "}
          <Link href="/mock/landlords-magazine" className="underline">Magazine version →</Link>{" "}
          <span className="opacity-50">|</span>{" "}
          <Link href="/mock/landlords-bento" className="underline">Bento version →</Link>
        </div>

        <div className="max-w-[1320px] mx-auto px-6 sm:px-10 py-12 sm:py-16">

          {/* Hero */}
          <header className="mb-12 sm:mb-16">
            <div className="flex items-center gap-2 mb-6">
              <Sparkles size={14} style={{ color: PINK }} />
              <MonoLabel color={INK_DIM}>NYC · Landlord Index · Live</MonoLabel>
            </div>
            <h1 style={{ fontFamily: SANS, fontSize: "clamp(48px, 7vw, 84px)", lineHeight: 1.0, letterSpacing: "-0.035em", margin: 0, fontWeight: 700, color: INK }}>
              Every landlord.<br />
              <span style={{ background: AURORA_TEXT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                On the record.
              </span>
            </h1>
            <p style={{ fontSize: "clamp(17px, 1.5vw, 21px)", lineHeight: 1.5, color: INK_DIM, maxWidth: 720, margin: "20px 0 0", fontWeight: 400 }}>
              Look up any one of {CITY_TOTALS.landlords.toLocaleString()} indexed owners. The full portfolio,
              violation history, complaint record, and the worst building in their book — in one search.
            </p>

            {/* Search */}
            <div className="mt-8 max-w-2xl">
              <div className="flex items-center" style={{ background: GLASS, border: `1px solid ${STROKE_HI}`, borderRadius: 16, padding: 6, backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", boxShadow: "0 24px 48px -24px rgba(168,85,247,0.4)" }}>
                <span style={{ padding: "0 14px", color: INK_MUTE }}>
                  <Search size={20} strokeWidth={2} />
                </span>
                <input
                  type="text"
                  placeholder="Search any landlord by name…"
                  className="flex-1 bg-transparent py-3 text-base focus:outline-none"
                  style={{ fontFamily: SANS, color: INK }}
                />
                <button className="px-5 py-3 font-semibold text-white text-sm flex items-center gap-2" style={{ background: AURORA_TEXT, borderRadius: 12, boxShadow: "0 8px 24px -8px rgba(168,85,247,0.5)" }}>
                  Search
                  <ArrowRight size={16} strokeWidth={2.5} />
                </button>
              </div>
              <p style={{ fontSize: 12, color: INK_MUTE, marginTop: 10, fontFamily: MONO, letterSpacing: "0.04em" }}>
                Type 2+ characters · live results · ↑↓ to navigate
              </p>
            </div>
          </header>

          {/* Stats — frosted glass row */}
          <section className="mb-12 sm:mb-16 grid grid-cols-2 lg:grid-cols-5 gap-3" >
            {[
              { k: "Indexed", v: CITY_TOTALS.landlords.toLocaleString(), s: "landlords", c: PINK },
              { k: "Tracked", v: compact(CITY_TOTALS.buildings), s: "buildings", c: PURPLE },
              { k: "Cited", v: compact(CITY_TOTALS.violations), s: "violations", c: INDIGO },
              { k: "Filed", v: compact(CITY_TOTALS.complaints), s: "311 complaints", c: SKY },
              { k: "Pending", v: compact(CITY_TOTALS.litigations), s: "court cases", c: TEAL },
            ].map((s) => (
              <div key={s.k} className="p-5" style={{ background: GLASS, border: `1px solid ${STROKE}`, borderRadius: 18, backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.c, boxShadow: `0 0 12px ${s.c}` }} />
                  <MonoLabel color={INK_MUTE}>{s.k}</MonoLabel>
                </div>
                <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.025em", color: INK, fontVariantNumeric: "tabular-nums" }}>
                  {s.v}
                </div>
                <div style={{ fontSize: 12, color: INK_MUTE, marginTop: 6, fontFamily: MONO, letterSpacing: "0.04em" }}>{s.s}</div>
              </div>
            ))}
          </section>

          {/* Hall of Shame */}
          <section className="mb-12 sm:mb-16">
            <div className="flex items-baseline justify-between mb-6">
              <div>
                <MonoLabel color={PINK}>Section 01</MonoLabel>
                <h2 style={{ fontSize: "clamp(28px, 3.5vw, 44px)", lineHeight: 1.05, letterSpacing: "-0.025em", margin: "6px 0 0", fontWeight: 700, color: INK }}>
                  Hall of shame
                </h2>
              </div>
              <MonoLabel>Top 6 by violations</MonoLabel>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {HALL_OF_SHAME.map((l, idx) => {
                const palette = [PINK, PURPLE, INDIGO, SKY, TEAL, AMBER][idx];
                return (
                  <Link key={l.name} href="#" className="group p-6 flex flex-col transition-all relative overflow-hidden" style={{ background: GLASS, border: `1px solid ${STROKE}`, borderRadius: 22, backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", color: "inherit", textDecoration: "none", minHeight: 280 }}>
                    {/* Aurora accent blob */}
                    <div style={{ position: "absolute", top: -40, right: -40, width: 200, height: 200, borderRadius: "50%", background: `radial-gradient(circle, ${palette}33 0%, transparent 70%)`, pointerEvents: "none" }} />

                    <div className="relative flex items-center justify-between mb-5">
                      <div className="flex items-center gap-2">
                        <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.12em", color: palette, fontWeight: 700 }}>
                          NO. {String(idx + 1).padStart(2, "0")}
                        </span>
                      </div>
                      <span style={{ width: 36, height: 36, borderRadius: 10, background: `${palette}22`, color: palette, display: "inline-flex", alignItems: "center", justifyContent: "center", border: `1px solid ${palette}44` }}>
                        <Trophy size={15} strokeWidth={2.25} />
                      </span>
                    </div>

                    <h3 style={{ fontSize: 18, lineHeight: 1.2, letterSpacing: "-0.01em", margin: 0, fontWeight: 700, color: INK, minHeight: "2.4em", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {l.name}
                    </h3>

                    <div className="mt-auto pt-5 relative">
                      <div style={{ fontSize: 48, fontWeight: 800, lineHeight: 0.9, letterSpacing: "-0.035em", color: INK, fontVariantNumeric: "tabular-nums", background: `linear-gradient(135deg, ${INK} 0%, ${palette} 100%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                        {compact(l.violations)}
                      </div>
                      <MonoLabel color={INK_DIM}>violations on record</MonoLabel>

                      <div className="mt-4 pt-4 flex items-center justify-between" style={{ borderTop: `1px solid ${STROKE}` }}>
                        <div style={{ fontSize: 11, color: INK_MUTE, fontFamily: MONO, letterSpacing: "0.04em" }}>
                          {l.buildings} bldg · {l.litigations} cases
                        </div>
                        <ArrowUpRight size={16} style={{ color: palette }} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* Rankings */}
          <section className="mb-12 sm:mb-16">
            <div className="flex items-baseline justify-between mb-6">
              <div>
                <MonoLabel color={PURPLE}>Section 02</MonoLabel>
                <h2 style={{ fontSize: "clamp(28px, 3.5vw, 44px)", lineHeight: 1.05, letterSpacing: "-0.025em", margin: "6px 0 0", fontWeight: 700, color: INK }}>
                  Rankings
                </h2>
              </div>
              <MonoLabel>5 lenses · top 3 each</MonoLabel>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {RANKING_STRIPS.map((strip, idx) => {
                const palette = [PINK, PURPLE, SKY, TEAL, AMBER][idx];
                const Icon = [Trophy, Flame, Scale, FileWarning, Building2][idx];
                return (
                  <div key={strip.id} className="p-5 sm:p-6 relative overflow-hidden" style={{ background: GLASS, border: `1px solid ${STROKE}`, borderRadius: 20, backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>
                    <div style={{ position: "absolute", top: -30, left: -30, width: 140, height: 140, borderRadius: "50%", background: `radial-gradient(circle, ${palette}1f 0%, transparent 70%)`, pointerEvents: "none" }} />

                    <div className="relative flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <span style={{ width: 36, height: 36, borderRadius: 10, background: `${palette}22`, color: palette, display: "inline-flex", alignItems: "center", justifyContent: "center", border: `1px solid ${palette}33` }}>
                          <Icon size={16} strokeWidth={2.25} />
                        </span>
                        <div>
                          <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: INK, lineHeight: 1.2 }}>{strip.label}</h3>
                          <Link href="#" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: palette, fontWeight: 700, textDecoration: "none" }}>
                            See all →
                          </Link>
                        </div>
                      </div>
                    </div>

                    <ol className="m-0 p-0 list-none relative">
                      {strip.top3.map((r, i) => (
                        <li key={r.name} className="flex items-center gap-3 py-3" style={{ borderTop: i > 0 ? `1px solid ${STROKE}` : "none" }}>
                          <span style={{ width: 22, height: 22, borderRadius: 7, background: `${palette}22`, color: palette, fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", fontVariantNumeric: "tabular-nums", flexShrink: 0, border: `1px solid ${palette}33` }}>
                            {i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div style={{ fontSize: 13, fontWeight: 600, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {r.name}
                            </div>
                            <div style={{ fontFamily: MONO, fontSize: 11, color: INK_MUTE, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
                              <span style={{ color: palette, fontWeight: 700 }}>{r.value.toLocaleString()}</span>
                              <span style={{ textTransform: "lowercase" }}> {strip.unit}</span> · {r.sub}
                            </div>
                          </div>
                          <ArrowUpRight size={14} style={{ color: INK_MUTE, flexShrink: 0 }} />
                        </li>
                      ))}
                    </ol>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Directory */}
          <section className="mb-12 sm:mb-16">
            <div className="flex items-baseline justify-between mb-6">
              <div>
                <MonoLabel color={SKY}>Section 03</MonoLabel>
                <h2 style={{ fontSize: "clamp(28px, 3.5vw, 44px)", lineHeight: 1.05, letterSpacing: "-0.025em", margin: "6px 0 0", fontWeight: 700, color: INK }}>
                  Browse the directory
                </h2>
              </div>
              <MonoLabel>{CITY_TOTALS.landlords.toLocaleString()} total</MonoLabel>
            </div>

            <div className="flex flex-wrap gap-2 mb-5">
              {["Violations", "Complaints", "Litigations", "DOB", "Buildings"].map((s, i) => (
                <button key={s} className="px-4 py-2 text-sm font-semibold transition-colors" style={{ background: i === 0 ? AURORA_TEXT : GLASS, color: "#fff", borderRadius: 999, border: `1px solid ${i === 0 ? "transparent" : STROKE_HI}`, backdropFilter: i === 0 ? "none" : "blur(8px)" }}>
                  {s}
                </button>
              ))}
            </div>

            <div style={{ background: GLASS, border: `1px solid ${STROKE}`, borderRadius: 22, backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", overflow: "hidden" }}>
              <ol className="m-0 p-0 list-none">
                {HALL_OF_SHAME.slice(0, 5).map((l, idx) => (
                  <li key={l.name} style={{ borderTop: idx > 0 ? `1px solid ${STROKE}` : "none" }}>
                    <Link href="#" className="group flex items-center gap-4 sm:gap-6 px-5 sm:px-7 py-4 sm:py-5 transition-colors hover:bg-white/5" style={{ textDecoration: "none", color: "inherit" }}>
                      <span style={{ minWidth: 40, fontFamily: MONO, fontSize: 18, fontWeight: 700, color: INK_MUTE, fontVariantNumeric: "tabular-nums" }}>
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <div className="flex-1 min-w-0">
                        <h3 style={{ fontSize: "clamp(15px, 1.4vw, 18px)", fontWeight: 700, margin: "0 0 6px", color: INK, letterSpacing: "-0.005em" }}>
                          {l.name}
                        </h3>
                        <div className="flex flex-wrap gap-x-5 gap-y-1" style={{ fontFamily: MONO, fontSize: 11, color: INK_MUTE, fontVariantNumeric: "tabular-nums" }}>
                          <span><span style={{ color: PINK, fontWeight: 700 }}>{l.violations.toLocaleString()}</span> viol</span>
                          <span><span style={{ color: AMBER, fontWeight: 700 }}>{l.complaints.toLocaleString()}</span> calls</span>
                          <span><span style={{ color: PURPLE, fontWeight: 700 }}>{l.litigations}</span> cases</span>
                          <span><span style={{ color: SKY, fontWeight: 700 }}>{l.buildings}</span> bldg</span>
                        </div>
                      </div>
                      <span className="hidden sm:inline-flex items-center justify-center group-hover:bg-white/10" style={{ width: 32, height: 32, borderRadius: 10, background: SURFACE, color: INK_MUTE, transition: "background 200ms" }}>
                        <ArrowUpRight size={16} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          {/* CTA */}
          <section className="p-8 sm:p-12 text-center relative overflow-hidden" style={{ background: GLASS, border: `1px solid ${STROKE_HI}`, borderRadius: 28, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
            <div style={{ position: "absolute", inset: 0, background: `radial-gradient(80% 80% at 50% 0%, rgba(168,85,247,0.25) 0%, transparent 70%)`, pointerEvents: "none" }} />
            <div className="relative">
              <MonoLabel color={INK_DIM}>Tenant testimony</MonoLabel>
              <h2 style={{ fontSize: "clamp(28px, 4vw, 48px)", lineHeight: 1.05, letterSpacing: "-0.025em", margin: "12px 0 16px", fontWeight: 700, color: INK }}>
                Add your <span style={{ background: AURORA_TEXT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>receipts</span>.
              </h2>
              <p style={{ fontSize: "clamp(15px, 1.4vw, 18px)", color: INK_DIM, maxWidth: 540, margin: "0 auto 28px", lineHeight: 1.5 }}>
                Reviews from former tenants are the part of the file we can't pull from public records.
                Two minutes saves the next renter from a year of mistakes.
              </p>
              <Link href="/nyc/review/new" className="inline-flex items-center gap-2 px-7 py-4 font-semibold text-white" style={{ background: AURORA_TEXT, borderRadius: 14, fontSize: 16, boxShadow: "0 16px 40px -12px rgba(168,85,247,0.5)" }}>
                Write a review
                <ArrowRight size={18} strokeWidth={2.5} />
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

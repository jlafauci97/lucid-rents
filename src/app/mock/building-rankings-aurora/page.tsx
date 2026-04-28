import type { Metadata } from "next";
import Link from "next/link";
import { Search, ArrowRight, ArrowUpRight, Trophy, Flame, Scale, FileWarning, Building2, Snowflake, Sparkles } from "lucide-react";
import { HALL_OF_WORST, HALL_OF_BEST, RANKING_STRIPS, CITY_TOTALS } from "../_building-rankings-mock-data";

export const metadata: Metadata = {
  title: "Mockup · Building Rankings (Aurora)",
  robots: { index: false, follow: false },
};

const SANS = `"Geist", "Inter", system-ui, sans-serif`;
const MONO = `"Geist Mono", ui-monospace, monospace`;

const BG = "#06070d";
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

export default function MockBuildingRankingsAurora() {
  return (
    <main style={{ background: BG, color: INK, fontFamily: SANS, minHeight: "100vh", position: "relative" }}>
      <div style={{ position: "absolute", inset: 0, background: AURORA_BG, pointerEvents: "none" }} />

      <div className="relative">
        <div className="bg-amber-300 text-[#0F1D2E] text-center text-xs sm:text-sm font-semibold py-1.5">
          MOCKUP · Building rankings · AURORA style.{" "}
          <Link href="/mock/building-rankings-bento" className="underline">Bento →</Link>{" "}
          <span className="opacity-50">|</span>{" "}
          <Link href="/mock/building-rankings-editorial" className="underline">Editorial →</Link>{" "}
          <span className="opacity-50">|</span>{" "}
          <Link href="/mock/building-rankings-mono" className="underline">Mono →</Link>
        </div>

        <div className="max-w-[1320px] mx-auto px-6 sm:px-10 py-12 sm:py-16">

          {/* Hero */}
          <header className="mb-12 sm:mb-16">
            <div className="flex items-center gap-2 mb-6">
              <Sparkles size={14} style={{ color: PINK }} />
              <MonoLabel color={INK_DIM}>NYC · Building Rankings · Live</MonoLabel>
            </div>
            <h1 style={{ fontFamily: SANS, fontSize: "clamp(48px, 7vw, 84px)", lineHeight: 1.0, letterSpacing: "-0.035em", margin: 0, fontWeight: 700, color: INK }}>
              Every building.<br />
              <span style={{ background: AURORA_TEXT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                Ranked on the record.
              </span>
            </h1>
            <p style={{ fontSize: "clamp(17px, 1.5vw, 21px)", lineHeight: 1.5, color: INK_DIM, maxWidth: 720, margin: "20px 0 0", fontWeight: 400 }}>
              Pull up any one of {compact(CITY_TOTALS.buildings)} indexed buildings. Violations, evictions, lawsuits,
              tenant ratings, and the full LucidIQ score — in one search.
            </p>

            <div className="mt-8 max-w-2xl">
              <div className="flex items-center" style={{ background: GLASS, border: `1px solid ${STROKE_HI}`, borderRadius: 16, padding: 6, backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", boxShadow: "0 24px 48px -24px rgba(168,85,247,0.4)" }}>
                <span style={{ padding: "0 14px", color: INK_MUTE }}>
                  <Search size={20} strokeWidth={2} />
                </span>
                <input
                  type="text"
                  placeholder="Search any building by address…"
                  className="flex-1 bg-transparent py-3 text-base focus:outline-none"
                  style={{ fontFamily: SANS, color: INK }}
                />
                <button className="px-5 py-3 font-semibold text-white text-sm flex items-center gap-2" style={{ background: AURORA_TEXT, borderRadius: 12, boxShadow: "0 8px 24px -8px rgba(168,85,247,0.5)" }}>
                  Search
                  <ArrowRight size={16} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </header>

          {/* Stats — frosted glass row */}
          <section className="mb-12 sm:mb-16 grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { k: "Indexed", v: compact(CITY_TOTALS.buildings), s: "buildings", c: PINK },
              { k: "Cited", v: compact(CITY_TOTALS.buildingsWithViolations), s: "with violations", c: PURPLE },
              { k: "Open", v: compact(CITY_TOTALS.totalViolations), s: "violations citywide", c: INDIGO },
              { k: "Filed", v: compact(CITY_TOTALS.totalComplaints), s: "311 complaints", c: SKY },
              { k: "Pushed", v: compact(CITY_TOTALS.evictionsLastYear), s: "evictions, last year", c: TEAL },
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

          {/* Hall of Worst */}
          <section className="mb-12 sm:mb-16">
            <div className="flex items-baseline justify-between mb-6">
              <div>
                <MonoLabel color={PINK}>Section 01</MonoLabel>
                <h2 style={{ fontSize: "clamp(28px, 3.5vw, 44px)", lineHeight: 1.05, letterSpacing: "-0.025em", margin: "6px 0 0", fontWeight: 700, color: INK }}>
                  Hall of worst
                </h2>
              </div>
              <MonoLabel>Top 6 by violations</MonoLabel>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {HALL_OF_WORST.map((b, idx) => {
                const palette = [PINK, PURPLE, INDIGO, SKY, TEAL, AMBER][idx];
                return (
                  <Link key={b.address} href="#" className="group p-6 flex flex-col transition-all relative overflow-hidden" style={{ background: GLASS, border: `1px solid ${STROKE}`, borderRadius: 22, backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", color: "inherit", textDecoration: "none", minHeight: 300 }}>
                    <div style={{ position: "absolute", top: -40, right: -40, width: 200, height: 200, borderRadius: "50%", background: `radial-gradient(circle, ${palette}33 0%, transparent 70%)`, pointerEvents: "none" }} />

                    <div className="relative flex items-center justify-between mb-5">
                      <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.12em", color: palette, fontWeight: 700 }}>
                        NO. {String(idx + 1).padStart(2, "0")}
                      </span>
                      <span style={{ width: 36, height: 36, borderRadius: 10, background: `${palette}22`, color: palette, display: "inline-flex", alignItems: "center", justifyContent: "center", border: `1px solid ${palette}44` }}>
                        <Trophy size={15} strokeWidth={2.25} />
                      </span>
                    </div>

                    <h3 style={{ fontSize: 18, lineHeight: 1.2, letterSpacing: "-0.01em", margin: 0, fontWeight: 700, color: INK }}>
                      {b.address}
                    </h3>
                    <div style={{ fontSize: 12, color: INK_MUTE, marginTop: 4, fontFamily: MONO, letterSpacing: "0.04em" }}>
                      {b.borough} · {b.units.toLocaleString()} units · built {b.yearBuilt}
                    </div>

                    <div className="mt-auto pt-5 relative">
                      <div style={{ fontSize: 48, fontWeight: 800, lineHeight: 0.9, letterSpacing: "-0.035em", color: INK, fontVariantNumeric: "tabular-nums", background: `linear-gradient(135deg, ${INK} 0%, ${palette} 100%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                        {compact(b.violations)}
                      </div>
                      <MonoLabel color={INK_DIM}>open violations</MonoLabel>

                      <div className="mt-4 pt-4 grid grid-cols-3 gap-3" style={{ borderTop: `1px solid ${STROKE}` }}>
                        <div>
                          <div style={{ fontSize: 11, color: INK_MUTE, fontFamily: MONO, letterSpacing: "0.04em" }}>Evict</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>{b.evictions}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: INK_MUTE, fontFamily: MONO, letterSpacing: "0.04em" }}>Cases</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>{b.lawsuits}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: INK_MUTE, fontFamily: MONO, letterSpacing: "0.04em" }}>IQ</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: palette, fontVariantNumeric: "tabular-nums" }}>{b.lucidIQ}</div>
                        </div>
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
                  Six rankings
                </h2>
              </div>
              <MonoLabel>Top 3 each</MonoLabel>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {RANKING_STRIPS.map((strip, idx) => {
                const palette = [PINK, AMBER, PURPLE, INDIGO, SKY, TEAL][idx];
                const Icon = [Trophy, Flame, Scale, Building2, FileWarning, Snowflake][idx];
                return (
                  <div key={strip.id} className="p-5 sm:p-6 relative overflow-hidden" style={{ background: GLASS, border: `1px solid ${STROKE}`, borderRadius: 20, backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>
                    <div style={{ position: "absolute", top: -30, left: -30, width: 140, height: 140, borderRadius: "50%", background: `radial-gradient(circle, ${palette}1f 0%, transparent 70%)`, pointerEvents: "none" }} />

                    <div className="relative flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <span style={{ width: 36, height: 36, borderRadius: 10, background: `${palette}22`, color: palette, display: "inline-flex", alignItems: "center", justifyContent: "center", border: `1px solid ${palette}33` }}>
                          <Icon size={16} strokeWidth={2.25} />
                        </span>
                        <div>
                          <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: INK, lineHeight: 1.2 }}>{strip.label}</h3>
                          <div style={{ fontSize: 11, color: INK_MUTE, marginTop: 2 }}>{strip.description}</div>
                        </div>
                      </div>
                      {strip.metroOnly && (
                        <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: palette, fontWeight: 700, padding: "3px 7px", border: `1px solid ${palette}44`, borderRadius: 4 }}>
                          NYC
                        </span>
                      )}
                    </div>

                    <ol className="m-0 p-0 list-none relative">
                      {strip.top3.map((r, i) => (
                        <li key={r.address} className="flex items-center gap-3 py-3" style={{ borderTop: i > 0 ? `1px solid ${STROKE}` : "none" }}>
                          <span style={{ width: 22, height: 22, borderRadius: 7, background: `${palette}22`, color: palette, fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", fontVariantNumeric: "tabular-nums", flexShrink: 0, border: `1px solid ${palette}33` }}>
                            {i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div style={{ fontSize: 13, fontWeight: 600, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {r.address}
                            </div>
                            <div style={{ fontFamily: MONO, fontSize: 11, color: INK_MUTE, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
                              <span style={{ color: palette, fontWeight: 700 }}>
                                {strip.unit === "viol/unit" ? r.value.toFixed(2) : r.value.toLocaleString()}
                              </span>
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

          {/* Tenant favorites */}
          <section className="mb-12 sm:mb-16">
            <div className="flex items-baseline justify-between mb-6">
              <div>
                <MonoLabel color={TEAL}>Section 03</MonoLabel>
                <h2 style={{ fontSize: "clamp(28px, 3.5vw, 44px)", lineHeight: 1.05, letterSpacing: "-0.025em", margin: "6px 0 0", fontWeight: 700, color: INK }}>
                  Tenant favorites
                </h2>
              </div>
              <MonoLabel>Top 5 by rating · 50+ reviews</MonoLabel>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {HALL_OF_BEST.map((b, idx) => (
                <Link key={b.address} href="#" className="p-5 flex flex-col relative overflow-hidden" style={{ background: GLASS, border: `1px solid ${STROKE}`, borderRadius: 18, backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", color: "inherit", textDecoration: "none", minHeight: 200 }}>
                  <div style={{ position: "absolute", top: -20, right: -20, width: 100, height: 100, borderRadius: "50%", background: `radial-gradient(circle, ${TEAL}22 0%, transparent 70%)`, pointerEvents: "none" }} />
                  <div className="flex items-center justify-between mb-3 relative">
                    <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", color: TEAL, fontWeight: 700 }}>
                      NO. {String(idx + 1).padStart(2, "0")}
                    </span>
                    <Sparkles size={14} style={{ color: TEAL }} />
                  </div>
                  <h3 style={{ fontSize: 14, lineHeight: 1.2, margin: 0, fontWeight: 700, color: INK, minHeight: "2.4em" }}>
                    {b.address}
                  </h3>
                  <div style={{ fontSize: 11, color: INK_MUTE, marginTop: 4, fontFamily: MONO, letterSpacing: "0.04em" }}>
                    {b.borough} · built {b.yearBuilt}
                  </div>
                  <div style={{ marginTop: "auto", paddingTop: 14, position: "relative" }}>
                    <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1, color: INK, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em", background: `linear-gradient(135deg, ${INK} 0%, ${TEAL} 100%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                      {b.rating.toFixed(1)}<span style={{ fontSize: 16 }}>★</span>
                    </div>
                    <div style={{ fontSize: 11, color: INK_MUTE, marginTop: 4, fontFamily: MONO, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      {b.reviewCount} reviews · IQ {b.lucidIQ}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* Directory */}
          <section className="mb-12 sm:mb-16">
            <div className="flex items-baseline justify-between mb-6">
              <div>
                <MonoLabel color={SKY}>Section 04</MonoLabel>
                <h2 style={{ fontSize: "clamp(28px, 3.5vw, 44px)", lineHeight: 1.05, letterSpacing: "-0.025em", margin: "6px 0 0", fontWeight: 700, color: INK }}>
                  Browse the directory
                </h2>
              </div>
              <MonoLabel>{compact(CITY_TOTALS.buildings)} total</MonoLabel>
            </div>

            <div className="flex flex-wrap gap-2 mb-5">
              {["Violations", "Complaints", "Evictions", "Per-unit", "Lawsuits", "No-heat"].map((s, i) => (
                <button key={s} className="px-4 py-2 text-sm font-semibold transition-colors" style={{ background: i === 0 ? AURORA_TEXT : GLASS, color: "#fff", borderRadius: 999, border: `1px solid ${i === 0 ? "transparent" : STROKE_HI}`, backdropFilter: i === 0 ? "none" : "blur(8px)" }}>
                  {s}
                </button>
              ))}
            </div>

            <div style={{ background: GLASS, border: `1px solid ${STROKE}`, borderRadius: 22, backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", overflow: "hidden" }}>
              <ol className="m-0 p-0 list-none">
                {HALL_OF_WORST.slice(0, 5).map((b, idx) => (
                  <li key={b.address} style={{ borderTop: idx > 0 ? `1px solid ${STROKE}` : "none" }}>
                    <Link href="#" className="group flex items-center gap-4 sm:gap-6 px-5 sm:px-7 py-4 sm:py-5 transition-colors hover:bg-white/5" style={{ textDecoration: "none", color: "inherit" }}>
                      <span style={{ minWidth: 40, fontFamily: MONO, fontSize: 18, fontWeight: 700, color: INK_MUTE, fontVariantNumeric: "tabular-nums" }}>
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <div className="flex-1 min-w-0">
                        <h3 style={{ fontSize: "clamp(15px, 1.4vw, 18px)", fontWeight: 700, margin: "0 0 2px", color: INK, letterSpacing: "-0.005em" }}>
                          {b.address}
                        </h3>
                        <div style={{ fontSize: 12, color: INK_MUTE, marginBottom: 6, fontFamily: MONO, letterSpacing: "0.04em" }}>
                          {b.borough} · {b.zip} · {b.units.toLocaleString()} units · {b.ownerName}
                        </div>
                        <div className="flex flex-wrap gap-x-5 gap-y-1" style={{ fontFamily: MONO, fontSize: 11, color: INK_MUTE, fontVariantNumeric: "tabular-nums" }}>
                          <span><span style={{ color: PINK, fontWeight: 700 }}>{b.violations.toLocaleString()}</span> viol</span>
                          <span><span style={{ color: AMBER, fontWeight: 700 }}>{b.complaints.toLocaleString()}</span> calls</span>
                          <span><span style={{ color: PURPLE, fontWeight: 700 }}>{b.evictions}</span> evict</span>
                          <span><span style={{ color: SKY, fontWeight: 700 }}>{b.lawsuits}</span> cases</span>
                          <span><span style={{ color: INK, fontWeight: 700 }}>IQ {b.lucidIQ}</span></span>
                        </div>
                      </div>
                      <span className="hidden sm:inline-flex items-center justify-center group-hover:bg-white/10" style={{ width: 32, height: 32, borderRadius: 10, background: GLASS, color: INK_MUTE, transition: "background 200ms" }}>
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
                Review your <span style={{ background: AURORA_TEXT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>building</span>.
              </h2>
              <p style={{ fontSize: "clamp(15px, 1.4vw, 18px)", color: INK_DIM, maxWidth: 540, margin: "0 auto 28px", lineHeight: 1.5 }}>
                Public records show what was reported. Reviews from former tenants show what it was actually like.
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

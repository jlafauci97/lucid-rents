import type { Metadata } from "next";
import Link from "next/link";
import { Search, ArrowRight, ArrowUpRight, Trophy, Flame, Scale, FileWarning, Building2, Snowflake, Sparkles, ChevronRight } from "lucide-react";
import { HALL_OF_WORST, HALL_OF_BEST, RANKING_STRIPS, CITY_TOTALS } from "../_building-rankings-mock-data";

export const metadata: Metadata = {
  title: "Mockup · Building Rankings (Mono)",
  robots: { index: false, follow: false },
};

const SANS = `"Geist", "Inter", system-ui, sans-serif`;
const MONO = `"Geist Mono", ui-monospace, monospace`;

// Linear/Vercel-style refined monochrome with a single signal accent.
// Near-black on near-white, hairline borders, generous breathing room,
// crimson reserved for "worst signal" data.
const BG = "#fcfcfd";
const SURFACE = "#ffffff";
const SURFACE_2 = "#f7f7f9";
const INK = "#09090b";
const INK_2 = "#18181b";
const INK_SOFT = "#3f3f46";
const INK_MUTE = "#71717a";
const INK_FAINT = "#a1a1aa";
const HAIR = "rgba(9,9,11,0.06)";
const HAIR_HI = "rgba(9,9,11,0.10)";

const ACCENT = "#dc2626"; // crimson — reserved for worst signals
const ACCENT_SOFT = "#fef2f2";
const GREEN = "#16a34a"; // best signal
const GREEN_SOFT = "#f0fdf4";

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 100_000) return `${Math.round(n / 1_000)}K`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function MonoLabel({ children, color = INK_MUTE }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color, fontWeight: 500 }}>
      {children}
    </span>
  );
}

export default function MockBuildingRankingsMono() {
  return (
    <main style={{ background: BG, color: INK, fontFamily: SANS, minHeight: "100vh" }}>
      <div className="bg-amber-300 text-[#0F1D2E] text-center text-xs sm:text-sm font-semibold py-1.5">
        MOCKUP · Building rankings · MONO style.{" "}
        <Link href="/mock/building-rankings-bento" className="underline">Bento →</Link>{" "}
        <span className="opacity-50">|</span>{" "}
        <Link href="/mock/building-rankings-aurora" className="underline">Aurora →</Link>{" "}
        <span className="opacity-50">|</span>{" "}
        <Link href="/mock/building-rankings-editorial" className="underline">Editorial →</Link>
      </div>

      <div className="max-w-[1240px] mx-auto px-6 sm:px-10 py-12 sm:py-20">

        {/* Hero — restrained Linear style */}
        <header className="mb-16 sm:mb-20">
          <div className="flex items-center gap-2 mb-7">
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: ACCENT }} />
            <MonoLabel color={INK_MUTE}>NYC · Building rankings · {compact(CITY_TOTALS.buildings)} indexed</MonoLabel>
          </div>
          <h1 style={{ fontFamily: SANS, fontSize: "clamp(44px, 6vw, 72px)", lineHeight: 1.02, letterSpacing: "-0.04em", margin: 0, fontWeight: 600, color: INK }}>
            Every building, ranked.
            <br />
            <span style={{ color: INK_MUTE, fontWeight: 500 }}>Receipts included.</span>
          </h1>
          <p style={{ fontSize: "clamp(16px, 1.4vw, 19px)", lineHeight: 1.55, color: INK_SOFT, maxWidth: 640, margin: "20px 0 0", fontWeight: 400 }}>
            Pull up any one of {compact(CITY_TOTALS.buildings)} indexed buildings. Violations, evictions,
            lawsuits, tenant ratings, LucidIQ — in one search.
          </p>

          <div className="mt-8 max-w-2xl">
            <div className="flex items-center" style={{ background: SURFACE, border: `1px solid ${HAIR_HI}`, borderRadius: 10, padding: 4 }}>
              <span style={{ padding: "0 12px", color: INK_FAINT }}>
                <Search size={18} strokeWidth={2} />
              </span>
              <input
                type="text"
                placeholder="Search any building by address…"
                className="flex-1 bg-transparent py-3 text-base focus:outline-none"
                style={{ fontFamily: SANS, color: INK }}
              />
              <button className="px-5 py-2.5 font-medium text-white text-sm flex items-center gap-2" style={{ background: INK, borderRadius: 7 }}>
                Search
                <ArrowRight size={15} strokeWidth={2.5} />
              </button>
            </div>
            <div className="mt-3 flex items-center gap-2" style={{ fontFamily: MONO, fontSize: 11, color: INK_FAINT, letterSpacing: "0.04em" }}>
              <span>↑↓</span>
              <span>navigate</span>
              <span style={{ color: HAIR_HI }}>·</span>
              <span>↵</span>
              <span>select</span>
              <span style={{ color: HAIR_HI }}>·</span>
              <span>esc</span>
              <span>close</span>
            </div>
          </div>
        </header>

        {/* Stats row — sharp grid, no fills, just dividers */}
        <section className="mb-16 sm:mb-20">
          <div className="grid grid-cols-2 lg:grid-cols-5" style={{ background: SURFACE, border: `1px solid ${HAIR_HI}`, borderRadius: 12, overflow: "hidden" }}>
            {[
              { k: "Indexed", v: compact(CITY_TOTALS.buildings), s: "buildings tracked", c: INK },
              { k: "Cited", v: compact(CITY_TOTALS.buildingsWithViolations), s: "with open violations", c: ACCENT },
              { k: "Total open", v: compact(CITY_TOTALS.totalViolations), s: "violations citywide", c: ACCENT },
              { k: "Logged", v: compact(CITY_TOTALS.totalComplaints), s: "311 complaints, 12mo", c: INK },
              { k: "Filed", v: compact(CITY_TOTALS.evictionsLastYear), s: "evictions, last year", c: ACCENT },
            ].map((s, i) => (
              <div key={s.k} className="p-6" style={{ borderRight: i < 4 ? `1px solid ${HAIR}` : "none", borderTop: i >= 2 && i < 5 ? `1px solid ${HAIR}` : "none" }}>
                <MonoLabel color={INK_MUTE}>{s.k}</MonoLabel>
                <div style={{ fontSize: 30, fontWeight: 600, lineHeight: 1.1, marginTop: 8, color: s.c, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.025em" }}>
                  {s.v}
                </div>
                <div style={{ fontSize: 12, color: INK_MUTE, marginTop: 4 }}>{s.s}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Hall of worst — bento mosaic, monochrome with crimson signal */}
        <section className="mb-16 sm:mb-20">
          <div className="flex items-baseline justify-between mb-7">
            <div>
              <MonoLabel color={ACCENT}>01 / Hall of worst</MonoLabel>
              <h2 style={{ fontSize: "clamp(28px, 3.2vw, 40px)", lineHeight: 1.05, letterSpacing: "-0.03em", margin: "8px 0 0", fontWeight: 600, color: INK }}>
                Top six by violations
              </h2>
            </div>
            <MonoLabel>NYC · all boroughs</MonoLabel>
          </div>

          <div className="grid grid-cols-12 gap-3">
            {/* Featured #1 — large white card with red signal */}
            <Link href="#" className="col-span-12 lg:col-span-7 p-7 sm:p-8 flex flex-col group" style={{ background: SURFACE, border: `1px solid ${HAIR_HI}`, borderRadius: 16, color: "inherit", textDecoration: "none" }}>
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                  <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.06em", color: INK_MUTE, fontWeight: 500 }}>
                    01 / 06
                  </span>
                  <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 5, background: ACCENT_SOFT, color: ACCENT, fontWeight: 500, fontFamily: MONO, letterSpacing: "0.04em" }}>
                    Worst overall
                  </span>
                </div>
                <Trophy size={16} strokeWidth={2} style={{ color: INK_FAINT }} />
              </div>
              <h3 style={{ fontSize: "clamp(22px, 2.8vw, 32px)", lineHeight: 1.1, letterSpacing: "-0.025em", margin: 0, fontWeight: 600, color: INK }}>
                {HALL_OF_WORST[0].address}
              </h3>
              <div style={{ fontSize: 14, color: INK_MUTE, marginTop: 6, fontFamily: MONO, letterSpacing: "0.02em" }}>
                {HALL_OF_WORST[0].borough.toLowerCase()} · {HALL_OF_WORST[0].zip} · {HALL_OF_WORST[0].units.toLocaleString()} units · built {HALL_OF_WORST[0].yearBuilt}
              </div>
              <div className="grid grid-cols-4 gap-6 mt-7 pt-6" style={{ borderTop: `1px solid ${HAIR}` }}>
                {[
                  { k: "Violations", v: HALL_OF_WORST[0].violations.toLocaleString(), c: ACCENT },
                  { k: "Complaints", v: HALL_OF_WORST[0].complaints.toLocaleString(), c: INK },
                  { k: "Evictions", v: HALL_OF_WORST[0].evictions.toString(), c: ACCENT },
                  { k: "LucidIQ", v: HALL_OF_WORST[0].lucidIQ + "/100", c: ACCENT },
                ].map((s) => (
                  <div key={s.k}>
                    <MonoLabel>{s.k}</MonoLabel>
                    <div style={{ fontSize: 26, fontWeight: 600, marginTop: 4, color: s.c, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.025em", lineHeight: 1.1 }}>
                      {s.v}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 pt-5 flex items-center justify-between" style={{ borderTop: `1px solid ${HAIR}` }}>
                <div style={{ fontSize: 13, color: INK_SOFT }}>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: INK_MUTE, letterSpacing: "0.04em", textTransform: "uppercase", marginRight: 8 }}>Owner</span>
                  <span style={{ color: INK, fontWeight: 500 }}>{HALL_OF_WORST[0].ownerName}</span>
                </div>
                <span style={{ fontSize: 13, color: INK_MUTE, display: "inline-flex", alignItems: "center", gap: 4 }}>
                  Open file <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
            </Link>

            {/* #2 — tall, monochrome with single red number */}
            <Link href="#" className="col-span-12 sm:col-span-6 lg:col-span-5 p-7 flex flex-col justify-between" style={{ background: SURFACE_2, border: `1px solid ${HAIR_HI}`, borderRadius: 16, color: "inherit", textDecoration: "none", minHeight: 320 }}>
              <div>
                <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.06em", color: INK_MUTE, fontWeight: 500 }}>02 / 06</span>
                <h3 style={{ fontSize: 24, lineHeight: 1.15, letterSpacing: "-0.02em", margin: "10px 0 0", fontWeight: 600, color: INK }}>
                  {HALL_OF_WORST[1].address}
                </h3>
                <div style={{ fontSize: 13, color: INK_MUTE, marginTop: 6, fontFamily: MONO, letterSpacing: "0.02em" }}>
                  {HALL_OF_WORST[1].borough.toLowerCase()} · {HALL_OF_WORST[1].units.toLocaleString()} units
                </div>
              </div>
              <div>
                <div style={{ fontSize: 64, fontWeight: 600, lineHeight: 0.95, color: ACCENT, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.04em" }}>
                  {compact(HALL_OF_WORST[1].violations)}
                </div>
                <MonoLabel>open violations</MonoLabel>
                <div className="mt-4 pt-4 grid grid-cols-3 gap-4" style={{ borderTop: `1px solid ${HAIR}` }}>
                  <div>
                    <MonoLabel>Evict</MonoLabel>
                    <div style={{ fontSize: 16, fontWeight: 600, color: INK, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{HALL_OF_WORST[1].evictions}</div>
                  </div>
                  <div>
                    <MonoLabel>Cases</MonoLabel>
                    <div style={{ fontSize: 16, fontWeight: 600, color: INK, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{HALL_OF_WORST[1].lawsuits}</div>
                  </div>
                  <div>
                    <MonoLabel>IQ</MonoLabel>
                    <div style={{ fontSize: 16, fontWeight: 600, color: ACCENT, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{HALL_OF_WORST[1].lucidIQ}</div>
                  </div>
                </div>
              </div>
            </Link>

            {/* #3-6 — clean white tiles */}
            {HALL_OF_WORST.slice(2, 6).map((b, idx) => (
              <Link key={b.address} href="#" className="col-span-6 sm:col-span-6 lg:col-span-3 p-5 flex flex-col group" style={{ background: SURFACE, border: `1px solid ${HAIR_HI}`, borderRadius: 14, color: "inherit", textDecoration: "none", minHeight: 200 }}>
                <div className="flex items-center justify-between mb-3">
                  <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.06em", color: INK_FAINT, fontWeight: 500 }}>
                    0{idx + 3} / 06
                  </span>
                  <ChevronRight size={14} style={{ color: INK_FAINT }} className="group-hover:translate-x-0.5 transition-transform" />
                </div>
                <h3 style={{ fontSize: 14, lineHeight: 1.25, letterSpacing: "-0.01em", margin: 0, fontWeight: 600, color: INK, minHeight: "2.4em", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {b.address}
                </h3>
                <div style={{ fontSize: 11, color: INK_MUTE, marginTop: 4, fontFamily: MONO, letterSpacing: "0.02em" }}>
                  {b.borough.toLowerCase()} · {b.units} units
                </div>
                <div style={{ marginTop: "auto", paddingTop: 14 }}>
                  <div style={{ fontSize: 28, fontWeight: 600, lineHeight: 0.95, color: ACCENT, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.025em" }}>
                    {compact(b.violations)}
                  </div>
                  <div style={{ fontSize: 11, color: INK_MUTE, marginTop: 4, fontFamily: MONO, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                    viol · IQ {b.lucidIQ}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Six rankings — clean two-column grid */}
        <section className="mb-16 sm:mb-20">
          <div className="flex items-baseline justify-between mb-7">
            <div>
              <MonoLabel color={INK_MUTE}>02 / Six rankings</MonoLabel>
              <h2 style={{ fontSize: "clamp(28px, 3.2vw, 40px)", lineHeight: 1.05, letterSpacing: "-0.03em", margin: "8px 0 0", fontWeight: 600, color: INK }}>
                Sorted by signal
              </h2>
            </div>
            <MonoLabel>Top 3 each</MonoLabel>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {RANKING_STRIPS.map((strip, idx) => {
              const Icon = [Trophy, Flame, Scale, Building2, FileWarning, Snowflake][idx];
              return (
                <div key={strip.id} className="p-5 sm:p-6" style={{ background: SURFACE, borderRadius: 14, border: `1px solid ${HAIR_HI}` }}>
                  <div className="flex items-start justify-between mb-5 pb-4" style={{ borderBottom: `1px solid ${HAIR}` }}>
                    <div className="flex items-center gap-3">
                      <span style={{ width: 32, height: 32, borderRadius: 8, background: SURFACE_2, color: INK_2, display: "inline-flex", alignItems: "center", justifyContent: "center", border: `1px solid ${HAIR_HI}` }}>
                        <Icon size={14} strokeWidth={2.25} />
                      </span>
                      <div>
                        <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0, color: INK, lineHeight: 1.2, letterSpacing: "-0.01em" }}>{strip.label}</h3>
                        <div style={{ fontSize: 11, color: INK_MUTE, marginTop: 2 }}>{strip.description}</div>
                      </div>
                    </div>
                    {strip.metroOnly && (
                      <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase", color: INK_MUTE, fontWeight: 500, padding: "2px 6px", border: `1px solid ${HAIR_HI}`, borderRadius: 4 }}>
                        nyc
                      </span>
                    )}
                  </div>
                  <ol className="m-0 p-0 list-none">
                    {strip.top3.map((r, i) => (
                      <li key={r.address} className="flex items-center gap-3 py-2.5 group" style={{ borderTop: i > 0 ? `1px solid ${HAIR}` : "none" }}>
                        <span style={{ width: 20, height: 20, borderRadius: 5, background: i === 0 ? ACCENT_SOFT : SURFACE_2, color: i === 0 ? ACCENT : INK_MUTE, fontSize: 11, fontWeight: 600, display: "inline-flex", alignItems: "center", justifyContent: "center", fontVariantNumeric: "tabular-nums", flexShrink: 0, fontFamily: MONO }}>
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div style={{ fontSize: 13, fontWeight: 600, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-0.005em" }}>
                            {r.address}
                          </div>
                          <div style={{ fontFamily: MONO, fontSize: 11, color: INK_MUTE, marginTop: 1, fontVariantNumeric: "tabular-nums", letterSpacing: "0.02em" }}>
                            <span style={{ color: i === 0 ? ACCENT : INK, fontWeight: 600 }}>
                              {strip.unit === "viol/unit" ? r.value.toFixed(2) : r.value.toLocaleString()}
                            </span>
                            <span style={{ textTransform: "lowercase" }}> {strip.unit}</span> · {r.sub}
                          </div>
                        </div>
                        <ChevronRight size={14} style={{ color: INK_FAINT, flexShrink: 0 }} className="group-hover:translate-x-0.5 transition-transform" />
                      </li>
                    ))}
                  </ol>
                </div>
              );
            })}
          </div>
        </section>

        {/* Tenant favorites — muted green band, only place green appears */}
        <section className="mb-16 sm:mb-20">
          <div className="flex items-baseline justify-between mb-7">
            <div>
              <MonoLabel color={GREEN}>03 / Tenant favorites</MonoLabel>
              <h2 style={{ fontSize: "clamp(28px, 3.2vw, 40px)", lineHeight: 1.05, letterSpacing: "-0.03em", margin: "8px 0 0", fontWeight: 600, color: INK }}>
                Top rated buildings
              </h2>
            </div>
            <MonoLabel>50+ reviews</MonoLabel>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {HALL_OF_BEST.map((b, idx) => (
              <Link key={b.address} href="#" className="p-5 flex flex-col group" style={{ background: SURFACE, border: `1px solid ${HAIR_HI}`, borderRadius: 14, color: "inherit", textDecoration: "none", minHeight: 190 }}>
                <div className="flex items-center justify-between mb-3">
                  <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.06em", color: INK_FAINT, fontWeight: 500 }}>
                    0{idx + 1} / 05
                  </span>
                  <Sparkles size={14} style={{ color: GREEN }} />
                </div>
                <h3 style={{ fontSize: 14, lineHeight: 1.25, letterSpacing: "-0.01em", margin: 0, fontWeight: 600, color: INK, minHeight: "2.4em", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {b.address}
                </h3>
                <div style={{ fontSize: 11, color: INK_MUTE, marginTop: 4, fontFamily: MONO, letterSpacing: "0.02em" }}>
                  {b.borough.toLowerCase()} · {b.yearBuilt}
                </div>
                <div style={{ marginTop: "auto", paddingTop: 14 }}>
                  <div style={{ fontSize: 26, fontWeight: 600, lineHeight: 1, color: GREEN, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.025em" }}>
                    {b.rating.toFixed(1)}<span style={{ fontSize: 14 }}>★</span>
                  </div>
                  <div style={{ fontSize: 11, color: INK_MUTE, marginTop: 4, fontFamily: MONO, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                    {b.reviewCount} reviews · IQ {b.lucidIQ}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Directory */}
        <section className="mb-16 sm:mb-20">
          <div className="flex items-baseline justify-between mb-7">
            <div>
              <MonoLabel color={INK_MUTE}>04 / Directory</MonoLabel>
              <h2 style={{ fontSize: "clamp(28px, 3.2vw, 40px)", lineHeight: 1.05, letterSpacing: "-0.03em", margin: "8px 0 0", fontWeight: 600, color: INK }}>
                Browse all buildings
              </h2>
            </div>
            <MonoLabel>{compact(CITY_TOTALS.buildings)} total</MonoLabel>
          </div>

          <div className="flex flex-wrap gap-2 mb-5">
            {["Violations", "Complaints", "Evictions", "Per-unit", "Lawsuits", "No-heat"].map((s, i) => (
              <button key={s} className="px-3.5 py-1.5 text-sm font-medium transition-colors" style={{ background: i === 0 ? INK : SURFACE, color: i === 0 ? "#fff" : INK_SOFT, borderRadius: 7, border: `1px solid ${i === 0 ? INK : HAIR_HI}` }}>
                {s}
              </button>
            ))}
          </div>

          <div style={{ background: SURFACE, borderRadius: 14, border: `1px solid ${HAIR_HI}`, overflow: "hidden" }}>
            <ol className="m-0 p-0 list-none">
              {HALL_OF_WORST.slice(0, 5).map((b, idx) => (
                <li key={b.address} className="group" style={{ borderTop: idx > 0 ? `1px solid ${HAIR}` : "none" }}>
                  <Link href="#" className="flex items-center gap-4 sm:gap-6 px-5 sm:px-7 py-4 sm:py-5 transition-colors hover:bg-[#f7f7f9]" style={{ textDecoration: "none", color: "inherit" }}>
                    <span style={{ minWidth: 36, fontFamily: MONO, fontSize: 14, fontWeight: 500, color: INK_FAINT, fontVariantNumeric: "tabular-nums" }}>
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <div className="flex-1 min-w-0">
                      <h3 style={{ fontSize: "clamp(15px, 1.3vw, 17px)", fontWeight: 600, margin: "0 0 2px", color: INK, letterSpacing: "-0.01em" }}>
                        {b.address}
                      </h3>
                      <div style={{ fontSize: 12, color: INK_MUTE, marginBottom: 6, fontFamily: MONO, letterSpacing: "0.02em" }}>
                        {b.borough.toLowerCase()} · {b.zip} · {b.units.toLocaleString()} units · {b.ownerName}
                      </div>
                      <div className="flex flex-wrap gap-x-5 gap-y-1" style={{ fontFamily: MONO, fontSize: 11, color: INK_MUTE, fontVariantNumeric: "tabular-nums", letterSpacing: "0.02em" }}>
                        <span><span style={{ color: ACCENT, fontWeight: 600 }}>{b.violations.toLocaleString()}</span> viol</span>
                        <span><span style={{ color: INK, fontWeight: 600 }}>{b.complaints.toLocaleString()}</span> calls</span>
                        <span><span style={{ color: ACCENT, fontWeight: 600 }}>{b.evictions}</span> evict</span>
                        <span><span style={{ color: INK, fontWeight: 600 }}>{b.lawsuits}</span> cases</span>
                        <span><span style={{ color: ACCENT, fontWeight: 600 }}>IQ {b.lucidIQ}</span></span>
                      </div>
                    </div>
                    <ArrowUpRight size={16} style={{ color: INK_FAINT, flexShrink: 0 }} className="group-hover:scale-110 transition-transform" />
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* CTA — clean dark band */}
        <section className="p-8 sm:p-10" style={{ background: INK, borderRadius: 18, color: "#fff" }}>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 items-center">
            <div>
              <MonoLabel color="rgba(255,255,255,0.5)">Tenant testimony</MonoLabel>
              <h2 style={{ fontSize: "clamp(24px, 2.8vw, 36px)", lineHeight: 1.1, letterSpacing: "-0.03em", margin: "8px 0 12px", fontWeight: 600 }}>
                Add your receipts to the record.
              </h2>
              <p style={{ fontSize: 15, color: "rgba(255,255,255,0.65)", maxWidth: 560, margin: 0, lineHeight: 1.5 }}>
                Public records show what was reported. Reviews from former tenants show what it was actually like.
              </p>
            </div>
            <Link href="/nyc/review/new" className="inline-flex items-center gap-2 px-5 py-3 font-medium" style={{ background: "#fff", color: INK, borderRadius: 8, fontSize: 15, whiteSpace: "nowrap" }}>
              Write a review
              <ArrowRight size={16} strokeWidth={2.5} />
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

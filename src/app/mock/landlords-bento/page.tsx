import type { Metadata } from "next";
import Link from "next/link";
import { Search, ArrowRight, ArrowUpRight, Building2, Trophy, Flame, Scale, FileWarning } from "lucide-react";
import { HALL_OF_SHAME, RANKING_STRIPS, CITY_TOTALS } from "../_landlords-mock-data";

export const metadata: Metadata = {
  title: "Mockup · Landlords (Bento)",
  robots: { index: false, follow: false },
};

const SANS = `"Geist", "Inter", system-ui, sans-serif`;
const MONO = `"Geist Mono", ui-monospace, monospace`;
const INK = "#0a0e1a";
const INK_SOFT = "#3a3f54";
const INK_MUTE = "#73798f";
const PAPER = "#fafbfd";
const BORDER = "rgba(10,14,26,0.08)";

// Soft gradient palette — Apple/Linear feel, low saturation
const G = {
  rose:    "linear-gradient(135deg, #fff0f4 0%, #ffd6e3 100%)",
  iris:    "linear-gradient(135deg, #f0eaff 0%, #d9d0ff 100%)",
  sky:     "linear-gradient(135deg, #e6f1ff 0%, #c5dcff 100%)",
  mint:    "linear-gradient(135deg, #e0f7ee 0%, #b8efd6 100%)",
  amber:   "linear-gradient(135deg, #fff5dc 0%, #ffe5a8 100%)",
  peach:   "linear-gradient(135deg, #fff0e8 0%, #ffd2bc 100%)",
  graphite: "linear-gradient(135deg, #1a1d2b 0%, #0a0e1a 100%)",
};
const ACCENT = {
  rose:    "#ec4899",
  iris:    "#7c3aed",
  sky:     "#3b82f6",
  mint:    "#10b981",
  amber:   "#f59e0b",
  peach:   "#f97316",
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
const SHADOW_HOVER = "0 1px 2px rgba(10,14,26,0.06), 0 16px 40px -12px rgba(10,14,26,0.18)";

export default function MockLandlordsBento() {
  return (
    <main style={{ background: PAPER, color: INK, fontFamily: SANS, minHeight: "100vh" }}>
      <div className="bg-amber-300 text-[#0F1D2E] text-center text-xs sm:text-sm font-semibold py-1.5">
        MOCKUP · Landlord directory · BENTO style.{" "}
        <Link href="/mock/landlords-magazine" className="underline">Magazine version →</Link>{" "}
        <span className="opacity-50">|</span>{" "}
        <Link href="/mock/landlords-aurora" className="underline">Aurora version →</Link>
      </div>

      <div className="max-w-[1320px] mx-auto px-6 sm:px-10 py-12 sm:py-16">

        {/* Hero */}
        <header className="mb-10 sm:mb-14">
          <div className="flex items-center gap-2 mb-6">
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: ACCENT.rose }} />
            <MonoLabel>NYC · Landlord Index · {CITY_TOTALS.landlords.toLocaleString()} indexed</MonoLabel>
          </div>
          <h1 style={{ fontFamily: SANS, fontSize: "clamp(48px, 7vw, 84px)", lineHeight: 1.0, letterSpacing: "-0.035em", margin: 0, fontWeight: 700, color: INK }}>
            Every landlord in{" "}
            <span style={{ background: "linear-gradient(135deg, #ec4899, #7c3aed 60%, #3b82f6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              New York City.
            </span>
          </h1>
          <p style={{ fontSize: "clamp(17px, 1.5vw, 21px)", lineHeight: 1.5, color: INK_SOFT, maxWidth: 720, margin: "20px 0 0", fontWeight: 400 }}>
            Look up any one of {CITY_TOTALS.landlords.toLocaleString()} indexed owners.
            Click through to the full portfolio, violation history, and the worst building in their book.
          </p>

          {/* Search input */}
          <div className="mt-8 max-w-2xl">
            <div className="flex items-center" style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, padding: 6, boxShadow: SHADOW }}>
              <span style={{ padding: "0 14px", color: INK_MUTE }}>
                <Search size={20} strokeWidth={2} />
              </span>
              <input
                type="text"
                placeholder="Search any landlord by name…"
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

        {/* Stats Bento */}
        <section className="mb-10 sm:mb-14">
          <div className="grid grid-cols-12 grid-rows-[auto] gap-4">
            {/* Big featured: total landlords */}
            <div className="col-span-12 md:col-span-6 row-span-2 p-7 sm:p-9 flex flex-col justify-between" style={{ background: G.rose, borderRadius: 24, minHeight: 220 }}>
              <div>
                <MonoLabel color={ACCENT.rose}>Total indexed</MonoLabel>
                <div style={{ fontSize: "clamp(56px, 7vw, 96px)", fontWeight: 800, lineHeight: 0.9, letterSpacing: "-0.04em", marginTop: 14, color: INK, fontVariantNumeric: "tabular-nums" }}>
                  {CITY_TOTALS.landlords.toLocaleString()}
                </div>
                <p style={{ marginTop: 12, fontSize: 14, color: INK_SOFT, maxWidth: 360 }}>
                  Every NYC owner of record, from individuals to LLCs, holding companies, and city agencies.
                </p>
              </div>
              <div className="flex items-center gap-3 mt-6">
                <span style={{ background: "rgba(255,255,255,0.7)", padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, color: INK }}>
                  Live · cached 60m
                </span>
              </div>
            </div>

            <div className="col-span-6 md:col-span-3 p-6" style={{ background: G.sky, borderRadius: 20 }}>
              <MonoLabel color={ACCENT.sky}>Buildings</MonoLabel>
              <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1, marginTop: 8, color: INK, fontVariantNumeric: "tabular-nums" }}>
                {compact(CITY_TOTALS.buildings)}
              </div>
              <div style={{ fontSize: 12, color: INK_SOFT, marginTop: 6 }}>tracked across portfolios</div>
            </div>

            <div className="col-span-6 md:col-span-3 p-6" style={{ background: G.iris, borderRadius: 20 }}>
              <MonoLabel color={ACCENT.iris}>Violations</MonoLabel>
              <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1, marginTop: 8, color: INK, fontVariantNumeric: "tabular-nums" }}>
                {compact(CITY_TOTALS.violations)}
              </div>
              <div style={{ fontSize: 12, color: INK_SOFT, marginTop: 6 }}>open citations, all sources</div>
            </div>

            <div className="col-span-6 md:col-span-3 p-6" style={{ background: G.amber, borderRadius: 20 }}>
              <MonoLabel color={ACCENT.amber}>311 complaints</MonoLabel>
              <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1, marginTop: 8, color: INK, fontVariantNumeric: "tabular-nums" }}>
                {compact(CITY_TOTALS.complaints)}
              </div>
              <div style={{ fontSize: 12, color: INK_SOFT, marginTop: 6 }}>filed against owned buildings</div>
            </div>

            <div className="col-span-6 md:col-span-3 p-6" style={{ background: G.mint, borderRadius: 20 }}>
              <MonoLabel color={ACCENT.mint}>Open litigation</MonoLabel>
              <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1, marginTop: 8, color: INK, fontVariantNumeric: "tabular-nums" }}>
                {compact(CITY_TOTALS.litigations)}
              </div>
              <div style={{ fontSize: 12, color: INK_SOFT, marginTop: 6 }}>active court cases</div>
            </div>
          </div>
        </section>

        {/* Hall of Shame — Bento mosaic */}
        <section className="mb-10 sm:mb-14">
          <div className="flex items-baseline justify-between mb-6">
            <div>
              <MonoLabel color={ACCENT.rose}>Section 01</MonoLabel>
              <h2 style={{ fontSize: "clamp(28px, 3.5vw, 44px)", lineHeight: 1.05, letterSpacing: "-0.025em", margin: "6px 0 0", fontWeight: 700, color: INK }}>
                Hall of shame
              </h2>
            </div>
            <MonoLabel>Top 6 by violations</MonoLabel>
          </div>

          <div className="grid grid-cols-12 gap-4">
            {/* Featured #1 — large */}
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
              <h3 style={{ fontSize: "clamp(24px, 3vw, 36px)", lineHeight: 1.05, letterSpacing: "-0.02em", margin: "0 0 18px", fontWeight: 700, color: INK }}>
                {HALL_OF_SHAME[0].name}
              </h3>
              <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                  { k: "Violations", v: HALL_OF_SHAME[0].violations.toLocaleString(), c: ACCENT.rose },
                  { k: "Complaints", v: HALL_OF_SHAME[0].complaints.toLocaleString(), c: ACCENT.amber },
                  { k: "Cases", v: HALL_OF_SHAME[0].litigations.toLocaleString(), c: ACCENT.iris },
                ].map((s) => (
                  <div key={s.k}>
                    <MonoLabel>{s.k}</MonoLabel>
                    <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4, color: s.c, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
                      {s.v}
                    </div>
                  </div>
                ))}
              </div>
              <div className="pt-5" style={{ borderTop: `1px solid ${BORDER}` }}>
                <MonoLabel color={ACCENT.rose}>Worst building</MonoLabel>
                <div style={{ marginTop: 6, fontSize: 14, color: INK_SOFT }}>
                  {HALL_OF_SHAME[0].worstAddr} · <strong style={{ color: INK }}>{HALL_OF_SHAME[0].worstViol.toLocaleString()} viol.</strong>
                </div>
              </div>
            </Link>

            {/* #2 — vertical */}
            <Link href="#" className="col-span-12 sm:col-span-6 lg:col-span-5 p-6 sm:p-7 flex flex-col justify-between" style={{ background: G.iris, borderRadius: 24, textDecoration: "none", color: "inherit", minHeight: 280 }}>
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.1em", color: ACCENT.iris, fontWeight: 700 }}>NO. 02</span>
                </div>
                <h3 style={{ fontSize: 22, lineHeight: 1.15, letterSpacing: "-0.015em", margin: 0, fontWeight: 700, color: INK }}>
                  {HALL_OF_SHAME[1].name}
                </h3>
              </div>
              <div className="mt-6">
                <div style={{ fontSize: 56, fontWeight: 800, lineHeight: 0.9, color: INK, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.03em" }}>
                  {compact(HALL_OF_SHAME[1].violations)}
                </div>
                <MonoLabel color={INK_SOFT}>violations on record</MonoLabel>
                <div style={{ marginTop: 10, fontSize: 12, color: INK_SOFT }}>
                  {HALL_OF_SHAME[1].buildings} bldg · {HALL_OF_SHAME[1].litigations} cases
                </div>
              </div>
            </Link>

            {/* #3-6 — small uniform */}
            {HALL_OF_SHAME.slice(2, 6).map((l, idx) => {
              const palette = [G.amber, G.mint, G.peach, G.sky][idx];
              const accent = [ACCENT.amber, ACCENT.mint, ACCENT.peach, ACCENT.sky][idx];
              return (
                <Link key={l.name} href="#" className="col-span-6 sm:col-span-6 lg:col-span-3 p-5 sm:p-6 flex flex-col" style={{ background: palette, borderRadius: 20, textDecoration: "none", color: "inherit", minHeight: 200 }}>
                  <div className="flex items-center justify-between mb-3">
                    <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", color: accent, fontWeight: 700 }}>
                      NO. {String(idx + 3).padStart(2, "0")}
                    </span>
                  </div>
                  <h3 style={{ fontSize: 15, lineHeight: 1.2, letterSpacing: "-0.005em", margin: 0, fontWeight: 700, color: INK, minHeight: "2.4em", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {l.name}
                  </h3>
                  <div style={{ marginTop: "auto", paddingTop: 14 }}>
                    <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 0.9, color: INK, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
                      {compact(l.violations)}
                    </div>
                    <div style={{ fontSize: 11, color: INK_SOFT, marginTop: 4, fontFamily: MONO, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      viol · {l.buildings} bldg
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Rankings — clean cards */}
        <section className="mb-10 sm:mb-14">
          <div className="flex items-baseline justify-between mb-6">
            <div>
              <MonoLabel color={ACCENT.iris}>Section 02</MonoLabel>
              <h2 style={{ fontSize: "clamp(28px, 3.5vw, 44px)", lineHeight: 1.05, letterSpacing: "-0.025em", margin: "6px 0 0", fontWeight: 700, color: INK }}>
                Rankings
              </h2>
            </div>
            <MonoLabel>5 lenses · top 3 each</MonoLabel>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {RANKING_STRIPS.map((strip, idx) => {
              const palette = [G.rose, G.iris, G.sky, G.mint, G.amber][idx];
              const accent = [ACCENT.rose, ACCENT.iris, ACCENT.sky, ACCENT.mint, ACCENT.amber][idx];
              const Icon = [Trophy, Flame, Scale, FileWarning, Building2][idx];
              return (
                <div key={strip.id} className="p-5 sm:p-6" style={{ background: "#fff", borderRadius: 20, border: `1px solid ${BORDER}`, boxShadow: SHADOW }}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span style={{ width: 36, height: 36, borderRadius: 12, background: palette, color: accent, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                        <Icon size={16} strokeWidth={2.25} />
                      </span>
                      <div>
                        <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: INK, lineHeight: 1.2 }}>{strip.label}</h3>
                        <Link href="#" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: accent, fontWeight: 700, textDecoration: "none" }}>
                          See all →
                        </Link>
                      </div>
                    </div>
                  </div>
                  <ol className="m-0 p-0 list-none">
                    {strip.top3.map((r, i) => (
                      <li key={r.name} className="flex items-center gap-3 py-3" style={{ borderTop: i > 0 ? `1px solid ${BORDER}` : "none" }}>
                        <span style={{ width: 24, height: 24, borderRadius: 8, background: palette, color: accent, fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div style={{ fontSize: 13, fontWeight: 600, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {r.name}
                          </div>
                          <div style={{ fontFamily: MONO, fontSize: 11, color: INK_MUTE, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
                            <span style={{ color: INK, fontWeight: 700 }}>{r.value.toLocaleString()}</span>
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

        {/* Directory excerpt */}
        <section className="mb-10 sm:mb-14">
          <div className="flex items-baseline justify-between mb-6">
            <div>
              <MonoLabel color={ACCENT.sky}>Section 03</MonoLabel>
              <h2 style={{ fontSize: "clamp(28px, 3.5vw, 44px)", lineHeight: 1.05, letterSpacing: "-0.025em", margin: "6px 0 0", fontWeight: 700, color: INK }}>
                Browse the directory
              </h2>
            </div>
            <MonoLabel>{CITY_TOTALS.landlords.toLocaleString()} total</MonoLabel>
          </div>

          <div className="flex flex-wrap gap-2 mb-5">
            {["Violations", "Complaints", "Litigations", "DOB", "Buildings"].map((s, i) => (
              <button key={s} className="px-4 py-2 text-sm font-semibold transition-colors" style={{ background: i === 0 ? INK : "#fff", color: i === 0 ? "#fff" : INK_SOFT, borderRadius: 999, border: `1px solid ${i === 0 ? INK : BORDER}` }}>
                {s}
              </button>
            ))}
          </div>

          <div style={{ background: "#fff", borderRadius: 20, border: `1px solid ${BORDER}`, boxShadow: SHADOW, overflow: "hidden" }}>
            <ol className="m-0 p-0 list-none">
              {HALL_OF_SHAME.slice(0, 5).map((l, idx) => (
                <li key={l.name} className="group" style={{ borderTop: idx > 0 ? `1px solid ${BORDER}` : "none" }}>
                  <Link href="#" className="flex items-center gap-4 sm:gap-6 px-5 sm:px-7 py-4 sm:py-5 transition-colors hover:bg-[#fafbfd]" style={{ textDecoration: "none", color: "inherit" }}>
                    <span style={{ minWidth: 40, fontFamily: MONO, fontSize: 18, fontWeight: 700, color: INK_MUTE, fontVariantNumeric: "tabular-nums" }}>
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <div className="flex-1 min-w-0">
                      <h3 style={{ fontSize: "clamp(15px, 1.4vw, 18px)", fontWeight: 700, margin: "0 0 6px", color: INK, letterSpacing: "-0.005em" }}>
                        {l.name}
                      </h3>
                      <div className="flex flex-wrap gap-x-5 gap-y-1" style={{ fontFamily: MONO, fontSize: 11, color: INK_MUTE, fontVariantNumeric: "tabular-nums" }}>
                        <span><span style={{ color: ACCENT.rose, fontWeight: 700 }}>{l.violations.toLocaleString()}</span> viol</span>
                        <span><span style={{ color: ACCENT.amber, fontWeight: 700 }}>{l.complaints.toLocaleString()}</span> calls</span>
                        <span><span style={{ color: ACCENT.iris, fontWeight: 700 }}>{l.litigations}</span> cases</span>
                        <span><span style={{ color: INK, fontWeight: 700 }}>{l.buildings}</span> bldg</span>
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
        <section className="p-8 sm:p-12 text-center" style={{ background: "linear-gradient(135deg, #1a1d2b 0%, #0a0e1a 100%)", borderRadius: 28, color: "#fff" }}>
          <MonoLabel color="rgba(255,255,255,0.5)">Tenant testimony</MonoLabel>
          <h2 style={{ fontSize: "clamp(28px, 4vw, 48px)", lineHeight: 1.05, letterSpacing: "-0.025em", margin: "12px 0 16px", fontWeight: 700 }}>
            Add your receipts.
          </h2>
          <p style={{ fontSize: "clamp(15px, 1.4vw, 18px)", color: "rgba(255,255,255,0.7)", maxWidth: 540, margin: "0 auto 28px", lineHeight: 1.5 }}>
            Reviews from former tenants are the part of the file we can't pull from public records.
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

import type { Metadata } from "next";
import Link from "next/link";
import { Search, ArrowRight } from "lucide-react";
import { HALL_OF_SHAME, RANKING_STRIPS, CITY_TOTALS } from "../_landlords-mock-data";

export const metadata: Metadata = {
  title: "Mockup · Landlords (Magazine)",
  robots: { index: false, follow: false },
};

const SANS = `"Geist", "Inter", system-ui, sans-serif`;
const SERIF = `"Young Serif", Georgia, serif`;
const MONO = `"Geist Mono", ui-monospace, monospace`;

const PINK = "#ff3366";
const BLUE = "#1a5fff";
const PURPLE = "#7b3fff";
const AMBER = "#ffaa00";
const TEAL = "#00d9c8";
const NAVY = "#0a1428";
const INK = "#0a1428";
const PAPER = "#fafafa";

const CARD_COLORS = [
  { bg: PINK, fg: "#fff" },
  { bg: BLUE, fg: "#fff" },
  { bg: AMBER, fg: NAVY },
  { bg: PURPLE, fg: "#fff" },
  { bg: TEAL, fg: NAVY },
  { bg: NAVY, fg: "#fff" },
];

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 100_000) return `${Math.round(n / 1_000)}K`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export default function MockLandlordsMagazine() {
  return (
    <main style={{ background: PAPER, color: INK, fontFamily: SANS, minHeight: "100vh" }}>
      <div className="bg-amber-300 text-[#0F1D2E] text-center text-xs sm:text-sm font-semibold py-1.5">
        MOCKUP · Landlord directory · MAGAZINE style.{" "}
        <Link href="/mock/landlords-dossier" className="underline">Dossier version →</Link>{" "}
        <span className="opacity-50">|</span>{" "}
        <Link href="/mock/landlords-terminal" className="underline">Terminal version →</Link>
      </div>

      {/* Hero — massive bold display */}
      <header style={{ background: PAPER, borderBottom: `4px solid ${INK}` }}>
        <div className="max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-14 pt-12 pb-10">
          <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: PINK, fontWeight: 700, marginBottom: 18 }}>
            <span style={{ background: PINK, color: "#fff", padding: "3px 8px", marginRight: 10 }}>VOL 01</span>
            New York City · Landlord Index
          </div>
          <h1 style={{ fontFamily: SANS, fontSize: "clamp(72px, 14vw, 200px)", lineHeight: 0.85, letterSpacing: "-0.045em", margin: 0, fontWeight: 900, color: INK }}>
            EVERY<br/>LANDLORD.
          </h1>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8 mt-10 items-end">
            <p style={{ fontFamily: SERIF, fontSize: "clamp(20px, 2vw, 30px)", lineHeight: 1.25, maxWidth: 700, margin: 0, color: "#3a4258", fontStyle: "italic" }}>
              Searchable. Sortable. <span style={{ background: AMBER, color: NAVY, padding: "0 8px", fontStyle: "normal", fontWeight: 700 }}>Receipts.</span>
              All <span style={{ color: PINK, fontWeight: 700, fontStyle: "normal" }}>{CITY_TOTALS.landlords.toLocaleString()}</span> of them.
            </p>
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
              {[
                { v: compact(CITY_TOTALS.landlords), k: "landlords", c: PINK },
                { v: compact(CITY_TOTALS.buildings), k: "buildings", c: BLUE },
                { v: compact(CITY_TOTALS.violations), k: "violations", c: AMBER },
              ].map((s) => (
                <div key={s.k}>
                  <div style={{ fontFamily: SANS, fontSize: 38, fontWeight: 900, lineHeight: 1, color: s.c, fontVariantNumeric: "tabular-nums" }}>
                    {s.v}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "#5a6580", marginTop: 4, fontWeight: 600 }}>
                    {s.k}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Big bold search */}
          <div className="mt-10 flex items-stretch border-[3px] rounded-full overflow-hidden max-w-3xl" style={{ borderColor: INK, background: "#fff" }}>
            <span className="pl-6 pr-2 flex items-center" style={{ color: INK }}>
              <Search size={22} strokeWidth={2.5} />
            </span>
            <input
              type="text"
              placeholder="Search any landlord by name…"
              className="flex-1 px-3 py-5 text-lg sm:text-xl font-semibold focus:outline-none"
              style={{ fontFamily: SANS, color: INK }}
            />
            <button
              className="px-7 sm:px-10 font-black uppercase tracking-wider text-base"
              style={{ background: PINK, color: "#fff", fontFamily: SANS }}
            >
              SEARCH →
            </button>
          </div>
        </div>
      </header>

      {/* Section banner */}
      <div style={{ background: NAVY, color: "#fff" }}>
        <div className="max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-14 py-3 flex items-center justify-between">
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700 }}>
            ▌ The Hall of Shame
          </div>
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: AMBER }}>
            Top 6 by total violations
          </div>
        </div>
      </div>

      {/* Hall of Shame — 6 BOLD color-block cards */}
      <section className="max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-14 py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {HALL_OF_SHAME.map((l, i) => {
            const c = CARD_COLORS[i % CARD_COLORS.length];
            return (
              <Link key={l.name} href="#" className="group block transition-transform hover:-translate-y-1" style={{ background: c.bg, color: c.fg, padding: "28px 28px 24px", textDecoration: "none" }}>
                <div className="flex items-baseline justify-between mb-4">
                  <span style={{ fontFamily: SANS, fontSize: 80, fontWeight: 900, lineHeight: 0.85, letterSpacing: "-0.05em", opacity: 0.95 }}>
                    {String(l.rank).padStart(2, "0")}
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700, opacity: 0.7 }}>
                    {l.city}
                  </span>
                </div>

                <h3 style={{ fontFamily: SANS, fontSize: 22, fontWeight: 800, lineHeight: 1.05, letterSpacing: "-0.015em", margin: "0 0 18px", minHeight: "2.1em" }}>
                  {l.name}
                </h3>

                <div className="flex items-baseline gap-2 mb-3">
                  <span style={{ fontFamily: SANS, fontSize: 56, fontWeight: 900, lineHeight: 0.9, letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums" }}>
                    {compact(l.violations)}
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, opacity: 0.85 }}>
                    violations
                  </span>
                </div>

                <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", opacity: 0.85, fontWeight: 600 }}>
                  {l.buildings} bldg · {compact(l.complaints)} complaints · {l.litigations} cases
                </div>

                <div className="mt-5 pt-4 flex items-center justify-between" style={{ borderTop: `2px solid ${c.fg}`, opacity: 0.95 }}>
                  <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700 }}>
                    Open file
                  </span>
                  <ArrowRight size={20} strokeWidth={2.5} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Pull quote */}
      <section style={{ background: AMBER, color: NAVY, borderTop: `4px solid ${INK}`, borderBottom: `4px solid ${INK}` }}>
        <div className="max-w-[1100px] mx-auto px-6 sm:px-10 py-14 sm:py-20">
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 700, marginBottom: 24 }}>
            ❝ From the record
          </div>
          <p style={{ fontFamily: SERIF, fontSize: "clamp(28px, 4vw, 56px)", lineHeight: 1.1, letterSpacing: "-0.02em", margin: 0, fontStyle: "italic" }}>
            765 Lincoln Avenue in Brooklyn alone carries{" "}
            <span style={{ background: NAVY, color: AMBER, padding: "0 14px", fontStyle: "normal", fontWeight: 800 }}>
              14,374 open violations
            </span>{" "}
            — more than the entire Houston system.
          </p>
          <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", marginTop: 24, fontWeight: 700 }}>
            — Linden Plaza Housing Co., Inc. · #01 in the index
          </div>
        </div>
      </section>

      {/* Section banner: Rankings */}
      <div style={{ background: NAVY, color: "#fff" }}>
        <div className="max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-14 py-3 flex items-center justify-between">
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700 }}>
            ▌ Five rankings
          </div>
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: TEAL }}>
            Top 3 per lens
          </div>
        </div>
      </div>

      {/* Rankings — 5 horizontal color-block bands */}
      <section className="max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-14 py-10">
        <div className="space-y-6">
          {RANKING_STRIPS.map((strip, i) => {
            const accent = [PINK, BLUE, AMBER, PURPLE, TEAL][i];
            return (
              <article key={strip.id} className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-0">
                <div style={{ background: accent, color: i === 2 || i === 4 ? NAVY : "#fff", padding: "26px 28px" }}>
                  <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700, opacity: 0.75 }}>
                    Lens 0{i + 1}
                  </div>
                  <h3 style={{ fontFamily: SANS, fontSize: 28, fontWeight: 900, lineHeight: 1, letterSpacing: "-0.02em", margin: "8px 0 10px" }}>
                    {strip.label}
                  </h3>
                  <Link href="#" style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700, textDecoration: "underline" }}>
                    See all →
                  </Link>
                </div>
                <ol className="grid grid-cols-1 sm:grid-cols-3 list-none m-0 p-0" style={{ background: "#fff", border: `2px solid ${INK}`, borderLeft: "none" }}>
                  {strip.top3.map((r, idx) => (
                    <li key={r.name} className={idx > 0 ? "sm:border-l-2" : ""} style={{ borderColor: INK, padding: "22px 22px 20px" }}>
                      <div style={{ fontFamily: SANS, fontSize: 60, fontWeight: 900, lineHeight: 0.85, color: accent, letterSpacing: "-0.04em" }}>
                        {idx + 1}
                      </div>
                      <h4 style={{ fontFamily: SANS, fontSize: 15, fontWeight: 700, lineHeight: 1.15, margin: "10px 0 6px", color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.name}
                      </h4>
                      <div style={{ fontFamily: MONO, fontSize: 12, color: "#5a6580", letterSpacing: "0.04em", fontVariantNumeric: "tabular-nums" }}>
                        <span style={{ color: INK, fontWeight: 800 }}>{r.value.toLocaleString()}</span>{" "}
                        <span style={{ textTransform: "lowercase" }}>{strip.unit}</span> · {r.sub}
                      </div>
                    </li>
                  ))}
                </ol>
              </article>
            );
          })}
        </div>
      </section>

      {/* Section banner: Directory */}
      <div style={{ background: NAVY, color: "#fff" }}>
        <div className="max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-14 py-3 flex items-center justify-between">
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700 }}>
            ▌ Browse the directory
          </div>
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: PINK }}>
            644,758 total
          </div>
        </div>
      </div>

      {/* Directory excerpt */}
      <section className="max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-14 py-10">
        <div className="flex flex-wrap gap-2 mb-6">
          {["Violations", "Complaints", "Litigations", "DOB", "Buildings"].map((s, i) => (
            <button key={s} className="px-4 py-2 font-bold uppercase tracking-wider text-xs border-[2px]" style={{ borderColor: INK, background: i === 0 ? INK : "transparent", color: i === 0 ? "#fff" : INK, fontFamily: SANS }}>
              {s}
            </button>
          ))}
        </div>

        <ol className="list-none m-0 p-0">
          {HALL_OF_SHAME.slice(0, 4).map((l, idx) => (
            <li key={l.name}>
              <Link href="#" className="group flex items-center gap-5 sm:gap-8 py-5 transition-colors hover:bg-[#0a1428] hover:text-white -mx-6 sm:-mx-10 lg:-mx-14 px-6 sm:px-10 lg:px-14" style={{ borderTop: idx === 0 ? `2px solid ${INK}` : "none", borderBottom: `2px solid ${INK}`, color: INK, textDecoration: "none" }}>
                <span style={{ fontFamily: SANS, fontSize: 56, fontWeight: 900, lineHeight: 0.9, color: PINK, letterSpacing: "-0.04em", minWidth: 70, fontVariantNumeric: "tabular-nums" }}>
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <div className="flex-1 min-w-0">
                  <h3 style={{ fontFamily: SANS, fontSize: "clamp(20px, 2vw, 28px)", fontWeight: 800, lineHeight: 1.1, margin: "0 0 6px", letterSpacing: "-0.01em" }}>
                    {l.name}
                  </h3>
                  <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600, opacity: 0.7 }}>
                    {l.violations.toLocaleString()} violations · {l.buildings} bldg · {l.complaints.toLocaleString()} complaints · {l.litigations} cases
                  </div>
                </div>
                <ArrowRight size={28} strokeWidth={2.5} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </li>
          ))}
        </ol>
      </section>

      {/* CTA */}
      <section style={{ background: PINK, color: "#fff", borderTop: `4px solid ${INK}` }}>
        <div className="max-w-[1100px] mx-auto px-6 sm:px-10 py-16 sm:py-24 text-center">
          <h2 style={{ fontFamily: SANS, fontSize: "clamp(48px, 8vw, 110px)", fontWeight: 900, lineHeight: 0.9, letterSpacing: "-0.04em", margin: 0 }}>
            ADD YOUR<br/>RECEIPTS.
          </h2>
          <p style={{ fontFamily: SERIF, fontSize: "clamp(18px, 2vw, 24px)", maxWidth: 560, margin: "20px auto 0", fontStyle: "italic", lineHeight: 1.4, opacity: 0.95 }}>
            Reviews from former tenants are the part of the file we can't pull from public records.
          </p>
          <Link href="/nyc/review/new" className="inline-flex items-center gap-3 mt-10 px-10 py-5 font-black uppercase tracking-wider rounded-full" style={{ background: "#fff", color: PINK, fontFamily: SANS, fontSize: 18, border: `3px solid ${INK}` }}>
            Write a review <ArrowRight size={22} strokeWidth={2.75} />
          </Link>
        </div>
      </section>
    </main>
  );
}

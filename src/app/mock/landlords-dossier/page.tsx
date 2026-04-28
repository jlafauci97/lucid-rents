import type { Metadata } from "next";
import Link from "next/link";
import { Search, FileText, ArrowRight } from "lucide-react";
import { HALL_OF_SHAME, RANKING_STRIPS, CITY_TOTALS } from "../_landlords-mock-data";

export const metadata: Metadata = {
  title: "Mockup · Landlords (Dossier)",
  robots: { index: false, follow: false },
};

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 100_000) return `${Math.round(n / 1_000)}K`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

const SERIF = `"Young Serif", "Iowan Old Style", "Palatino", Georgia, serif`;
const MONO = `"Geist Mono", ui-monospace, monospace`;
const PAPER = "#f5f1e6";
const INK = "#1a1814";
const RED = "#a8201a";
const RED_INK = "#7a1812";
const REDACT = "#1a1814";

export default function MockLandlordsDossier() {
  return (
    <main style={{ background: PAPER, color: INK, fontFamily: SERIF, minHeight: "100vh" }}>
      {/* Mock banner */}
      <div className="bg-amber-300 text-[#0F1D2E] text-center text-xs sm:text-sm font-semibold py-1.5 tracking-wide" style={{ fontFamily: 'system-ui' }}>
        MOCKUP · Landlord directory · DOSSIER style.{" "}
        <Link href="/mock/landlords-terminal" className="underline">Terminal version →</Link>{" "}
        <span className="opacity-50">|</span>{" "}
        <Link href="/mock/landlords-magazine" className="underline">Magazine version →</Link>
      </div>

      {/* File header strip — like an old case folder */}
      <div className="border-b-2" style={{ borderColor: INK, background: "rgba(0,0,0,0.04)" }}>
        <div className="max-w-6xl mx-auto px-6 py-2 flex items-center justify-between" style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase" }}>
          <span>FILE OPENED 04/27/2026</span>
          <span>CASE 644,758-LL-NYC</span>
          <span style={{ color: RED, fontWeight: 700 }}>● ACTIVE INVESTIGATION</span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 sm:px-10 py-10 sm:py-14">

        {/* Hero — investigative front page */}
        <header className="mb-12">
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: RED, marginBottom: 18, fontWeight: 700 }}>
            The Lucid Rents Investigation · NYC, Volume I
          </div>
          <h1 style={{ fontFamily: SERIF, fontSize: "clamp(48px, 8vw, 96px)", lineHeight: 0.95, letterSpacing: "-0.02em", margin: 0, fontWeight: 400 }}>
            The Landlord Dossier.
          </h1>
          <p className="mt-6 text-lg sm:text-xl max-w-3xl" style={{ fontFamily: SERIF, lineHeight: 1.5, color: "#3a3530" }}>
            An ongoing investigation into who actually owns and operates New York City's apartment buildings —
            and the records they leave behind. Search any one of {CITY_TOTALS.landlords.toLocaleString()} indexed
            owners.
          </p>

          {/* Search input — typewriter-like */}
          <div className="mt-8 max-w-2xl">
            <label style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "#5a5550", display: "block", marginBottom: 8, fontWeight: 600 }}>
              Enter name of subject →
            </label>
            <div className="flex items-stretch border-2" style={{ borderColor: INK, background: "rgba(255,255,255,0.5)" }}>
              <div className="px-4 flex items-center" style={{ borderRight: `1px solid ${INK}`, color: "#7a7570" }}>
                <Search size={18} />
              </div>
              <input
                type="text"
                placeholder="LAST NAME, FIRST NAME — or LLC"
                className="flex-1 px-4 py-4 text-lg bg-transparent focus:outline-none"
                style={{ fontFamily: MONO, letterSpacing: "0.04em", color: INK }}
              />
              <button className="px-6 font-bold uppercase tracking-widest text-sm" style={{ fontFamily: MONO, background: INK, color: PAPER }}>
                File search
              </button>
            </div>
            <p className="mt-2" style={{ fontFamily: MONO, fontSize: 10, color: "#7a7570", letterSpacing: "0.06em" }}>
              ↑ Type 2+ characters · live results · case files cross-referenced
            </p>
          </div>
        </header>

        {/* Stats panel — like a typed FBI summary */}
        <section className="border-2 mb-14" style={{ borderColor: INK, background: "rgba(255,255,255,0.4)" }}>
          <div className="px-5 py-2 border-b-2 flex items-baseline justify-between" style={{ borderColor: INK, fontFamily: MONO, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase" }}>
            <span style={{ fontWeight: 700 }}>NYC Landlord Landscape · Summary</span>
            <span style={{ color: "#7a7570" }}>cached 60 min</span>
          </div>
          <dl className="grid grid-cols-2 sm:grid-cols-5 divide-x-2" style={{ borderColor: INK }}>
            {[
              { k: "Subjects indexed", v: CITY_TOTALS.landlords.toLocaleString() },
              { k: "Buildings on file", v: compact(CITY_TOTALS.buildings) },
              { k: "Violations cited", v: compact(CITY_TOTALS.violations) },
              { k: "Complaints filed", v: compact(CITY_TOTALS.complaints) },
              { k: "Cases pending", v: compact(CITY_TOTALS.litigations) },
            ].map((s) => (
              <div key={s.k} className="px-5 py-4" style={{ borderColor: INK }}>
                <dt style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "#7a7570", marginBottom: 6, fontWeight: 600 }}>
                  {s.k}
                </dt>
                <dd style={{ fontFamily: SERIF, fontSize: 32, fontWeight: 400, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                  {s.v}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Hall of Shame — Case Files */}
        <section className="mb-14">
          <div className="flex items-baseline justify-between border-b-2 pb-3 mb-6" style={{ borderColor: INK }}>
            <div>
              <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: RED, fontWeight: 700 }}>
                Section I
              </div>
              <h2 style={{ fontFamily: SERIF, fontSize: 48, lineHeight: 1.05, margin: "4px 0 0", letterSpacing: "-0.015em" }}>
                The case files
              </h2>
            </div>
            <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "#7a7570" }}>
              Top 6 by total violations
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {HALL_OF_SHAME.map((l) => (
              <Link key={l.name} href="#" className="block border-2 group transition-all hover:shadow-[6px_6px_0_0_rgba(0,0,0,0.85)]" style={{ borderColor: INK, background: "rgba(255,255,255,0.5)" }}>
                {/* Top bar */}
                <div className="px-5 py-2 border-b-2 flex items-center justify-between" style={{ borderColor: INK, fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  <span style={{ color: RED, fontWeight: 700 }}>FILE NO. {String(l.rank).padStart(2, "0")}-44{(l.rank * 91).toString().padStart(2, "0")}</span>
                  <span className="border px-2 py-0.5 inline-block" style={{ borderColor: RED, color: RED, fontWeight: 700, transform: "rotate(-3deg)" }}>
                    Active
                  </span>
                </div>

                <div className="p-5">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-14 h-14 border-2 flex items-center justify-center flex-shrink-0" style={{ borderColor: INK, background: "rgba(0,0,0,0.06)" }}>
                      <FileText size={24} strokeWidth={1.5} />
                    </div>
                    <div>
                      <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "#7a7570", marginBottom: 4, fontWeight: 600 }}>
                        Subject
                      </div>
                      <h3 style={{ fontFamily: SERIF, fontSize: 22, lineHeight: 1.15, margin: 0, letterSpacing: "-0.005em" }}>
                        {l.name}
                      </h3>
                    </div>
                  </div>

                  {/* Charges grid */}
                  <dl className="grid grid-cols-3 gap-3 pb-4 mb-4 border-b border-dashed" style={{ borderColor: INK }}>
                    {[
                      { k: "Violations", v: l.violations.toLocaleString() },
                      { k: "Complaints", v: l.complaints.toLocaleString() },
                      { k: "Cases", v: l.litigations.toLocaleString() },
                    ].map((c) => (
                      <div key={c.k}>
                        <dt style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "#7a7570", fontWeight: 600 }}>
                          {c.k}
                        </dt>
                        <dd style={{ fontFamily: SERIF, fontSize: 20, fontVariantNumeric: "tabular-nums", marginTop: 2 }}>
                          {c.v}
                        </dd>
                      </div>
                    ))}
                  </dl>

                  {/* Worst location */}
                  <div className="mb-4">
                    <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: RED, fontWeight: 700, marginBottom: 3 }}>
                      Primary site
                    </div>
                    <div style={{ fontFamily: SERIF, fontSize: 13, color: "#3a3530" }}>
                      {l.worstAddr}
                      <span style={{ color: RED, fontWeight: 600 }}> · {l.worstViol.toLocaleString()} viol.</span>
                    </div>
                  </div>

                  <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: INK, fontWeight: 700 }} className="group-hover:underline">
                    → Open dossier
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Rankings — Chapters */}
        <section className="mb-14">
          <div className="flex items-baseline justify-between border-b-2 pb-3 mb-6" style={{ borderColor: INK }}>
            <div>
              <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: RED, fontWeight: 700 }}>
                Section II
              </div>
              <h2 style={{ fontFamily: SERIF, fontSize: 48, lineHeight: 1.05, margin: "4px 0 0", letterSpacing: "-0.015em" }}>
                Five chapters of evidence
              </h2>
            </div>
            <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "#7a7570" }}>
              Top 3 per chapter
            </span>
          </div>

          <div className="space-y-5">
            {RANKING_STRIPS.map((strip, idx) => (
              <div key={strip.id} className="border-2" style={{ borderColor: INK, background: "rgba(255,255,255,0.4)" }}>
                <div className="px-5 py-3 border-b-2 flex items-baseline gap-4" style={{ borderColor: INK }}>
                  <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: RED, fontWeight: 700 }}>
                    Ch. {String(idx + 1).padStart(2, "0")}
                  </span>
                  <h3 style={{ fontFamily: SERIF, fontSize: 22, margin: 0 }}>{strip.label}</h3>
                </div>
                <ol className="grid grid-cols-1 md:grid-cols-3 divide-y-2 md:divide-y-0 md:divide-x-2 list-none m-0 p-0" style={{ borderColor: INK }}>
                  {strip.top3.map((r, i) => (
                    <li key={r.name} className="px-5 py-4 flex items-baseline gap-4" style={{ borderColor: INK }}>
                      <span style={{ fontFamily: SERIF, fontSize: 28, color: "#7a7570", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div style={{ fontFamily: SERIF, fontSize: 15, lineHeight: 1.2, color: INK, marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {r.name}
                        </div>
                        <div style={{ fontFamily: MONO, fontSize: 11, color: "#5a5550", fontVariantNumeric: "tabular-nums" }}>
                          <span style={{ color: INK, fontWeight: 700 }}>{r.value.toLocaleString()}</span>
                          <span style={{ color: "#7a7570" }}> · {r.sub}</span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </section>

        {/* Footer CTA */}
        <section className="border-t-4 pt-10 text-center" style={{ borderColor: INK }}>
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: RED, marginBottom: 12, fontWeight: 700 }}>
            Submit testimony
          </div>
          <h2 style={{ fontFamily: SERIF, fontSize: 40, lineHeight: 1.1, margin: 0, letterSpacing: "-0.01em" }}>
            Become an investigator.
          </h2>
          <p style={{ fontFamily: SERIF, fontSize: 17, color: "#3a3530", maxWidth: 540, margin: "16px auto 24px", lineHeight: 1.5 }}>
            Reviews from former tenants are the part of the file we can't pull from public records.
            Two minutes saves the next renter from a year of mistakes.
          </p>
          <Link href="/nyc/review/new" className="inline-flex items-center gap-2 px-6 py-3 border-2 font-bold uppercase tracking-widest text-sm transition-all hover:shadow-[4px_4px_0_0_rgba(0,0,0,1)]" style={{ borderColor: INK, background: INK, color: PAPER, fontFamily: MONO }}>
            File a tenant report <ArrowRight size={14} />
          </Link>
        </section>
      </div>
    </main>
  );
}

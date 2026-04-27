import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Mockup · Rest of page (Wheatpaste)",
  robots: { index: false, follow: false },
};

const worstLandlords = [
  { rank: 1, name: "Pangea Properties", city: "CHICAGO", buildings: 89, violations: 2114 },
  { rank: 2, name: "Bronstein Properties", city: "NYC", buildings: 47, violations: 1243 },
  { rank: 3, name: "Kaufman Equities", city: "LOS ANGELES", buildings: 23, violations: 891 },
  { rank: 4, name: "Sentinel Real Estate", city: "HOUSTON", buildings: 31, violations: 712 },
  { rank: 5, name: "Riverside Holdings", city: "MIAMI", buildings: 18, violations: 503 },
  { rank: 6, name: "Wexford Property Group", city: "NYC", buildings: 26, violations: 487 },
];

const flaggedToday = [
  { ts: "12m", addr: "234 W 28th St", city: "NYC", note: "3 new HPD violations" },
  { ts: "47m", addr: "5621 Hollywood Blvd", city: "LA", note: "DBS code violation" },
  { ts: "1h", addr: "812 N Wells St", city: "CHICAGO", note: "Building court referral" },
  { ts: "2h", addr: "1010 Brickell Ave", city: "MIAMI", note: "Code enforcement notice" },
  { ts: "3h", addr: "4400 Westheimer Rd", city: "HOUSTON", note: "311 noise complaint cluster" },
  { ts: "4h", addr: "1247 Bedford Ave", city: "NYC", note: "Heat / hot water complaint" },
];

const testimony = [
  { quote: "Roaches every summer. Manager won't return calls.", addr: "1234 Lake Shore Dr", city: "CHICAGO", rot: -3 },
  { quote: "Charged a $200 'normal wear' fee. The walls were fine.", addr: "1600 Main St", city: "HOUSTON", rot: 2 },
  { quote: "The pool is gorgeous. The AC has been broken since June.", addr: "999 Brickell Bay", city: "MIAMI", rot: -1.5 },
  { quote: "Great location, terrible walls. You hear everything.", addr: "456 Sunset Blvd", city: "LA", rot: 3 },
  { quote: "Heat off for 11 days in January. Never reimbursed.", addr: "78 Avenue B", city: "NYC", rot: -2 },
  { quote: "Loud, but you knew that. Otherwise solid.", addr: "212 W Adams", city: "CHICAGO", rot: 1.5 },
];

const dossier = [
  "Building violations",
  "311 complaints",
  "Open litigation",
  "Tenant reviews",
  "Owner records",
  "Crime data",
  "Permits",
  "Scaffolding",
  "Rent stabilization",
  "Evictions",
  "Buyouts",
  "Energy ratings",
];

const stats = [
  { n: "2.8M", label: "BUILDINGS TRACKED", rot: -2 },
  { n: "11M", label: "VIOLATIONS ON RECORD", rot: 1.5 },
  { n: "500K+", label: "311 COMPLAINTS", rot: -1 },
  { n: "25+", label: "DATA SOURCES", rot: 2.5 },
];

function Stamp({ children, color = "red", rot = -8 }: { children: React.ReactNode; color?: "red" | "black"; rot?: number }) {
  const colorCls = color === "red" ? "border-red-600 text-red-600" : "border-black text-black";
  return (
    <span
      className={`inline-block border-[3px] ${colorCls} px-3 py-1 uppercase text-[11px] font-black tracking-wider`}
      style={{ transform: `rotate(${rot}deg)` }}
    >
      {children}
    </span>
  );
}

export default function MockRestWheatpaste() {
  return (
    <main className="bg-[#FFD400] text-black min-h-screen overflow-x-hidden font-sans">
      <div className="bg-black text-amber-300 text-center text-xs sm:text-sm font-semibold py-1.5 tracking-wide">
        MOCKUP · Below-the-fold · Wheatpaste / Wall-of-Shame.{" "}
        <Link href="/mock/rest-terminal" className="underline">See Terminal version →</Link>{" "}
        <span className="opacity-50">|</span>{" "}
        <Link href="/mock/hero-pano" className="underline">Back to hero</Link>
      </div>

      {/* Stats — stamped numbers */}
      <section className="border-b-4 border-black px-4 sm:px-8 py-14">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-10">
          {stats.map((s) => (
            <div key={s.label} className="text-center" style={{ transform: `rotate(${s.rot}deg)` }}>
              <div className="text-[56px] sm:text-[72px] lg:text-[88px] font-black leading-none tracking-tighter">
                {s.n}
              </div>
              <div className="mt-1 text-[10px] sm:text-xs font-black uppercase tracking-[0.15em]">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* WALL OF SHAME */}
      <section className="border-b-4 border-black px-4 sm:px-8 py-16 relative">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-end justify-between gap-4 mb-8">
            <h2 className="text-[64px] sm:text-[100px] lg:text-[140px] font-black leading-[0.85] tracking-[-0.04em] uppercase">
              Wall of<br/>Shame
            </h2>
            <Stamp color="red" rot={-6}>Updated weekly</Stamp>
          </div>

          {/* Overlapping torn cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-y-10 gap-x-6">
            {worstLandlords.map((l, i) => {
              const rot = [-2.5, 1.5, -1, 2, -2, 1][i] ?? 0;
              return (
                <article
                  key={l.rank}
                  className="relative bg-white border-[3px] border-black px-5 py-5 shadow-[6px_6px_0_0_rgba(0,0,0,1)]"
                  style={{ transform: `rotate(${rot}deg)` }}
                >
                  {/* "tape" strips */}
                  <span className="absolute -top-2 left-4 w-12 h-3 bg-red-600/80 rotate-[-3deg]" />
                  <span className="absolute -top-2 right-6 w-10 h-3 bg-red-600/80 rotate-[4deg]" />

                  <div className="flex items-baseline justify-between mb-1">
                    <div className="text-[10px] font-black uppercase tracking-widest text-red-600">No. {String(l.rank).padStart(2, "0")}</div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-black/60">{l.city}</div>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-black leading-[0.95] uppercase tracking-tight">
                    {l.name}
                  </h3>
                  <div className="mt-3 flex items-baseline gap-3">
                    <div>
                      <div className="text-3xl font-black tabular-nums">{l.violations.toLocaleString()}</div>
                      <div className="text-[9px] font-bold uppercase tracking-widest">violations</div>
                    </div>
                    <div className="text-black/40 text-2xl font-black">·</div>
                    <div>
                      <div className="text-3xl font-black tabular-nums">{l.buildings}</div>
                      <div className="text-[9px] font-bold uppercase tracking-widest">buildings</div>
                    </div>
                  </div>
                  {l.rank === 1 && (
                    <div className="absolute -bottom-3 right-4">
                      <Stamp color="red" rot={-8}>Most Wanted</Stamp>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* FLAGGED TODAY — pinned timeline */}
      <section className="border-b-4 border-black bg-black text-amber-300 px-4 sm:px-8 py-14">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-end justify-between gap-4 mb-6">
            <h2 className="text-4xl sm:text-5xl font-black uppercase tracking-tight">Flagged Today</h2>
            <Stamp color="red" rot={3}>{flaggedToday.length} new</Stamp>
          </div>
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {flaggedToday.map((e, i) => (
              <li
                key={i}
                className="bg-amber-300 text-black px-4 py-3 border-[3px] border-amber-300 relative"
                style={{ transform: `rotate(${[-1, 1, -1.5, 0.5, -0.5, 1.5][i]}deg)` }}
              >
                <div className="text-[10px] font-black uppercase tracking-widest text-red-600">{e.ts} ago · {e.city}</div>
                <div className="text-base font-black uppercase tracking-tight mt-0.5 leading-tight">{e.addr}</div>
                <div className="text-xs font-semibold mt-1">{e.note}</div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* TESTIMONY — torn-paper notes */}
      <section className="border-b-4 border-black px-4 sm:px-8 py-16 bg-[#FFD400]">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-end justify-between gap-4 mb-8">
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black uppercase tracking-tight">
              Tenant Testimony
            </h2>
            <Stamp color="black" rot={-4}>Sworn · Verbatim</Stamp>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {testimony.map((t, i) => (
              <article
                key={i}
                className="relative bg-white border-l-[6px] border-red-600 p-5 shadow-[4px_4px_0_0_rgba(0,0,0,0.85)]"
                style={{ transform: `rotate(${t.rot}deg)` }}
              >
                <span className="absolute -top-3 right-6 w-12 h-3 bg-amber-300 border border-black/30 rotate-[-3deg]" />
                <p className="text-lg sm:text-xl font-bold leading-snug italic">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="mt-3 flex items-baseline justify-between">
                  <div className="text-[11px] font-black uppercase tracking-widest">{t.addr}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-black/55">{t.city}</div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* DOSSIER — manifest */}
      <section className="border-b-4 border-black bg-white px-4 sm:px-8 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-end justify-between gap-4 mb-8">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.2em] text-red-600">Public Records · Civic Feeds · Tenant Submissions</div>
              <h2 className="text-5xl sm:text-7xl font-black uppercase tracking-tight leading-none mt-1">
                The Dossier
              </h2>
            </div>
            <Stamp color="red" rot={6}>{dossier.length} files</Stamp>
          </div>
          <ol className="grid sm:grid-cols-2 lg:grid-cols-3 gap-y-1 gap-x-8">
            {dossier.map((d, i) => (
              <li
                key={d}
                className="flex items-baseline gap-3 border-b-2 border-dotted border-black/30 py-2"
              >
                <span className="text-2xl font-black tabular-nums w-8">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-lg font-black uppercase tracking-tight">{d}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-red-600 text-amber-300 px-4 sm:px-8 py-20 text-center relative overflow-hidden">
        <h2 className="text-5xl sm:text-7xl lg:text-[120px] font-black uppercase tracking-tighter leading-[0.85]">
          Add your<br/>testimony
        </h2>
        <p className="text-base sm:text-lg font-bold uppercase tracking-wider mt-6 max-w-xl mx-auto">
          Two minutes saves the next renter from a year of mistakes.
        </p>
        <Link
          href="/"
          className="inline-block mt-8 bg-amber-300 text-red-700 border-[3px] border-black px-8 py-4 text-2xl font-black uppercase tracking-tight shadow-[6px_6px_0_0_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[4px_4px_0_0_rgba(0,0,0,1)] transition-all"
        >
          Write a review →
        </Link>
      </section>
    </main>
  );
}

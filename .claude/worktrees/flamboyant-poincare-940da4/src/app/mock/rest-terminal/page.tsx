import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Mockup · Rest of page (Terminal)",
  robots: { index: false, follow: false },
};

const worstLandlords = [
  { rank: 1, name: "Pangea Properties", city: "CHI", violations: 2114, trend: "+12%", spark: [4,5,6,5,7,9,12] },
  { rank: 2, name: "Bronstein Properties", city: "NYC", violations: 1243, trend: "+8%", spark: [6,7,5,8,7,9,8] },
  { rank: 3, name: "Kaufman Equities", city: "LA", violations: 891, trend: "+5%", spark: [3,4,5,4,5,6,5] },
  { rank: 4, name: "Sentinel Real Estate", city: "HOU", violations: 712, trend: "+3%", spark: [4,4,5,5,5,6,6] },
  { rank: 5, name: "Riverside Holdings", city: "MIA", violations: 503, trend: "-2%", spark: [6,5,4,5,4,4,3] },
  { rank: 6, name: "Wexford Property Group", city: "NYC", violations: 487, trend: "+1%", spark: [4,5,4,5,5,5,5] },
];

const flaggedToday = [
  { ts: "09:14:22", code: "HPD-VIOL", addr: "234 W 28th St", city: "NYC", note: "3 new violations" },
  { ts: "09:11:08", code: "DBS-CODE", addr: "5621 Hollywood Blvd", city: "LA", note: "Code violation" },
  { ts: "08:47:55", code: "COURT-REF", addr: "812 N Wells St", city: "CHI", note: "Court referral" },
  { ts: "08:33:02", code: "ENF-NTC", addr: "1010 Brickell Ave", city: "MIA", note: "Enforcement notice" },
  { ts: "08:18:41", code: "311-CLST", addr: "4400 Westheimer Rd", city: "HOU", note: "Complaint cluster" },
  { ts: "07:54:19", code: "HPD-HEAT", addr: "1247 Bedford Ave", city: "NYC", note: "Heat complaint" },
];

const reviews = [
  { stars: 2, addr: "1234 Lake Shore Dr", city: "CHI", quote: "Roaches every summer. Manager won't return calls." },
  { stars: 3, addr: "456 Sunset Blvd", city: "LA", quote: "Great location, terrible walls — you hear everything." },
  { stars: 3, addr: "999 Brickell Bay", city: "MIA", quote: "Pool is gorgeous. AC has been broken since June." },
  { stars: 4, addr: "78 Avenue B", city: "NYC", quote: "Super is responsive. Old building, expect it." },
  { stars: 2, addr: "1600 Main St", city: "HOU", quote: "Charged a $200 fee for normal wear and tear." },
];

const sources = ["HPD", "DOB", "311", "LIT", "PERM", "CRIME", "REVW"];
const coverage: Record<string, Record<string, number>> = {
  NYC: { HPD: 100, DOB: 100, "311": 100, LIT: 95, PERM: 100, CRIME: 100, REVW: 78 },
  LA:  { HPD: 95,  DOB: 90,  "311": 100, LIT: 80, PERM: 70,  CRIME: 100, REVW: 62 },
  CHI: { HPD: 100, DOB: 85,  "311": 90,  LIT: 70, PERM: 60,  CRIME: 95,  REVW: 55 },
  MIA: { HPD: 70,  DOB: 60,  "311": 80,  LIT: 50, PERM: 0,   CRIME: 100, REVW: 41 },
  HOU: { HPD: 60,  DOB: 50,  "311": 95,  LIT: 0,  PERM: 40,  CRIME: 90,  REVW: 35 },
};

function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(...data);
  const w = 56, h = 14;
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => `${i * step},${h - (v / max) * h}`).join(" ");
  return (
    <svg width={w} height={h} className="inline-block align-middle">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

function CovBar({ pct }: { pct: number }) {
  const color =
    pct === 100 ? "bg-emerald-400" :
    pct >= 70  ? "bg-yellow-300" :
    pct > 0    ? "bg-orange-400" :
                 "bg-rose-500/40";
  return (
    <div className="flex items-center gap-2">
      <div className="w-12 h-1.5 bg-white/10 rounded-sm overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${Math.max(pct, 4)}%` }} />
      </div>
      <span className="text-[10px] text-white/55 tabular-nums w-7 text-right">{pct}%</span>
    </div>
  );
}

export default function MockRestTerminal() {
  return (
    <main className="bg-[#0a0e14] text-[#c0caf5] min-h-screen" style={{ fontFamily: '"Geist Mono", "JetBrains Mono", "SF Mono", ui-monospace, monospace' }}>
      <div className="bg-amber-300 text-[#0F1D2E] text-center text-xs sm:text-sm font-semibold py-1.5 tracking-wide" style={{ fontFamily: 'inherit' }}>
        MOCKUP · Below-the-fold · Terminal direction.{" "}
        <Link href="/mock/rest-wheatpaste" className="underline">See Wheatpaste version →</Link>{" "}
        <span className="opacity-50">|</span>{" "}
        <Link href="/mock/hero-pano" className="underline">Back to hero</Link>
      </div>

      {/* Stats panel — terminal output */}
      <section className="border-b border-white/10 px-4 sm:px-8 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="text-[11px] text-emerald-400 mb-3">$ lucid stats --live</div>
          <pre className="text-[12px] sm:text-sm leading-relaxed whitespace-pre overflow-x-auto">
{`╭─ DATA SNAPSHOT ──────────────────────────────────────────────╮
│  buildings_tracked      `}<span className="text-white">2,832,889</span>{`                            │
│  violations_recorded    `}<span className="text-white">11,086,949</span>{`                           │
│  complaints_311         `}<span className="text-white">503,221</span>{`                              │
│  data_sources_active    `}<span className="text-emerald-400">25</span>{`  `}<span className="text-emerald-400">[✓ all green]</span>{`                    │
│  last_sync              `}<span className="text-sky-300">2026-04-27 09:14:22 UTC</span>{`              │
╰──────────────────────────────────────────────────────────────╯`}
          </pre>
        </div>
      </section>

      {/* THE WALL — 3 panels */}
      <section className="border-b border-white/10 px-4 sm:px-8 py-12">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-[11px] text-emerald-400 mb-1">// THE WALL</h2>
          <p className="text-white/55 text-xs mb-6">3 streams. Updated every 60s.</p>

          <div className="grid lg:grid-cols-3 gap-5">
            {/* Worst landlords */}
            <div className="border border-white/10 rounded">
              <div className="bg-white/5 border-b border-white/10 px-3 py-2 text-[10px] uppercase tracking-wider text-white/70 flex items-center gap-2">
                <span className="text-rose-400">●</span> worst_landlords
                <span className="ml-auto text-white/30">[week]</span>
              </div>
              <table className="w-full text-[11px]">
                <thead className="text-white/35 text-[9px] uppercase">
                  <tr>
                    <th className="text-left px-3 py-1.5 font-normal">#</th>
                    <th className="text-left font-normal">name</th>
                    <th className="text-right font-normal">viol</th>
                    <th className="text-right pr-3 font-normal">7d</th>
                  </tr>
                </thead>
                <tbody>
                  {worstLandlords.map(l => (
                    <tr key={l.rank} className="border-t border-white/5">
                      <td className="px-3 py-2 text-white/35 tabular-nums">{String(l.rank).padStart(2, '0')}</td>
                      <td className="text-white/90 leading-tight">
                        <div>{l.name}</div>
                        <div className="text-white/35 text-[9px]">{l.city}</div>
                      </td>
                      <td className="text-right tabular-nums text-rose-300">{l.violations.toLocaleString()}</td>
                      <td className={`text-right pr-3 ${l.trend.startsWith('+') ? 'text-rose-400' : 'text-emerald-400'}`}>
                        <Sparkline data={l.spark} />
                        <div className="text-[9px] tabular-nums">{l.trend}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Flagged today */}
            <div className="border border-white/10 rounded">
              <div className="bg-white/5 border-b border-white/10 px-3 py-2 text-[10px] uppercase tracking-wider text-white/70 flex items-center gap-2">
                <span className="text-amber-400">●</span> flagged_today
                <span className="ml-auto text-white/30">[{flaggedToday.length}]</span>
              </div>
              <ul className="text-[11px]">
                {flaggedToday.map((e, i) => (
                  <li key={i} className="border-t border-white/5 px-3 py-2">
                    <div className="flex items-baseline gap-2 text-[10px]">
                      <span className="text-white/40 tabular-nums">{e.ts}</span>
                      <span className="text-amber-300">[{e.code}]</span>
                      <span className="text-white/40 ml-auto">{e.city}</span>
                    </div>
                    <div className="text-white/90 mt-0.5">{e.addr}</div>
                    <div className="text-white/55 text-[10px]">{e.note}</div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Reviews */}
            <div className="border border-white/10 rounded">
              <div className="bg-white/5 border-b border-white/10 px-3 py-2 text-[10px] uppercase tracking-wider text-white/70 flex items-center gap-2">
                <span className="text-sky-400">●</span> tenant_reviews
                <span className="ml-auto text-white/30">[stream]</span>
              </div>
              <ul className="text-[11px]">
                {reviews.map((r, i) => (
                  <li key={i} className="border-t border-white/5 px-3 py-2">
                    <div className="flex items-baseline gap-2 text-[10px]">
                      <span className={r.stars <= 2 ? "text-rose-400" : r.stars <= 3 ? "text-amber-300" : "text-emerald-400"}>
                        [{r.stars}/5]
                      </span>
                      <span className="text-white/90">{r.addr}</span>
                      <span className="text-white/40 ml-auto">{r.city}</span>
                    </div>
                    <div className="text-white/70 mt-1 italic leading-snug">&ldquo;{r.quote}&rdquo;</div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* COVERAGE MATRIX */}
      <section className="border-b border-white/10 px-4 sm:px-8 py-12">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-[11px] text-emerald-400 mb-1">// COVERAGE MATRIX</h2>
          <p className="text-white/55 text-xs mb-6">Cities × public-record sources. Higher = more data.</p>
          <div className="border border-white/10 rounded overflow-x-auto">
            <table className="w-full text-[11px] min-w-[760px]">
              <thead className="bg-white/5 text-white/70">
                <tr>
                  <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider font-normal">city</th>
                  {sources.map(s => (
                    <th key={s} className="text-left px-3 py-2 text-[10px] uppercase tracking-wider font-normal">{s}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(coverage).map(([city, src]) => (
                  <tr key={city} className="border-t border-white/5">
                    <td className="px-3 py-3 text-white/90 font-semibold">{city}</td>
                    {sources.map(s => (
                      <td key={s} className="px-3 py-3"><CovBar pct={src[s] ?? 0} /></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center gap-4 text-[10px] text-white/45">
            <span><span className="inline-block w-2 h-2 bg-emerald-400 align-middle mr-1"/> complete</span>
            <span><span className="inline-block w-2 h-2 bg-yellow-300 align-middle mr-1"/> partial</span>
            <span><span className="inline-block w-2 h-2 bg-orange-400 align-middle mr-1"/> sparse</span>
            <span><span className="inline-block w-2 h-2 bg-rose-500/60 align-middle mr-1"/> none</span>
          </div>
        </div>
      </section>

      {/* CTA: terminal prompt */}
      <section className="px-4 sm:px-8 py-16">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl text-white mb-2">add your testimony</h2>
          <p className="text-white/55 text-xs mb-6">2 minutes. saves the next renter from a year of mistakes.</p>
          <div className="border border-emerald-400/40 bg-black/40 rounded p-4 max-w-xl">
            <div className="text-emerald-400 text-[12px]">$ lucid review --building <span className="bg-emerald-400/30 ml-1 inline-block w-2 h-3 align-middle animate-pulse" /></div>
          </div>
          <Link href="/" className="inline-block mt-4 text-emerald-400 underline text-[12px]">→ open the form</Link>
        </div>
      </section>
    </main>
  );
}

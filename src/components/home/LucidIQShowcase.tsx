import { Shield, MessageSquare, Star, HardHat, Siren } from "lucide-react";
import type { City } from "@/lib/cities";
import { CITY_META } from "@/lib/cities";

const GRADES = [
  { letter: "A", label: "Excellent", range: "4.0–5.0", color: "#10B981" },
  { letter: "B", label: "Good",      range: "3.0–3.9", color: "#3B82F6" },
  { letter: "C", label: "Fair",      range: "2.0–2.9", color: "#F59E0B" },
  { letter: "D", label: "Poor",      range: "1.0–1.9", color: "#F97316" },
  { letter: "F", label: "Fail",      range: "0.0–0.9", color: "#EF4444" },
];

const INPUTS = [
  { icon: Star,           title: "Tenant Reviews",  desc: "Verified first-hand reviews", weight: "weight · 60%", bg: "#eff6ff", color: "#3B82F6" },
  { icon: Shield,         title: "HPD Violations",  desc: "Open Class A / B / C",          weight: "−0.5 / Class C", bg: "#fef2f2", color: "#EF4444" },
  { icon: MessageSquare,  title: "311 Complaints",  desc: "Heat, plumbing, paint, etc.", weight: "−0.1 / ea",  bg: "#fffbeb", color: "#F59E0B" },
  { icon: HardHat,        title: "DOB Violations",  desc: "Construction & inspections",  weight: "−0.3 / ea",  bg: "#f0f9ff", color: "#0EA5E9" },
  { icon: Siren,          title: "Area Crime",      desc: "Zip-code level",               weight: "up to −0.5", bg: "#fef2f2", color: "#DC2626" },
];

export function LucidIQShowcase({ city }: { city: City }) {
  const meta = CITY_META[city];
  return (
    <section className="py-24 bg-[#f8fafc] border-y border-[#e2e8f0]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="text-center max-w-3xl mx-auto mb-14">
          <span className="inline-flex items-center gap-2 px-3 py-1 pr-4 border border-[#e2e8f0] rounded-full bg-white font-mono text-[11px] tracking-[0.16em] uppercase text-[#3B82F6]">
            <span className="w-5 h-5 rounded-md bg-[#3B82F6] text-white inline-flex items-center justify-center font-sans font-bold text-[11px]">IQ</span>
            The LucidIQ Score
          </span>
          <h2 className="font-serif text-4xl sm:text-5xl lg:text-6xl text-[#0F1D2E] tracking-tight leading-[1.02] mt-5">
            One score. <em className="text-[#3B82F6]">The whole building.</em>
          </h2>
          <p className="text-base sm:text-lg text-[#334155] leading-relaxed mt-4">
            LucidIQ blends verified tenant reviews with public data — HPD violations, 311 complaints, DOB filings, area crime — into a letter grade and a 0-to-5 score.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="flex items-center gap-6 mb-7">
              <div
                className="w-36 h-36 rounded-3xl flex items-center justify-center text-white font-bold text-8xl shadow-[0_24px_48px_-12px_rgba(16,185,129,0.5)]"
                style={{ backgroundColor: "#10B981", letterSpacing: "-0.04em" }}
              >
                A
              </div>
              <div
                className="relative w-28 h-28 rounded-full flex flex-col items-center justify-center text-white font-bold shadow-[0_16px_32px_-8px_rgba(16,185,129,0.4)]"
                style={{ backgroundColor: "#10B981" }}
              >
                <span className="text-4xl" style={{ letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>4.2</span>
                <span className="font-mono text-[10px] font-normal tracking-[0.1em] opacity-80 mt-0.5">/ 5.0</span>
                <span className="absolute -inset-[6px] rounded-full border-2 border-dashed border-[#10B981] opacity-30" />
              </div>
            </div>
            <div className="font-serif text-3xl text-[#0F1D2E]">Excellent.</div>
            <div className="text-[#334155] text-[15px] leading-relaxed mt-2 max-w-md">
              Top-bracket buildings have strong tenant satisfaction and no open violations. You&apos;ll find them in{" "}
              <a
                href={`/${meta.urlPrefix}/best-buildings/top-rated`}
                className="text-[#3B82F6] underline-offset-2 border-b border-[#3B82F6] no-underline"
              >
                our top-rated list
              </a>.
            </div>
            <div className="grid grid-cols-5 border border-[#e2e8f0] rounded-xl overflow-hidden bg-white mt-6">
              {GRADES.map((g, i) => (
                <div
                  key={g.letter}
                  className={`text-center py-4 px-2 ${i < 4 ? "border-r border-[#e2e8f0]" : ""}`}
                >
                  <div
                    className="w-9 h-9 mx-auto rounded-lg flex items-center justify-center text-white font-bold text-lg mb-2"
                    style={{ backgroundColor: g.color }}
                  >
                    {g.letter}
                  </div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-[#64748b]">
                    {g.range}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-6">
            <div className="font-mono text-[11px] tracking-[0.14em] uppercase text-[#64748b] mb-3">
              — Score inputs
            </div>
            {INPUTS.map((inp) => (
              <div key={inp.title} className="grid grid-cols-[auto_1fr_auto] gap-3 items-center py-3 border-b border-[#f8fafc] last:border-b-0">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: inp.bg, color: inp.color }}
                >
                  <inp.icon className="w-[18px] h-[18px]" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-[#0F1D2E]">{inp.title}</div>
                  <div className="text-xs text-[#64748b] mt-0.5">{inp.desc}</div>
                </div>
                <div className="font-mono text-[11px] text-[#64748b] whitespace-nowrap">
                  {inp.weight}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

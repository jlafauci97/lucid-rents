import { Building2, ShieldAlert, MessageSquare, Database, MapPin } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Stat = {
  value: string;
  label: string;
  sub?: string;
  icon: LucideIcon;
};

const stats: Stat[] = [
  { value: "2.2M",  label: "Buildings monitored", sub: "across 5 metros", icon: Building2 },
  { value: "12M+",  label: "Code violations",     sub: "HPD · LADBS · DOB", icon: ShieldAlert },
  { value: "5M+",   label: "311 complaints",      sub: "heat · noise · pests", icon: MessageSquare },
  { value: "100+",  label: "Public data sources", sub: "combined per building", icon: Database },
  { value: "5",     label: "Cities covered",      sub: "NYC · LA · CHI · MIA · HOU", icon: MapPin },
];

/* Mock ticker — visual stand-in so each variant sits in real context. */
function MockTicker() {
  return (
    <div className="bg-[#3B82F6] border-y border-blue-400/30 py-2.5 overflow-hidden">
      <div className="flex items-center gap-3 px-3">
        <span className="flex items-center gap-1 text-[10px] font-bold text-white uppercase tracking-wider bg-red-600 px-2 py-0.5 rounded flex-shrink-0">
          <span className="w-1 h-1 bg-white rounded-full animate-pulse" />
          Live
        </span>
        <span className="text-[11px] text-white/85 truncate">
          <span className="bg-amber-500 text-white px-1.5 py-0.5 rounded text-[9px] font-bold uppercase mr-2">Complaint</span>
          1414 S Orange Grove Ave, Los Angeles, CA 90019, Mid-City
          <span className="text-white/40 mx-3">—</span>
          Report a Sidewalk Problem: Self Service
          <span className="text-white/40 ml-2 text-[10px]">May 6</span>
        </span>
      </div>
    </div>
  );
}

/* ─── Variant A — bright blue band, ticker continuation ─────────── */
function VariantA() {
  return (
    <section className="bg-[#3B82F6] border-b border-blue-400/30">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-7 sm:py-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-6 sm:gap-x-6">
          {stats.map((s) => (
            <div key={s.label} className="flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-white/15 ring-1 ring-white/25 flex-shrink-0">
                <s.icon className="w-5 h-5 text-white" strokeWidth={2.25} />
              </span>
              <div className="min-w-0">
                <div className="text-2xl sm:text-[26px] font-bold text-white tabular-nums leading-none tracking-tight">
                  {s.value}
                </div>
                <div className="text-[10px] uppercase tracking-[0.14em] text-white/85 font-bold mt-1.5 leading-tight">
                  {s.label}
                </div>
                {s.sub && (
                  <div className="text-[10px] text-white/55 mt-0.5 leading-tight truncate">{s.sub}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Variant B — deep navy band, editorial ─────────────────────── */
function VariantB() {
  return (
    <section className="bg-[#0F1D2E] border-b border-white/5 relative overflow-hidden">
      {/* Subtle radial accent — keeps the band from looking flat */}
      <div
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{
          background:
            "radial-gradient(900px 220px at 20% 50%, rgba(59,130,246,0.18), transparent 60%), radial-gradient(700px 180px at 90% 50%, rgba(252,211,77,0.08), transparent 65%)",
        }}
      />
      <div className="relative max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-9 sm:py-10">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-8 sm:divide-x sm:divide-white/8">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={`${i > 0 ? "sm:pl-6" : ""} flex flex-col items-start`}
            >
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-white/5 ring-1 ring-white/10 mb-3">
                <s.icon className="w-[18px] h-[18px] text-amber-300" strokeWidth={2.25} />
              </span>
              <div className="text-[28px] sm:text-[32px] font-bold text-white tabular-nums leading-none tracking-tight">
                {s.value}
              </div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-amber-300/90 font-bold mt-2 leading-tight">
                {s.label}
              </div>
              {s.sub && (
                <div className="text-[10px] text-white/50 mt-1 leading-tight">{s.sub}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Variant C — gradient band, glass chips ─────────────────────── */
function VariantC() {
  return (
    <section
      className="border-b border-blue-400/30 relative overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, #3B82F6 0%, #2563EB 50%, #1D4ED8 100%)",
      }}
    >
      {/* Soft texture overlay */}
      <div
        className="absolute inset-0 opacity-30 pointer-events-none mix-blend-overlay"
        style={{
          background:
            "radial-gradient(600px 200px at 10% 50%, rgba(255,255,255,0.25), transparent 60%), radial-gradient(500px 180px at 95% 50%, rgba(255,255,255,0.15), transparent 60%)",
        }}
      />
      <div className="relative max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-9">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="flex flex-col items-start p-3 sm:p-4 rounded-xl bg-white/8 backdrop-blur-sm ring-1 ring-white/15 hover:bg-white/12 transition-colors"
            >
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white/15 ring-1 ring-white/20 mb-2.5">
                <s.icon className="w-4 h-4 text-white" strokeWidth={2.25} />
              </span>
              <div className="text-[26px] sm:text-[28px] font-bold text-white tabular-nums leading-none tracking-tight">
                {s.value}
              </div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-white font-bold mt-1.5 leading-tight">
                {s.label}
              </div>
              {s.sub && (
                <div className="text-[10px] text-white/65 mt-0.5 leading-tight">{s.sub}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Optional Variant D — compact one-liner stat strip ──────────── */
function VariantD() {
  return (
    <section className="bg-[#3B82F6]/95 border-b border-blue-400/30">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-5">
        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3">
          {stats.map((s) => (
            <div key={s.label} className="flex items-baseline gap-2.5">
              <s.icon className="w-4 h-4 text-amber-300 self-center flex-shrink-0" strokeWidth={2.5} />
              <span className="text-xl font-bold text-white tabular-nums leading-none tracking-tight">
                {s.value}
              </span>
              <span className="text-[10px] uppercase tracking-[0.14em] text-white/85 font-bold leading-none">
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function VariantLabel({ name, blurb }: { name: string; blurb: string }) {
  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-2 flex items-baseline gap-3">
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#3B82F6]">
        {name}
      </span>
      <span className="text-[11px] text-[#64748b]">{blurb}</span>
    </div>
  );
}

function FakeDirectory() {
  return (
    <div className="bg-white border-b border-[#e2e8f0]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#94a3b8] font-bold">
          ↓ The directory section continues here
        </p>
      </div>
    </div>
  );
}

export default function StatsBandMock() {
  return (
    <div className="bg-white min-h-screen">
      <div className="bg-[#0F1D2E] py-7 text-center">
        <h1 className="text-2xl font-bold text-white tracking-tight">
          Stats band — under the live ticker
        </h1>
        <p className="text-white/60 text-xs mt-1.5">
          Four variants. Each shown in real context: ticker → stats → directory.
        </p>
      </div>

      <VariantLabel name="Variant A" blurb="Bright blue band — feels like an extension of the ticker." />
      <MockTicker />
      <VariantA />
      <FakeDirectory />

      <VariantLabel name="Variant B" blurb="Deep navy editorial — amber accents, vertical dividers." />
      <MockTicker />
      <VariantB />
      <FakeDirectory />

      <VariantLabel name="Variant C" blurb="Gradient with frosted glass chips — most premium feel." />
      <MockTicker />
      <VariantC />
      <FakeDirectory />

      <VariantLabel name="Variant D" blurb="Compact one-line strip — minimal, lowest visual weight." />
      <MockTicker />
      <VariantD />
      <FakeDirectory />

      <div className="h-24" />
    </div>
  );
}

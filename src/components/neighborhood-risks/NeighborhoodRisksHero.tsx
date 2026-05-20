import { AlertTriangle } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { cityPath } from "@/lib/seo";
import type { NeighborhoodRisksResult } from "@/lib/neighborhood-risks/types";

interface NeighborhoodRisksHeroProps {
  result: NeighborhoodRisksResult;
}

export function NeighborhoodRisksHero({ result }: NeighborhoodRisksHeroProps) {
  const { building, total_concerns, within_block_count, calm_score } = result;

  const breadcrumbs = [
    { label: "Home", href: "/" },
    { label: "NYC", href: cityPath("", "nyc") },
    { label: "Tenant Tools", href: cityPath("/tenant-tools", "nyc") },
    {
      label: "Neighborhood Risks",
      href: cityPath("/tenant-tools/neighborhood-risks", "nyc"),
    },
  ];

  return (
    <header
      className="relative overflow-hidden text-white"
      style={{
        background: [
          "radial-gradient(ellipse 80% 60% at 90% 50%, rgba(59,130,246,0.18) 0%, transparent 60%)",
          "radial-gradient(ellipse 60% 50% at 10% 30%, rgba(251,191,36,0.04) 0%, transparent 50%)",
          "linear-gradient(135deg, #0F1D2E 0%, #142a44 50%, #0F1D2E 100%)",
        ].join(", "),
      }}
    >
      {/* Dot pattern overlay */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />

      {/* Decorative concentric pulse */}
      <svg
        aria-hidden="true"
        viewBox="0 0 480 480"
        className="absolute -right-24 top-1/2 -translate-y-1/2 w-[480px] h-[480px] opacity-55 pointer-events-none"
        fill="none"
      >
        <circle cx="240" cy="240" r="60" fill="rgba(59,130,246,0.05)" stroke="#60A5FA" strokeWidth="1" />
        <circle cx="240" cy="240" r="110" stroke="#60A5FA" strokeWidth="1" />
        <circle cx="240" cy="240" r="160" stroke="#60A5FA" strokeWidth="1" strokeDasharray="4 6" />
        <circle cx="240" cy="240" r="210" stroke="#60A5FA" strokeWidth="1" strokeDasharray="2 10" opacity="0.6" />
        <circle cx="240" cy="240" r="6" fill="#60A5FA" />
      </svg>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <Breadcrumbs items={breadcrumbs} variant="dark" />

        <div className="mt-5 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide px-3 py-1.5 rounded-full bg-red-600/15 border border-red-600/35 text-white">
          <AlertTriangle className="w-3 h-3 text-red-300" />
          Neighborhood Risks Report
        </div>

        <h1 className="text-3xl sm:text-5xl font-bold leading-[1.05] mt-3 mb-2.5 tracking-tight text-white">
          {building.name}
        </h1>

        <div className="flex flex-wrap items-center gap-2 mb-7">
          <span className="text-sm text-[#cbd5e1] bg-white/5 border border-white/10 px-3 py-1 rounded-full">
            {building.neighborhood || "Neighborhood"}
          </span>
          <span className="text-sm text-[#cbd5e1] bg-white/5 border border-white/10 px-3 py-1 rounded-full">
            {building.borough}, NY
          </span>
          <span className="text-sm font-semibold text-[#60A5FA] bg-blue-500/8 border border-blue-400/30 px-3 py-1 rounded-full">
            ⊙ 0.75 mi radius
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3.5 max-w-xl">
          <StatTile value={total_concerns} label="Nearby concerns" tone="alert" />
          <StatTile value={within_block_count} label="Within 1 block" />
          <StatTile value={`${calm_score.toFixed(1)} / 10`} label="Calm score" tone="score" />
        </div>
      </div>
    </header>
  );
}

interface StatTileProps {
  value: string | number;
  label: string;
  tone?: "alert" | "score";
}

function StatTile({ value, label, tone }: StatTileProps) {
  const valueClass =
    tone === "alert"
      ? "text-red-300"
      : tone === "score"
        ? "bg-gradient-to-br from-amber-300 to-amber-500 bg-clip-text text-transparent"
        : "text-white";
  return (
    <div className="relative overflow-hidden bg-white/[0.03] border border-white/[0.08] backdrop-blur-md px-4 py-4 rounded-2xl">
      <span
        aria-hidden="true"
        className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
      />
      <div className={`text-2xl sm:text-3xl font-bold leading-none mb-1.5 tabular-nums tracking-tight ${valueClass}`}>
        {value}
      </div>
      <div className="text-[11px] text-[#94a3b8] uppercase tracking-wider font-semibold">
        {label}
      </div>
    </div>
  );
}

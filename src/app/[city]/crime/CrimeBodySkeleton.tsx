import { Siren, ShieldCheck, ShieldAlert, BarChart3 } from "lucide-react";

const STAT_CARDS = [
  { icon: BarChart3, label: "Total Incidents", color: "text-[#64748b]" },
  { icon: ShieldAlert, label: "Violent Crime Rate", color: "text-[#EF4444]" },
  { icon: Siren, label: "Zip Codes Tracked", color: "text-[#64748b]" },
  { icon: ShieldCheck, label: "Grade Distribution", color: "text-[#64748b]" },
];

export function CrimeBodySkeleton() {
  return (
    <div aria-busy="true">
      {/* Stats grid placeholder */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {STAT_CARDS.map((card) => (
          <div key={card.label} className="bg-white border border-[#e2e8f0] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-1">
              <card.icon className={`w-4 h-4 ${card.color}`} />
              <p className={`text-xs ${card.color} font-medium uppercase tracking-wide`}>
                {card.label}
              </p>
            </div>
            <div className="h-7 w-24 bg-[#f1f5f9] rounded mt-2" />
            <div className="h-3 w-16 bg-[#f1f5f9] rounded mt-2" />
          </div>
        ))}
      </div>

      {/* Safest neighborhoods placeholder */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="w-5 h-5 text-[#16a34a]" />
          <h2 className="text-lg font-bold text-[#0F1D2E]">Safest Neighborhoods</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="block bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl p-4">
              <div className="h-7 w-12 bg-white/50 rounded mb-2" />
              <div className="h-4 w-3/4 bg-white/50 rounded" />
              <div className="h-3 w-1/2 bg-white/50 rounded mt-1" />
              <div className="h-3 w-2/3 bg-white/50 rounded mt-2" />
            </div>
          ))}
        </div>
      </section>

      {/* Highest crime areas placeholder */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <ShieldAlert className="w-5 h-5 text-[#DC2626]" />
          <h2 className="text-lg font-bold text-[#0F1D2E]">Highest Crime Areas</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="block bg-[#fef2f2] border border-[#fecaca] rounded-xl p-4">
              <div className="h-7 w-12 bg-white/50 rounded mb-2" />
              <div className="h-4 w-3/4 bg-white/50 rounded" />
              <div className="h-3 w-1/2 bg-white/50 rounded mt-1" />
              <div className="h-3 w-2/3 bg-white/50 rounded mt-2" />
            </div>
          ))}
        </div>
      </section>

      {/* Ranking table placeholder */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl p-6">
        <div className="h-5 w-40 bg-[#f1f5f9] rounded mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-2">
              <div className="h-8 w-8 bg-[#f1f5f9] rounded" />
              <div className="flex-1">
                <div className="h-4 w-1/3 bg-[#f1f5f9] rounded" />
                <div className="h-3 w-1/4 bg-[#f1f5f9] rounded mt-1" />
              </div>
              <div className="h-4 w-16 bg-[#f1f5f9] rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

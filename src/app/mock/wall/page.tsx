import Link from "next/link";
import type { Metadata } from "next";
import { Trophy, Flame, MessageSquare, BarChart3, Users, MapPin, Wrench, ArrowRight, Star } from "lucide-react";
import { MockTop } from "../_components/MockTop";

export const metadata: Metadata = {
  title: "Mockup · Live Wall",
  robots: { index: false, follow: false },
};

const CITY_TAGS: Record<string, { bg: string; fg: string }> = {
  NYC: { bg: "bg-blue-500/10", fg: "text-blue-700" },
  LA: { bg: "bg-orange-500/10", fg: "text-orange-700" },
  Chicago: { bg: "bg-red-500/10", fg: "text-red-700" },
  Miami: { bg: "bg-teal-500/10", fg: "text-teal-700" },
  Houston: { bg: "bg-purple-500/10", fg: "text-purple-700" },
};

function CityTag({ city }: { city: string }) {
  const c = CITY_TAGS[city] ?? CITY_TAGS.NYC;
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${c.bg} ${c.fg}`}>
      {city}
    </span>
  );
}

const worstLandlords = [
  { rank: 1, name: "Pangea Properties", city: "Chicago", buildings: 89, violations: 2114 },
  { rank: 2, name: "Bronstein Properties", city: "NYC", buildings: 47, violations: 1243 },
  { rank: 3, name: "Kaufman Equities", city: "LA", buildings: 23, violations: 891 },
  { rank: 4, name: "Sentinel Real Estate", city: "Houston", buildings: 31, violations: 712 },
  { rank: 5, name: "Riverside Holdings", city: "Miami", buildings: 18, violations: 503 },
  { rank: 6, name: "Wexford Property Group", city: "NYC", buildings: 26, violations: 487 },
];

const buildingsFlagged = [
  { addr: "234 W 28th St", city: "NYC", note: "3 new HPD violations" },
  { addr: "5621 Hollywood Blvd", city: "LA", note: "DBS code violation" },
  { addr: "812 N Wells St", city: "Chicago", note: "Building court referral" },
  { addr: "1010 Brickell Ave", city: "Miami", note: "Code enforcement notice" },
  { addr: "4400 Westheimer Rd", city: "Houston", note: "311 noise complaint cluster" },
  { addr: "1247 Bedford Ave", city: "NYC", note: "Heat / hot water complaint" },
];

const newestReviews = [
  { addr: "1234 Lake Shore Dr", city: "Chicago", quote: "Roaches every summer. Manager won't return calls.", stars: 2 },
  { addr: "456 Sunset Blvd", city: "LA", quote: "Great location, terrible walls — you hear everything.", stars: 3 },
  { addr: "999 Brickell Bay", city: "Miami", quote: "Pool is gorgeous. AC has been broken since June.", stars: 3 },
  { addr: "78 Avenue B", city: "NYC", quote: "Super is responsive. Old building, expect it.", stars: 4 },
  { addr: "1600 Main St", city: "Houston", quote: "Charged a $200 fee for 'normal wear and tear.'", stars: 2 },
  { addr: "212 W Adams", city: "Chicago", quote: "Loud, but you knew that. Otherwise solid.", stars: 4 },
];

function ColumnHeader({ icon: Icon, title }: { icon: typeof Trophy; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-5 pb-3 border-b border-[#e2e8f0]">
      <Icon className="w-4 h-4 text-[#3B82F6]" />
      <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-[#0F1D2E]">{title}</h3>
      <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-medium text-[#64748b]">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Live
      </span>
    </div>
  );
}

const tools = [
  { href: "/rankings", title: "Rankings", desc: "Buildings ranked by violations, reviews, and risk.", Icon: BarChart3 },
  { href: "/landlords", title: "Landlords", desc: "Look up owner portfolios across all 5 cities.", Icon: Users },
  { href: "/neighborhoods", title: "Neighborhoods", desc: "Compare neighborhoods on noise, crime, and rent.", Icon: MapPin },
  { href: "/tenant-tools", title: "Tenant Tools", desc: "Templates, checklists, and the fair-rent engine.", Icon: Wrench },
];

export default function MockWall() {
  return (
    <div>
      <MockTop label="Option 1 · Live Wall" />

      <section className="bg-[#f8fafc] border-y border-[#e2e8f0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <div className="max-w-3xl mb-10">
            <p className="text-xs uppercase tracking-[0.2em] text-[#3B82F6] font-bold mb-2">
              The wall
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#0F1D2E] tracking-tight">
              What renters are flagging right now — across all 5 cities.
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
            {/* Worst landlords */}
            <div>
              <ColumnHeader icon={Trophy} title="Worst landlords this week" />
              <ul className="space-y-3">
                {worstLandlords.map((l) => (
                  <li key={l.rank}>
                    <Link
                      href="/landlords"
                      className="group flex items-baseline gap-3 py-2 border-b border-[#e2e8f0] last:border-0 hover:bg-white -mx-2 px-2 rounded transition-colors"
                    >
                      <span className="text-xs font-mono text-[#94a3b8] tabular-nums w-5">
                        {String(l.rank).padStart(2, "0")}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[#0F1D2E] text-sm truncate group-hover:text-[#3B82F6]">
                            {l.name}
                          </span>
                          <CityTag city={l.city} />
                        </div>
                        <p className="text-xs text-[#64748b] mt-0.5 tabular-nums">
                          {l.buildings} buildings · {l.violations.toLocaleString()} violations
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Buildings flagged today */}
            <div>
              <ColumnHeader icon={Flame} title="Flagged today" />
              <ul className="space-y-3">
                {buildingsFlagged.map((b, i) => (
                  <li key={i}>
                    <Link
                      href="/feed"
                      className="group flex items-baseline gap-3 py-2 border-b border-[#e2e8f0] last:border-0 hover:bg-white -mx-2 px-2 rounded transition-colors"
                    >
                      <span className="text-xs font-mono text-[#94a3b8] tabular-nums w-12">
                        {(["12m", "47m", "1h", "2h", "3h", "4h"] as const)[i]}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[#0F1D2E] text-sm truncate group-hover:text-[#3B82F6]">
                            {b.addr}
                          </span>
                          <CityTag city={b.city} />
                        </div>
                        <p className="text-xs text-[#64748b] mt-0.5">{b.note}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Newest reviews */}
            <div>
              <ColumnHeader icon={MessageSquare} title="Newest tenant reviews" />
              <ul className="space-y-3">
                {newestReviews.map((r, i) => (
                  <li key={i}>
                    <Link
                      href="/feed"
                      className="group block py-2 border-b border-[#e2e8f0] last:border-0 hover:bg-white -mx-2 px-2 rounded transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-[#0F1D2E] text-sm truncate group-hover:text-[#3B82F6]">
                          {r.addr}
                        </span>
                        <CityTag city={r.city} />
                        <span className="ml-auto inline-flex items-center gap-0.5 text-[#f59e0b]">
                          {Array.from({ length: 5 }).map((_, j) => (
                            <Star
                              key={j}
                              className="w-2.5 h-2.5"
                              fill={j < r.stars ? "currentColor" : "transparent"}
                              strokeWidth={1.5}
                            />
                          ))}
                        </span>
                      </div>
                      <p className="text-xs text-[#475569] italic leading-snug">"{r.quote}"</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Tools strip */}
      <section className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="max-w-3xl mb-8">
            <p className="text-xs uppercase tracking-[0.2em] text-[#3B82F6] font-bold mb-2">Tools</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#0F1D2E] tracking-tight">
              The other ways renters use Lucid.
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[#e2e8f0] border border-[#e2e8f0]">
            {tools.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className="group bg-white p-6 hover:bg-[#f8fafc] transition-colors"
              >
                <t.Icon className="w-5 h-5 text-[#3B82F6] mb-4" strokeWidth={1.75} />
                <h3 className="font-bold text-[#0F1D2E] mb-1.5 flex items-center gap-1.5">
                  {t.title}
                  <ArrowRight className="w-3.5 h-3.5 text-[#94a3b8] group-hover:text-[#3B82F6] group-hover:translate-x-0.5 transition-all" />
                </h3>
                <p className="text-xs text-[#64748b] leading-relaxed">{t.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#0F1D2E] text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            Lived somewhere? Tell us.
          </h2>
          <p className="text-white/70 max-w-xl mx-auto mb-8">
            Reviews are the reason this works. Two minutes from a former tenant saves a future one a year of regret.
          </p>
          <Link
            href="/nyc/review/new"
            className="inline-flex items-center gap-2 bg-[#3B82F6] hover:bg-[#2563EB] text-white font-semibold px-7 py-3.5 rounded-lg transition-colors"
          >
            Write a review
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}

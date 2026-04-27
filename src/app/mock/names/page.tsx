import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Quote, BarChart3, Users, MapPin, Wrench } from "lucide-react";
import { MockTop } from "../_components/MockTop";

export const metadata: Metadata = {
  title: "Mockup · Names You Should Know",
  robots: { index: false, follow: false },
};

const CITY_TAGS: Record<string, { bg: string; fg: string }> = {
  NYC: { bg: "bg-blue-500/10", fg: "text-blue-700" },
  LA: { bg: "bg-orange-500/10", fg: "text-orange-700" },
  Chicago: { bg: "bg-red-500/10", fg: "text-red-700" },
  Miami: { bg: "bg-teal-500/10", fg: "text-teal-700" },
  Houston: { bg: "bg-purple-500/10", fg: "text-purple-700" },
};

function CityTag({ city, tone = "light" }: { city: string; tone?: "light" | "dark" }) {
  const c = CITY_TAGS[city] ?? CITY_TAGS.NYC;
  if (tone === "dark") {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-white/10 text-white/80">
        {city}
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${c.bg} ${c.fg}`}>
      {city}
    </span>
  );
}

const worstTen = [
  { rank: 1, name: "Pangea Properties", city: "Chicago", buildings: 89, violations: 2114, score: 12 },
  { rank: 2, name: "Bronstein Properties", city: "NYC", buildings: 47, violations: 1243, score: 18 },
  { rank: 3, name: "Sentinel Real Estate", city: "Houston", buildings: 31, violations: 891, score: 21 },
  { rank: 4, name: "Kaufman Equities", city: "LA", buildings: 23, violations: 712, score: 24 },
  { rank: 5, name: "Riverside Holdings", city: "Miami", buildings: 18, violations: 612, score: 27 },
  { rank: 6, name: "Wexford Property Group", city: "NYC", buildings: 26, violations: 487, score: 31 },
  { rank: 7, name: "Coastal Equities Trust", city: "Miami", buildings: 14, violations: 428, score: 33 },
  { rank: 8, name: "Lone Star Residential", city: "Houston", buildings: 22, violations: 401, score: 35 },
  { rank: 9, name: "Sunset Holdings LLC", city: "LA", buildings: 17, violations: 387, score: 38 },
  { rank: 10, name: "North Park Realty", city: "Chicago", buildings: 31, violations: 366, score: 41 },
];

const quotes = [
  { quote: "Roaches every summer. Manager won't return calls.", addr: "1234 Lake Shore Dr", city: "Chicago" },
  { quote: "Charged a $200 'normal wear' fee. The walls were fine.", addr: "1600 Main St", city: "Houston" },
  { quote: "The pool is gorgeous. The AC has been broken since June.", addr: "999 Brickell Bay", city: "Miami" },
  { quote: "Great location, terrible walls. You hear everything.", addr: "456 Sunset Blvd", city: "LA" },
  { quote: "Heat off for 11 days in January. Never reimbursed.", addr: "78 Avenue B", city: "NYC" },
  { quote: "Loud, but you knew that. Otherwise solid.", addr: "212 W Adams", city: "Chicago" },
];

const tools = [
  { href: "/rankings", title: "Rankings", Icon: BarChart3 },
  { href: "/landlords", title: "Landlords", Icon: Users },
  { href: "/neighborhoods", title: "Neighborhoods", Icon: MapPin },
  { href: "/tenant-tools", title: "Tenant Tools", Icon: Wrench },
];

export default function MockNames() {
  return (
    <div>
      <MockTop label="Option 2 · Names You Should Know" />

      {/* Leaderboard */}
      <section className="bg-[#0F1D2E] text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
          <div className="max-w-3xl mb-12 sm:mb-16">
            <p className="text-xs uppercase tracking-[0.24em] text-amber-300 font-bold mb-4">
              The accountability list
            </p>
            <h2 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] mb-5">
              Names you <em className="text-amber-300 not-italic font-bold">should</em> know.
            </h2>
            <p className="text-white/70 text-base sm:text-lg max-w-xl leading-relaxed">
              The 10 worst-rated landlords across our 5 cities, scored on open violations, complaint rate, and tenant reviews. Click any to see their portfolio.
            </p>
          </div>

          <ol className="divide-y divide-white/10 border-y border-white/10">
            {worstTen.map((l) => (
              <li key={l.rank}>
                <Link
                  href="/landlords"
                  className="group grid grid-cols-[3rem_1fr_auto] sm:grid-cols-[5rem_1fr_auto_auto] gap-4 sm:gap-8 items-baseline py-5 sm:py-6 hover:bg-white/[0.03] -mx-3 sm:-mx-6 px-3 sm:px-6 transition-colors"
                >
                  <span className="text-3xl sm:text-5xl font-bold tabular-nums text-white/20 group-hover:text-amber-300 transition-colors">
                    {String(l.rank).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 sm:gap-3 mb-1 flex-wrap">
                      <span className="text-lg sm:text-2xl font-bold tracking-tight group-hover:text-amber-300 transition-colors">
                        {l.name}
                      </span>
                      <CityTag city={l.city} tone="dark" />
                    </div>
                    <p className="text-xs sm:text-sm text-white/60 tabular-nums">
                      {l.buildings} buildings · {l.violations.toLocaleString()} open violations
                    </p>
                  </div>
                  <div className="hidden sm:flex flex-col items-end">
                    <p className="text-[10px] uppercase tracking-wider text-white/40 mb-0.5">Score</p>
                    <p className="text-2xl font-bold tabular-nums text-amber-300">{l.score}</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-white/30 group-hover:text-amber-300 group-hover:translate-x-1 transition-all flex-shrink-0" />
                </Link>
              </li>
            ))}
          </ol>

          <div className="mt-10 flex items-center justify-between gap-4 flex-wrap">
            <p className="text-xs text-white/40">
              Updated daily from public records across NYC, LA, Chicago, Miami, and Houston.
            </p>
            <Link
              href="/landlords"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-300 hover:text-amber-200"
            >
              See all 4,800 landlords
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Quote wall */}
      <section className="bg-white border-y border-[#e2e8f0]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="max-w-3xl mb-12">
            <p className="text-xs uppercase tracking-[0.2em] text-[#3B82F6] font-bold mb-2">
              From the reviews
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#0F1D2E] tracking-tight">
              The stuff a listing photo won't show you.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-10">
            {quotes.map((q, i) => (
              <Link
                key={i}
                href="/feed"
                className="group block"
              >
                <Quote className="w-5 h-5 text-[#cbd5e1] mb-3" strokeWidth={1.75} />
                <p className="text-lg sm:text-xl font-semibold text-[#0F1D2E] leading-snug mb-3 group-hover:text-[#3B82F6] transition-colors">
                  "{q.quote}"
                </p>
                <p className="text-xs text-[#64748b] flex items-center gap-2">
                  Review of {q.addr}
                  <CityTag city={q.city} />
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Tools strip */}
      <section className="bg-[#f8fafc]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-center gap-4 sm:gap-10 flex-wrap">
            <p className="text-xs uppercase tracking-[0.18em] text-[#64748b] font-semibold">
              Also on Lucid Rents
            </p>
            {tools.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className="group inline-flex items-center gap-2 text-sm font-semibold text-[#0F1D2E] hover:text-[#3B82F6] transition-colors"
              >
                <t.Icon className="w-4 h-4 text-[#3B82F6]" strokeWidth={1.75} />
                {t.title}
                <ArrowRight className="w-3 h-3 text-[#94a3b8] group-hover:text-[#3B82F6] group-hover:translate-x-0.5 transition-all" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-[#0F1D2E] tracking-tight mb-3">
            Lived somewhere bad?
          </h2>
          <p className="text-[#64748b] max-w-xl mx-auto mb-8">
            Names go on this list because tenants put them there. Two minutes from you saves the next renter a year.
          </p>
          <Link
            href="/nyc/review/new"
            className="inline-flex items-center gap-2 bg-[#0F1D2E] hover:bg-[#1e3151] text-white font-semibold px-7 py-3.5 rounded-lg transition-colors"
          >
            Write a review
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}

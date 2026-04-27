import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { Trophy, Flame, MessageSquare, Star, ArrowRight, Quote } from "lucide-react";
import { CITY_META, type City } from "@/lib/cities";
import { cityPath } from "@/lib/seo";
import { MockTop } from "../_components/MockTop";

export const metadata: Metadata = {
  title: "Mockup · Combined",
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

const quotes = [
  { quote: "Roaches every summer. Manager won't return calls.", addr: "1234 Lake Shore Dr", city: "Chicago" },
  { quote: "Charged a $200 'normal wear' fee. The walls were fine.", addr: "1600 Main St", city: "Houston" },
  { quote: "The pool is gorgeous. The AC has been broken since June.", addr: "999 Brickell Bay", city: "Miami" },
  { quote: "Great location, terrible walls. You hear everything.", addr: "456 Sunset Blvd", city: "LA" },
  { quote: "Heat off for 11 days in January. Never reimbursed.", addr: "78 Avenue B", city: "NYC" },
  { quote: "Loud, but you knew that. Otherwise solid.", addr: "212 W Adams", city: "Chicago" },
];

const panels: { key: City; stats: { label: string; value: string }[] }[] = [
  { key: "nyc", stats: [
    { label: "Buildings tracked", value: "954,210" },
    { label: "Open HPD violations", value: "4.4M" },
    { label: "Active landlords", value: "18,300" },
  ] },
  { key: "los-angeles", stats: [
    { label: "Buildings tracked", value: "478,900" },
    { label: "Code complaints (yr)", value: "412K" },
    { label: "Active landlords", value: "14,100" },
  ] },
  { key: "chicago", stats: [
    { label: "Buildings tracked", value: "318,700" },
    { label: "Open violations", value: "198K" },
    { label: "Active landlords", value: "8,200" },
  ] },
  { key: "miami", stats: [
    { label: "Buildings tracked", value: "94,700" },
    { label: "Code complaints (yr)", value: "76K" },
    { label: "Active landlords", value: "3,400" },
  ] },
  { key: "houston", stats: [
    { label: "Buildings tracked", value: "410,500" },
    { label: "311 complaints (yr)", value: "132K" },
    { label: "Active landlords", value: "6,800" },
  ] },
];

const tracked = [
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

export default function MockCombined() {
  return (
    <div>
      <MockTop label="Combined" />

      {/* 1. Live Wall */}
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
            <div>
              <ColumnHeader icon={Trophy} title="Worst landlords this week" />
              <ul className="space-y-3">
                {worstLandlords.map((l) => (
                  <li key={l.rank}>
                    <Link href="/landlords" className="group flex items-baseline gap-3 py-2 border-b border-[#e2e8f0] last:border-0 hover:bg-white -mx-2 px-2 rounded transition-colors">
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

            <div>
              <ColumnHeader icon={Flame} title="Flagged today" />
              <ul className="space-y-3">
                {buildingsFlagged.map((b, i) => (
                  <li key={i}>
                    <Link href="/feed" className="group flex items-baseline gap-3 py-2 border-b border-[#e2e8f0] last:border-0 hover:bg-white -mx-2 px-2 rounded transition-colors">
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

            <div>
              <ColumnHeader icon={MessageSquare} title="Newest tenant reviews" />
              <ul className="space-y-3">
                {newestReviews.map((r, i) => (
                  <li key={i}>
                    <Link href="/feed" className="group block py-2 border-b border-[#e2e8f0] last:border-0 hover:bg-white -mx-2 px-2 rounded transition-colors">
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

      {/* 2. 5-City Panorama */}
      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.2em] text-[#3B82F6] font-bold mb-3">
              The map
            </p>
            <h2 className="text-3xl sm:text-5xl font-bold text-[#0F1D2E] tracking-tight leading-[1.05] mb-4">
              Five cities. <span className="text-[#94a3b8]">Same playbook.</span>
            </h2>
            <p className="text-[#475569] text-base sm:text-lg leading-relaxed">
              We pull every city's open records — violations, complaints, court filings — into one place. Pick a city to see what's there.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-[#0F1D2E] overflow-hidden">
        <div className="overflow-x-auto snap-x snap-mandatory scroll-smooth">
          <div className="flex">
            {panels.map(({ key, stats }) => {
              const meta = CITY_META[key];
              return (
                <article
                  key={key}
                  className="snap-start shrink-0 w-[88vw] sm:w-[640px] lg:w-[760px] relative"
                >
                  <div className="relative h-[480px] sm:h-[560px]">
                    <Image
                      src={meta.heroImage}
                      alt={`${meta.fullName} skyline`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 88vw, 760px"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0F1D2E] via-[#0F1D2E]/30 to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-r from-[#0F1D2E]/50 via-transparent to-[#0F1D2E]/20" />
                    <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-10 text-white">
                      <p className="text-xs uppercase tracking-[0.24em] text-amber-300 font-semibold mb-2">
                        {meta.stateCode}
                      </p>
                      <h3 className="text-4xl sm:text-6xl font-bold tracking-tight mb-6">
                        {meta.fullName}
                      </h3>
                      <dl className="grid grid-cols-3 gap-4 sm:gap-6 mb-8 max-w-md">
                        {stats.map((s) => (
                          <div key={s.label}>
                            <dd className="text-xl sm:text-2xl font-bold tabular-nums">{s.value}</dd>
                            <dt className="text-[10px] sm:text-xs uppercase tracking-wider text-white/60 mt-0.5">
                              {s.label}
                            </dt>
                          </div>
                        ))}
                      </dl>
                      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                        <Link
                          href={cityPath("/", key)}
                          className="inline-flex items-center gap-1.5 bg-white text-[#0F1D2E] font-semibold text-sm px-4 py-2.5 rounded-lg hover:bg-amber-300 transition-colors"
                        >
                          {meta.name} home
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                        <Link
                          href={cityPath("/rankings", key)}
                          className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white font-semibold text-sm px-4 py-2.5 rounded-lg border border-white/20 transition-colors"
                        >
                          Rankings
                        </Link>
                        <Link
                          href={cityPath("/landlords", key)}
                          className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white font-semibold text-sm px-4 py-2.5 rounded-lg border border-white/20 transition-colors"
                        >
                          Landlords
                        </Link>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
            <div className="snap-start shrink-0 w-[1px]" aria-hidden />
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between text-white/60 text-xs">
          <p>← Drag to scroll between cities →</p>
          <p className="hidden sm:block tabular-nums">5 of 5 indexed</p>
        </div>
      </section>

      {/* 3. What we track */}
      <section className="bg-[#f8fafc] border-y border-[#e2e8f0]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-10 lg:gap-16 items-start">
            <div className="lg:sticky lg:top-24">
              <p className="text-xs uppercase tracking-[0.2em] text-[#3B82F6] font-bold mb-2">
                The data
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-[#0F1D2E] tracking-tight">
                What we track in every city.
              </h2>
              <p className="text-[#64748b] text-sm mt-3 leading-relaxed">
                Public records, civic feeds, and tenant submissions — combined into one searchable record per building.
              </p>
            </div>
            <ul className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-base sm:text-lg">
              {tracked.map((t, i) => (
                <li
                  key={t}
                  className="text-[#0F1D2E] font-medium border-b border-dashed border-[#e2e8f0] pb-2 flex items-baseline gap-2"
                >
                  <span className="text-[10px] tabular-nums text-[#94a3b8] font-mono">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 4. Quote wall */}
      <section className="bg-white">
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
              <Link key={i} href="/feed" className="group block">
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

      {/* 5. CTA */}
      <section className="bg-[#0F1D2E] text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            Add your building.
          </h2>
          <p className="text-white/70 max-w-xl mx-auto mb-8">
            Reviews from former tenants are the part we can't pull from public records. Two minutes saves the next renter from a year of mistakes.
          </p>
          <Link
            href="/nyc/review/new"
            className="inline-flex items-center gap-2 bg-amber-300 hover:bg-amber-200 text-[#0F1D2E] font-semibold px-7 py-3.5 rounded-lg transition-colors"
          >
            Write a review
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}

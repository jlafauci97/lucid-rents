import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Trophy, Flame, MessageSquare, Star, ArrowRight, Building2, Shield, MapPin, Calculator, Scale, FileCheck, Compass, Wrench, Newspaper } from "lucide-react";
import { CITY_META, type City } from "@/lib/cities";
import { cityPath } from "@/lib/seo";
import { ViolationTickerServer } from "@/components/home/ViolationTickerServer";
import { BrandShield } from "@/components/brand/BrandShield";

export const metadata: Metadata = {
  title: "Mockup · Panorama Hero (v2)",
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

const panels: { key: City; image?: string; stats: { label: string; value: string }[] }[] = [
  { key: "nyc", image: "/nyc-empire-skyline.jpg", stats: [
    { label: "Buildings", value: "954K" },
    { label: "Open viol.", value: "4.4M" },
    { label: "Landlords", value: "18.3K" },
  ] },
  { key: "los-angeles", image: "/la-hero-skyline.jpg", stats: [
    { label: "Buildings", value: "479K" },
    { label: "Complaints", value: "412K" },
    { label: "Landlords", value: "14.1K" },
  ] },
  { key: "chicago", image: "/chicago-hero-skyline.jpg", stats: [
    { label: "Buildings", value: "319K" },
    { label: "Open viol.", value: "198K" },
    { label: "Landlords", value: "8.2K" },
  ] },
  { key: "miami", image: "/miami-hero-skyline.avif", stats: [
    { label: "Buildings", value: "94.7K" },
    { label: "Complaints", value: "76K" },
    { label: "Landlords", value: "3.4K" },
  ] },
  { key: "houston", image: "/houston-hero-skyline.png", stats: [
    { label: "Buildings", value: "411K" },
    { label: "311 calls", value: "132K" },
    { label: "Landlords", value: "6.8K" },
  ] },
];

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

/* ─── Per-city directory tiles ─────────────────────────────────────
   Each city gets its signature stat + 5 deep-link chips into its
   most distinctive datasets. Routes use cityPath() so they resolve
   to the city's actual URL prefix (NYC: /nyc/..., LA: /CA/Los-Angeles/...). */
type ChipIcon = typeof Trophy;
type CityChip = { label: string; path: string; icon: ChipIcon; count?: string };
type CityDirectory = {
  key: City;
  image: string;
  stat: string;
  statLabel: string;
  signature: string;
  chips: CityChip[];
};

const cityDirectories: CityDirectory[] = [
  {
    key: "nyc",
    image: "/nyc-empire-skyline.jpg",
    stat: "954K",
    statLabel: "buildings",
    signature: "5 boroughs · HPD + DOB",
    chips: [
      { label: "All buildings",      path: "/buildings",          icon: Building2,  count: "954K" },
      { label: "Worst landlords",    path: "/landlords",          icon: Trophy,     count: "18K"  },
      { label: "Crime by zip",       path: "/crime",              icon: MapPin                    },
      { label: "Rent stabilization", path: "/rent-stabilization", icon: Shield,     count: "712K" },
      { label: "Ellis Act",          path: "/ellis-act",          icon: Scale                     },
    ],
  },
  {
    key: "los-angeles",
    image: "/la-hero-skyline.jpg",
    stat: "479K",
    statLabel: "buildings",
    signature: "51 neighborhoods · LAHD + LADBS",
    chips: [
      { label: "All buildings",       path: "/buildings",            icon: Building2,  count: "479K" },
      { label: "Worst landlords",     path: "/landlords",            icon: Trophy,     count: "14K"  },
      { label: "Soft-story risk",     path: "/seismic-fire-safety",  icon: Flame,      count: "13K"  },
      { label: "Affordable housing",  path: "/affordable-housing",   icon: Shield                    },
      { label: "Crime by division",   path: "/crime",                icon: MapPin                    },
    ],
  },
  {
    key: "chicago",
    image: "/chicago-hero-skyline.jpg",
    stat: "319K",
    statLabel: "buildings",
    signature: "41 neighborhoods · RLTO + Energy",
    chips: [
      { label: "All buildings",     path: "/buildings",       icon: Building2,  count: "319K" },
      { label: "Worst landlords",   path: "/landlords",       icon: Trophy,     count: "8.2K" },
      { label: "Heating tracker",   path: "/heating-tracker", icon: Flame                     },
      { label: "Crime by district", path: "/crime",           icon: MapPin                    },
      { label: "Permits",           path: "/permits",         icon: FileCheck                 },
    ],
  },
  {
    key: "miami",
    image: "/miami-hero-skyline.avif",
    stat: "94.7K",
    statLabel: "buildings",
    signature: "37 neighborhoods · 40-Yr + FEMA",
    chips: [
      { label: "All buildings",         path: "/buildings",   icon: Building2,  count: "94.7K" },
      { label: "Crime by neighborhood", path: "/crime",       icon: MapPin                    },
      { label: "Encampments",           path: "/encampments", icon: Flame                     },
      { label: "Permits",               path: "/permits",     icon: FileCheck                 },
      { label: "Worst landlords",       path: "/landlords",   icon: Trophy,     count: "3.4K" },
    ],
  },
  {
    key: "houston",
    image: "/houston-hero-skyline.png",
    stat: "411K",
    statLabel: "buildings",
    signature: "41 neighborhoods · HCAD + FEMA",
    chips: [
      { label: "All buildings",     path: "/buildings", icon: Building2,  count: "411K" },
      { label: "Worst landlords",   path: "/landlords", icon: Trophy,     count: "6.8K" },
      { label: "Permits",           path: "/permits",   icon: FileCheck                 },
      { label: "Crime by district", path: "/crime",     icon: MapPin                    },
      { label: "Live activity",     path: "/feed",      icon: Newspaper                 },
    ],
  },
];

const cityOrder: City[] = ["nyc", "los-angeles", "chicago", "miami", "houston"];

/* Color per icon — semantic, so the same icon means the same thing
   across cities. All written as static class strings so Tailwind's
   JIT scanner picks them up. */
function iconColorClass(Icon: ChipIcon): string {
  if (Icon === Building2)  return "text-blue-500";
  if (Icon === Trophy)     return "text-amber-500";
  if (Icon === MapPin)     return "text-rose-500";
  if (Icon === Shield)     return "text-emerald-500";
  if (Icon === Scale)      return "text-violet-500";
  if (Icon === Flame)      return "text-orange-500";
  if (Icon === FileCheck)  return "text-teal-500";
  if (Icon === Newspaper)  return "text-sky-500";
  if (Icon === Compass)    return "text-indigo-500";
  if (Icon === Calculator) return "text-cyan-500";
  if (Icon === Wrench)     return "text-slate-500";
  if (Icon === MessageSquare) return "text-sky-500";
  return "text-[#94a3b8]";
}

/* Map the short city tags used in the demo data ("NYC", "LA", "Chicago",
   "Miami", "Houston") to canonical City keys for cityPath(). */
function cityKeyFromShort(short: string): City {
  switch (short) {
    case "NYC":     return "nyc";
    case "LA":      return "los-angeles";
    case "Chicago": return "chicago";
    case "Miami":   return "miami";
    case "Houston": return "houston";
    default:        return "nyc";
  }
}

/* ─── Coverage matrix ──────────────────────────────────────────────
   Rows = data sources. Columns = cities. Each cell is a clickable
   deep-link to the page that uses that source for that city. */
type CoverageCell = { path: string; count?: string };
type CoverageRow = {
  source: string;
  note?: string;
  cells: Partial<Record<City, CoverageCell>>;
};

const coverageRows: CoverageRow[] = [
  {
    source: "Housing violations",
    note: "HPD / LAHD / Code enforcement",
    cells: {
      nyc:           { path: "/landlords", count: "4.4M" },
      "los-angeles": { path: "/landlords", count: "412K" },
      chicago:       { path: "/landlords", count: "198K" },
      miami:         { path: "/landlords", count: "76K"  },
      houston:       { path: "/landlords", count: "132K" },
    },
  },
  {
    source: "Building permits",
    note: "DOB / LADBS / new + alteration",
    cells: {
      nyc:           { path: "/permits", count: "89K" },
      "los-angeles": { path: "/permits", count: "67K" },
      chicago:       { path: "/permits", count: "41K" },
      miami:         { path: "/permits", count: "12K" },
      houston:       { path: "/permits", count: "23K" },
    },
  },
  {
    source: "311 complaints",
    note: "Heat, noise, trash, parking",
    cells: {
      nyc:           { path: "/feed", count: "350K+" },
      "los-angeles": { path: "/feed", count: "120K+" },
      chicago:       { path: "/feed", count: "85K+"  },
      miami:         { path: "/feed", count: "32K+"  },
      houston:       { path: "/feed", count: "45K+"  },
    },
  },
  {
    source: "Crime by area",
    note: "12-month rolling, daily refresh",
    cells: {
      nyc:           { path: "/crime" },
      "los-angeles": { path: "/crime" },
      chicago:       { path: "/crime" },
      miami:         { path: "/crime" },
      houston:       { path: "/crime" },
    },
  },
  {
    source: "Tenant reviews",
    note: "User-submitted, verified",
    cells: {
      nyc:           { path: "/feed" },
      "los-angeles": { path: "/feed" },
      chicago:       { path: "/feed" },
      miami:         { path: "/feed" },
      houston:       { path: "/feed" },
    },
  },
  {
    source: "Owner records",
    note: "PLUTO / Assessor / HCAD",
    cells: {
      nyc:           { path: "/landlords" },
      "los-angeles": { path: "/landlords" },
      chicago:       { path: "/landlords" },
      miami:         { path: "/landlords" },
      houston:       { path: "/landlords" },
    },
  },
  {
    source: "Rent stabilization",
    note: "DHCR / RSO registry",
    cells: {
      nyc:           { path: "/rent-stabilization", count: "712K units" },
      "los-angeles": { path: "/rent-stabilization", count: "624K units" },
    },
  },
  {
    source: "Evictions / buyouts",
    note: "Court filings + buyout registry",
    cells: {
      nyc:           { path: "/ellis-act" },
      "los-angeles": { path: "/ellis-act" },
    },
  },
  {
    source: "Seismic / soft-story",
    note: "LADBS retrofit inventory",
    cells: {
      "los-angeles": { path: "/seismic-fire-safety", count: "13K" },
    },
  },
  {
    source: "Energy benchmarking",
    note: "Heating performance + efficiency",
    cells: {
      chicago:       { path: "/heating-tracker" },
    },
  },
  {
    source: "40-year recertification",
    note: "Structural + electrical reports",
    cells: {
      miami:         { path: "/permits" },
    },
  },
  {
    source: "FEMA flood zones",
    note: "Hazard map overlays",
    cells: {
      miami:         { path: "/buildings" },
      houston:       { path: "/buildings" },
    },
  },
];

/* ─── Tools shelf ──────────────────────────────────────────────────
   Calculators and global utilities. NYC is the default city for
   per-city tools since it has the deepest data coverage. */
const tools = [
  { label: "Fair Rent Engine",         href: "/fair-rent-engine",                    icon: Calculator,  blurb: "What you should be paying" },
  { label: "Rent Affordability",       href: "/rent-affordability-calculator",       icon: Calculator,  blurb: "What rent fits your income" },
  { label: "Rent Timing",              href: "/rent-timing-calculator",              icon: Calculator,  blurb: "Best month to renew" },
  { label: "Compare Buildings",        href: cityPath("/compare", "nyc"),            icon: Compass,     blurb: "Side-by-side records" },
  { label: "Tenant Rights",            href: cityPath("/tenant-rights", "nyc"),      icon: Shield,      blurb: "Per-city legal guides" },
  { label: "Tenant Tools",             href: cityPath("/tenant-tools", "nyc"),      icon: Wrench,      blurb: "Notices, repair requests" },
];

function ColumnHeader({ icon: Icon, title }: { icon: ChipIcon; title: string }) {
  return (
    <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-[#e2e8f0]">
      <Icon className={`w-4 h-4 ${iconColorClass(Icon)}`} strokeWidth={2.25} />
      <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-[#0F1D2E]">{title}</h3>
      <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-medium text-[#64748b]">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Live
      </span>
    </div>
  );
}

export default function MockHeroPano() {
  return (
    <div>
      <style>{`
        .city-panel {
          transition: transform 400ms cubic-bezier(0.2, 0.8, 0.2, 1),
                      filter 300ms ease,
                      box-shadow 400ms ease,
                      z-index 0s 400ms;
        }
        @media (hover: hover) and (prefers-reduced-motion: no-preference) {
          .city-panel:hover {
            transform: scale(1.05);
            filter: brightness(1.18) saturate(1.05);
            box-shadow: 0 24px 60px -12px rgba(0,0,0,0.55);
            z-index: 5;
            transition: transform 400ms cubic-bezier(0.2, 0.8, 0.2, 1),
                        filter 300ms ease,
                        box-shadow 400ms ease,
                        z-index 0s 0s;
          }
        }
      `}</style>

      <div className="bg-amber-300 text-[#0F1D2E] text-center text-xs sm:text-sm font-semibold py-1.5 tracking-wide">
        MOCKUP — Panorama Hero — not the real homepage
      </div>

      {/* Panorama hero — mobile: text above + horizontal city scroll. Desktop: text overlaid on full-bleed 5-panel grid. */}
      <section className="relative bg-[#0F1D2E] sm:h-[62vh] sm:min-h-[544px] sm:max-h-[704px]">
        {/* Brand block — in-flow above on mobile, absolute overlay on desktop */}
        <div className="relative z-10 sm:absolute sm:inset-x-0 sm:top-0 sm:pointer-events-none">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-5 sm:pt-7 lg:pt-8 sm:pb-0 text-center">
            <div className="inline-block drop-shadow-[0_6px_24px_rgba(0,0,0,0.45)]">
              <BrandShield width="auto" height="auto" className="h-16 sm:h-[77px] lg:h-[88px] w-auto" />
            </div>
            <p className="mt-1.5 text-[9px] sm:text-[10px] uppercase tracking-[0.22em] text-white/85 font-semibold drop-shadow">
              A Rental Intelligence Platform
            </p>
            <h1 className="mt-1.5 text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-tight drop-shadow-[0_2px_14px_rgba(0,0,0,0.55)]">
              Check Your Apartment Building
            </h1>
            <p className="mt-2 text-xs sm:text-xs lg:text-sm text-white/90 max-w-2xl mx-auto drop-shadow">
              See the truth about any building before you sign. Violations, complaints, tenant reviews, and crime data — all in one place.
            </p>
          </div>
        </div>

        {/* 5-panel layer — in-flow with fixed height on mobile, absolute fill grid on desktop */}
        <div className="relative h-[352px] sm:h-auto sm:absolute sm:inset-0 flex sm:grid sm:grid-cols-5 overflow-x-auto sm:overflow-visible snap-x snap-mandatory sm:snap-none">
          {panels.map(({ key, image, stats }) => {
            const meta = CITY_META[key];
            return (
              <article
                key={key}
                className="city-panel snap-start shrink-0 w-[80vw] sm:w-auto relative h-full border-r border-white/5 last:border-r-0 will-change-transform"
              >
                <Image
                  src={image ?? meta.heroImage}
                  alt={`${meta.fullName} skyline`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 80vw, 20vw"
                  priority={key === "nyc"}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0F1D2E]/90 via-[#0F1D2E]/10 to-[#0F1D2E]/35" />

                <div className="absolute inset-x-0 bottom-0 p-5 sm:p-5 lg:p-7 text-white">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-amber-300 font-bold mb-1">
                    {meta.stateCode}
                  </p>
                  <h3 className="text-2xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold tracking-tight mb-4 leading-[1.05]">
                    {meta.fullName}
                  </h3>
                  <dl className="grid grid-cols-3 gap-2.5 mb-4">
                    {stats.map((s) => (
                      <div key={s.label}>
                        <dd className="text-sm sm:text-base lg:text-lg font-bold tabular-nums leading-none">
                          {s.value}
                        </dd>
                        <dt className="text-[9px] uppercase tracking-wider text-white/70 mt-1 leading-tight">
                          {s.label}
                        </dt>
                      </div>
                    ))}
                  </dl>
                  <Link
                    href={cityPath("/", key)}
                    className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-amber-300 hover:text-white transition-colors"
                  >
                    Explore {meta.name}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>

        {/* Mobile swipe hint */}
        <p className="sm:hidden text-[10px] uppercase tracking-wider text-white/40 font-semibold text-center pt-3 pb-4">
          ← Swipe between cities →
        </p>
      </section>

      {/* Violation ticker */}
      <Suspense fallback={<div className="bg-[#3B82F6] border-y border-blue-400/30 py-3 h-[52px]" />}>
        <ViolationTickerServer />
      </Suspense>

      {/* ─────────────────────────────────────────────────────────────
          1. Per-city directory tiles — the magnet.
             Each tile shows the city's signature stat + a column of
             clickable chips that deep-link into the per-city pages.
         ───────────────────────────────────────────────────────────── */}
      <section className="bg-white border-b border-[#e2e8f0]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16">
          <div className="flex items-baseline justify-between gap-4 mb-8">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[#3B82F6] font-bold mb-1.5">
                The directory
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-[#0F1D2E] tracking-tight">
                Pick a city. Open a dataset.
              </h2>
            </div>
            <p className="hidden sm:block text-xs text-[#64748b] max-w-xs text-right">
              Each tile is a launchpad into the records we hold for that city.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
            {cityDirectories.map((c) => {
              const meta = CITY_META[c.key];
              return (
                <article
                  key={c.key}
                  className="group flex flex-col bg-white border border-[#e2e8f0] rounded-xl overflow-hidden hover:border-[#3B82F6]/50 hover:shadow-[0_8px_24px_-12px_rgba(59,130,246,0.25)] transition-all"
                >
                  {/* Skyline thumb */}
                  <div className="relative h-20 overflow-hidden bg-[#0F1D2E]">
                    <Image
                      src={c.image}
                      alt={`${meta.fullName} skyline`}
                      fill
                      sizes="(max-width: 640px) 100vw, 280px"
                      className="object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0F1D2E]/80 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 px-3 py-2 flex items-end justify-between">
                      <h3 className="text-base font-bold text-white tracking-tight leading-tight">
                        {meta.fullName}
                      </h3>
                      <span className="text-[9px] font-bold uppercase tracking-widest text-amber-300">
                        {meta.stateCode}
                      </span>
                    </div>
                  </div>

                  {/* Stat */}
                  <div className="px-3 pt-3 pb-2 border-b border-[#e2e8f0]">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xl font-bold text-[#0F1D2E] tabular-nums tracking-tight">
                        {c.stat}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider text-[#64748b] font-semibold">
                        {c.statLabel}
                      </span>
                    </div>
                    <p className="text-[10px] text-[#94a3b8] mt-0.5">{c.signature}</p>
                  </div>

                  {/* Chips — deep links */}
                  <ul className="px-2 py-2 space-y-px flex-1">
                    {c.chips.map((chip) => (
                      <li key={chip.label}>
                        <Link
                          href={cityPath(chip.path, c.key)}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] text-[#334155] hover:bg-[#3B82F6]/8 hover:text-[#3B82F6] transition-colors"
                        >
                          <chip.icon className={`w-4 h-4 ${iconColorClass(chip.icon)} flex-shrink-0`} strokeWidth={2.25} />
                          <span className="truncate">{chip.label}</span>
                          {chip.count && (
                            <span className="ml-auto text-[10px] tabular-nums text-[#94a3b8] font-semibold">
                              {chip.count}
                            </span>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <Link
                    href={cityPath("/", c.key)}
                    className="block px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest text-[#3B82F6] border-t border-[#e2e8f0] bg-[#f8fafc] hover:bg-[#3B82F6] hover:text-white transition-colors"
                  >
                    Open {meta.name} →
                  </Link>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          2. Live streams — three cross-city columns. Every row is a
             link into the building / landlord page that owns it.
         ───────────────────────────────────────────────────────────── */}
      <section className="bg-[#f8fafc] border-b border-[#e2e8f0]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16">
          <div className="flex items-baseline justify-between gap-4 mb-8">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[#3B82F6] font-bold mb-1.5">
                Live streams
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-[#0F1D2E] tracking-tight">
                Right now, across all 5 cities.
              </h2>
            </div>
            <p className="hidden sm:block text-xs text-[#64748b]">Updated every 60s.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5">
            {/* Worst landlords */}
            <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden">
              <ColumnHeader icon={Trophy} title="Worst landlords this week" />
              <ul className="px-3 pb-3 space-y-1">
                {worstLandlords.map((l) => (
                  <li key={l.rank}>
                    <Link
                      href={cityPath("/landlords", cityKeyFromShort(l.city))}
                      className="group flex items-baseline gap-3 px-2 py-2 rounded-md hover:bg-[#f8fafc] transition-colors"
                    >
                      <span className="text-xs font-mono text-[#94a3b8] tabular-nums w-5">
                        {String(l.rank).padStart(2, "0")}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[#0F1D2E] text-[13px] truncate group-hover:text-[#3B82F6]">
                            {l.name}
                          </span>
                          <CityTag city={l.city} />
                        </div>
                        <p className="text-[11px] text-[#64748b] mt-0.5 tabular-nums">
                          {l.buildings} buildings · {l.violations.toLocaleString()} violations
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                href="/landlords"
                className="block text-center text-[10px] font-bold uppercase tracking-widest text-[#3B82F6] border-t border-[#e2e8f0] py-2.5 hover:bg-[#3B82F6] hover:text-white transition-colors"
              >
                See full ranking →
              </Link>
            </div>

            {/* Flagged today */}
            <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden">
              <ColumnHeader icon={Flame} title="Flagged today" />
              <ul className="px-3 pb-3 space-y-1">
                {buildingsFlagged.map((b, i) => (
                  <li key={i}>
                    <Link
                      href={cityPath("/feed", cityKeyFromShort(b.city))}
                      className="group flex items-baseline gap-3 px-2 py-2 rounded-md hover:bg-[#f8fafc] transition-colors"
                    >
                      <span className="text-xs font-mono text-[#94a3b8] tabular-nums w-10">
                        {(["12m", "47m", "1h", "2h", "3h", "4h"] as const)[i]}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[#0F1D2E] text-[13px] truncate group-hover:text-[#3B82F6]">
                            {b.addr}
                          </span>
                          <CityTag city={b.city} />
                        </div>
                        <p className="text-[11px] text-[#64748b] mt-0.5">{b.note}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                href="/feed"
                className="block text-center text-[10px] font-bold uppercase tracking-widest text-[#3B82F6] border-t border-[#e2e8f0] py-2.5 hover:bg-[#3B82F6] hover:text-white transition-colors"
              >
                Open the feed →
              </Link>
            </div>

            {/* Newest tenant reviews */}
            <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden">
              <ColumnHeader icon={MessageSquare} title="Newest tenant reviews" />
              <ul className="px-3 pb-3 space-y-1">
                {newestReviews.map((r, i) => (
                  <li key={i}>
                    <Link
                      href={cityPath("/feed", cityKeyFromShort(r.city))}
                      className="group block px-2 py-2 rounded-md hover:bg-[#f8fafc] transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-[#0F1D2E] text-[13px] truncate group-hover:text-[#3B82F6]">
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
                      <p className="text-[11px] text-[#475569] italic leading-snug">&ldquo;{r.quote}&rdquo;</p>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                href="/feed"
                className="block text-center text-[10px] font-bold uppercase tracking-widest text-[#3B82F6] border-t border-[#e2e8f0] py-2.5 hover:bg-[#3B82F6] hover:text-white transition-colors"
              >
                See all reviews →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          3. Coverage receipt — credibility wall AND navigation.
             Rows = data sources. Columns = cities. Cells link to the
             page using that source for that city.
         ───────────────────────────────────────────────────────────── */}
      <section className="bg-white border-b border-[#e2e8f0]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16">
          <div className="flex items-baseline justify-between gap-4 mb-8">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[#3B82F6] font-bold mb-1.5">
                Coverage
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-[#0F1D2E] tracking-tight">
                Every dataset, every city.
              </h2>
              <p className="text-sm text-[#64748b] mt-2 max-w-xl">
                26 public-record sources combined into one record per building. Click any cell to open it.
              </p>
            </div>
          </div>

          <div className="border border-[#e2e8f0] rounded-xl overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-[#64748b] w-[200px]">
                    Source
                  </th>
                  {cityOrder.map((key) => (
                    <th key={key} className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-[#64748b]">
                      {CITY_META[key].stateCode}{" "}
                      <span className="text-[#0F1D2E]">{CITY_META[key].name}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {coverageRows.map((row) => (
                  <tr key={row.source} className="border-b border-[#e2e8f0] last:border-0 hover:bg-[#f8fafc]/50">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-[#0F1D2E] text-[13px]">{row.source}</div>
                      {row.note && <div className="text-[10px] text-[#94a3b8] mt-0.5">{row.note}</div>}
                    </td>
                    {cityOrder.map((key) => {
                      const cell = row.cells[key];
                      if (!cell) {
                        return (
                          <td key={key} className="px-4 py-3 text-[#cbd5e1] text-xs">—</td>
                        );
                      }
                      return (
                        <td key={key} className="px-4 py-3">
                          <Link
                            href={cityPath(cell.path, key)}
                            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#3B82F6] hover:underline"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            {cell.count ?? "Live"}
                          </Link>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          4. Tools shelf — calculators and global utilities. Hidden on
             current homepage; surfacing them turns the homepage into
             a real navigation hub.
         ───────────────────────────────────────────────────────────── */}
      <section className="bg-[#f8fafc] border-b border-[#e2e8f0]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16">
          <div className="flex items-baseline justify-between gap-4 mb-8">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[#3B82F6] font-bold mb-1.5">
                Tools
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-[#0F1D2E] tracking-tight">
                Calculators &amp; lookups.
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {tools.map((t) => (
              <Link
                key={t.label}
                href={t.href}
                className="group flex flex-col items-start p-4 bg-white border border-[#e2e8f0] rounded-xl hover:border-[#3B82F6]/50 hover:shadow-[0_8px_24px_-12px_rgba(59,130,246,0.25)] transition-all"
              >
                <div className="w-9 h-9 rounded-lg bg-[#3B82F6]/10 text-[#3B82F6] flex items-center justify-center mb-3 group-hover:bg-[#3B82F6] group-hover:text-white transition-colors">
                  <t.icon className="w-4 h-4" strokeWidth={2.25} />
                </div>
                <h3 className="text-[13px] font-bold text-[#0F1D2E] leading-tight mb-1 group-hover:text-[#3B82F6]">
                  {t.label}
                </h3>
                <p className="text-[11px] text-[#64748b] leading-snug">{t.blurb}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          5. CTA — write a review. Per-city buttons.
         ───────────────────────────────────────────────────────────── */}
      <section className="bg-[#0F1D2E] text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            Add your building.
          </h2>
          <p className="text-white/70 max-w-xl mx-auto mb-8">
            Reviews from former tenants are the part we can&rsquo;t pull from public records. Two minutes saves the next renter from a year of mistakes.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {cityOrder.map((key) => {
              const meta = CITY_META[key];
              const isPrimary = key === "nyc";
              return (
                <Link
                  key={key}
                  href={cityPath("/review/new", key)}
                  className={
                    isPrimary
                      ? "inline-flex items-center gap-2 bg-amber-300 hover:bg-amber-200 text-[#0F1D2E] font-semibold px-5 py-3 rounded-lg transition-colors"
                      : "inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-5 py-3 rounded-lg transition-colors"
                  }
                >
                  Review a {meta.name} building
                  <ArrowRight className="w-4 h-4" />
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Homepage mockups",
  robots: { index: false, follow: false },
};

const options = [
  {
    href: "/mock/wall",
    label: "Option 1",
    title: "Live Wall",
    blurb: "Three columns updating across all 5 cities — worst landlords, buildings flagged today, freshest tenant reviews. Every row links somewhere.",
  },
  {
    href: "/mock/names",
    label: "Option 2",
    title: "Names You Should Know",
    blurb: "An editorial top-10 worst-landlords leaderboard with city tags, then a wall of real tenant quotes. Takes a stance.",
  },
  {
    href: "/mock/panorama",
    label: "Option 3",
    title: "5-City Panorama",
    blurb: "Horizontal-snapping panels — one per city — each with skyline, three city stats, and links into that city's tools. Most explicitly multi-metro.",
  },
];

export default function MockIndex() {
  return (
    <div className="min-h-screen bg-[#0F1D2E] text-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <p className="text-xs uppercase tracking-[0.2em] text-amber-300 font-semibold mb-3">
          Mockup picker
        </p>
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight mb-3">
          Three takes on the homepage below the hero.
        </h1>
        <p className="text-white/70 text-base sm:text-lg max-w-2xl mb-12">
          Hero + stats card stay the same in each. Open one, scroll through the proposed below-stats section, then tell me 1, 2, or 3.
        </p>
        <div className="space-y-4">
          {options.map((o) => (
            <Link
              key={o.href}
              href={o.href}
              className="group block p-6 sm:p-8 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-blue-400/40 transition-all"
            >
              <div className="flex items-start justify-between gap-6">
                <div className="flex-1">
                  <p className="text-xs uppercase tracking-[0.18em] text-blue-300 font-semibold mb-1.5">
                    {o.label}
                  </p>
                  <h2 className="text-2xl sm:text-3xl font-bold mb-2">{o.title}</h2>
                  <p className="text-white/70 text-sm sm:text-base leading-relaxed">{o.blurb}</p>
                </div>
                <ArrowRight className="w-6 h-6 mt-1 text-white/40 group-hover:text-blue-300 group-hover:translate-x-1 transition-all flex-shrink-0" />
              </div>
            </Link>
          ))}
        </div>
        <p className="text-white/40 text-xs mt-12 max-w-2xl">
          Data shown in the mockups is illustrative — once you pick, I'll wire it to live database queries.
        </p>
      </div>
    </div>
  );
}

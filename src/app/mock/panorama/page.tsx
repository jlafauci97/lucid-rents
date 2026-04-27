import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { CITY_META, type City } from "@/lib/cities";
import { cityPath } from "@/lib/seo";
import { MockTop } from "../_components/MockTop";

export const metadata: Metadata = {
  title: "Mockup · 5-City Panorama",
  robots: { index: false, follow: false },
};

const panels: { key: City; stats: { label: string; value: string }[] }[] = [
  {
    key: "nyc",
    stats: [
      { label: "Buildings tracked", value: "954,210" },
      { label: "Open HPD violations", value: "4.4M" },
      { label: "Active landlords", value: "18,300" },
    ],
  },
  {
    key: "los-angeles",
    stats: [
      { label: "Buildings tracked", value: "478,900" },
      { label: "Code complaints (yr)", value: "412K" },
      { label: "Active landlords", value: "14,100" },
    ],
  },
  {
    key: "chicago",
    stats: [
      { label: "Buildings tracked", value: "318,700" },
      { label: "Open violations", value: "198K" },
      { label: "Active landlords", value: "8,200" },
    ],
  },
  {
    key: "miami",
    stats: [
      { label: "Buildings tracked", value: "94,700" },
      { label: "Code complaints (yr)", value: "76K" },
      { label: "Active landlords", value: "3,400" },
    ],
  },
  {
    key: "houston",
    stats: [
      { label: "Buildings tracked", value: "410,500" },
      { label: "311 complaints (yr)", value: "132K" },
      { label: "Active landlords", value: "6,800" },
    ],
  },
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

export default function MockPanorama() {
  return (
    <div>
      <MockTop label="Option 3 · 5-City Panorama" />

      {/* Intro */}
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

      {/* Horizontal panorama */}
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

      {/* What we track */}
      <section className="bg-white border-y border-[#e2e8f0]">
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

      {/* CTA */}
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

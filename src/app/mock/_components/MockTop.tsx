import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight } from "lucide-react";
import { cityPath } from "@/lib/seo";
import { CITY_META, type City } from "@/lib/cities";
import { LiveStats } from "@/components/home/LiveStats";
import { BrandShield } from "@/components/brand/BrandShield";

const cities: { key: City }[] = [
  { key: "nyc" },
  { key: "los-angeles" },
  { key: "chicago" },
  { key: "miami" },
  { key: "houston" },
];

export function MockTop({ label }: { label: string }) {
  return (
    <>
      <div className="bg-amber-300 text-[#0F1D2E] text-center text-xs sm:text-sm font-semibold py-1.5 tracking-wide">
        MOCKUP — {label} — not the real homepage
      </div>

      <section className="relative text-white overflow-x-clip">
        <Image
          src="/homepage-background.webp"
          alt="City skyline"
          fill
          className="object-cover object-center"
          priority
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-[#0F1D2E]/40" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 pb-8 sm:pb-12 text-center">
          <div className="mx-auto mb-2 flex justify-center drop-shadow-lg">
            <BrandShield width="auto" height="auto" className="h-[100px] sm:h-[120px] w-auto" />
          </div>
          <p className="text-xs sm:text-sm uppercase tracking-[0.2em] text-white/70 font-medium mb-2">
            A Rental Intelligence Platform
          </p>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-2">
            Check Your Apartment Building
          </h1>
          <p className="text-sm sm:text-base text-white/80 mb-6 max-w-2xl mx-auto">
            See the truth about any building before you sign. Violations, complaints, tenant reviews, and crime data — all in one place.
          </p>

          <div className="flex justify-center gap-6 sm:gap-8 lg:gap-12 flex-wrap max-w-5xl mx-auto">
            {cities.map((c) => {
              const meta = CITY_META[c.key];
              return (
                <Link
                  key={c.key}
                  href={cityPath("/", c.key)}
                  aria-label={`Explore ${meta.fullName}`}
                  className="group relative block w-[120px] h-[160px] sm:w-[160px] sm:h-[210px] rounded-3xl overflow-hidden border border-white/15 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)] transition-all duration-300 hover:-translate-y-1.5 hover:border-blue-400/60 hover:shadow-[0_0_40px_rgba(59,130,246,0.3)]"
                >
                  <Image
                    src={meta.heroImage}
                    alt={`${meta.fullName} skyline`}
                    width={400}
                    height={520}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 640px) 120px, 160px"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 px-3.5 pb-3 pt-8">
                    <h2 className="text-[15px] sm:text-base font-bold leading-tight text-white drop-shadow-sm">
                      {meta.fullName}
                    </h2>
                    <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-white/70 group-hover:text-blue-300 transition-colors">
                      Explore
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-b border-[#e2e8f0] bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Suspense
            fallback={
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="text-center">
                    <div className="w-8 h-8 bg-[#e2e8f0] rounded mx-auto mb-2 animate-pulse" />
                    <div className="h-7 w-20 bg-[#e2e8f0] rounded mx-auto mb-1 animate-pulse" />
                    <div className="h-4 w-24 bg-[#e2e8f0] rounded mx-auto animate-pulse" />
                  </div>
                ))}
              </div>
            }
          >
            <LiveStats />
          </Suspense>
        </div>
      </section>
    </>
  );
}

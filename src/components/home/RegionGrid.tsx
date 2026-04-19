import Link from "next/link";
import type { City } from "@/lib/cities";
import { CITY_META } from "@/lib/cities";
import { REGIONS_BY_CITY } from "@/lib/city-home/regions";

export function RegionGrid({ city }: { city: City }) {
  const regions = REGIONS_BY_CITY[city];
  const prefix = CITY_META[city].urlPrefix;
  if (!regions || regions.length === 0) return null;

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="mb-8 max-w-2xl">
          <p className="text-xs uppercase tracking-[0.18em] text-[#3B82F6] font-medium">
            Neighborhoods
          </p>
          <h2 className="font-serif text-4xl sm:text-5xl text-[#0F1D2E] mt-2 leading-[1.02] tracking-tight">
            Browse by area.
          </h2>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-3 md:grid-rows-2 gap-3 h-auto md:h-[440px]">
          {regions.map((r) => (
            <Link
              key={r.slug}
              href={`/${prefix}/neighborhoods?region=${r.slug}`}
              className={`group relative rounded-xl overflow-hidden text-white bg-[#0F1D2E] transition hover:-translate-y-1 ${
                r.featured ? "md:row-span-2 md:col-span-1 h-64 md:h-auto" : "h-44"
              }`}
            >
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                style={{ backgroundImage: `url(${r.bg})` }}
              />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(15,29,46,0.1) 0%, rgba(15,29,46,0.85) 100%)",
                }}
              />
              <span className="absolute top-4 right-4 bg-white/15 backdrop-blur-sm border border-white/20 px-2.5 py-1 rounded-full text-[10px] font-mono tracking-[0.1em] text-white uppercase">
                {r.count}
              </span>
              <div className="absolute inset-x-0 bottom-0 p-5">
                <div
                  className={`font-serif tracking-tight ${
                    r.featured ? "text-4xl sm:text-5xl" : "text-2xl"
                  }`}
                >
                  {r.name}
                </div>
                <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-white/80 mt-1">
                  {r.meta}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

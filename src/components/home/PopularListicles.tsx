import Link from "next/link";
import type { City } from "@/lib/cities";
import { CITY_META } from "@/lib/cities";
import { chipsForCity } from "@/lib/best-buildings/chips";

export function PopularListicles({ city }: { city: City }) {
  const prefix = CITY_META[city].urlPrefix;
  const chips = chipsForCity(city).slice(0, 3);
  if (chips.length === 0) return null;

  return (
    <section className="py-20 bg-[#f8fafc] border-y border-[#e2e8f0]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="flex items-end justify-between gap-6 flex-wrap mb-8">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.18em] text-[#3B82F6] font-medium">
              Popular · Curated Lists
            </p>
            <h2 className="font-serif text-4xl sm:text-5xl text-[#0F1D2E] mt-2 leading-[1.02] tracking-tight">
              Best buildings <em className="text-[#3B82F6]">by category.</em>
            </h2>
          </div>
          <Link
            href={`/${prefix}/best-buildings`}
            className="font-mono text-xs tracking-wider text-[#0F1D2E] border-b border-[#e2e8f0] hover:border-[#0F1D2E] pb-0.5 font-medium"
          >
            All lists →
          </Link>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {chips.map((chip) => {
            const bg = `https://loremflickr.com/900/600/${encodeURIComponent(chip.image_hint.replace(/\s+/g, ","))}/all`;
            return (
              <Link
                key={chip.id}
                href={`/${prefix}/best-buildings/${chip.slug}`}
                className="group block bg-white border border-[#e2e8f0] rounded-xl overflow-hidden transition hover:border-[#0F1D2E] hover:-translate-y-0.5"
              >
                <div className="relative h-40 overflow-hidden">
                  <div
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                    style={{ backgroundImage: `url(${bg})` }}
                  />
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(59,130,246,0.35), rgba(15,29,46,0.5))",
                    }}
                  />
                  <span className="absolute top-3 left-3 bg-white text-[#0F1D2E] text-[10px] font-mono tracking-[0.1em] uppercase px-2 py-1 rounded-full">
                    {chip.label}
                  </span>
                </div>
                <div className="p-5">
                  <h3 className="font-serif text-2xl leading-tight text-[#0F1D2E]">
                    {chip.description}
                  </h3>
                  <p className="text-sm text-[#64748b] leading-relaxed mt-2.5 line-clamp-3">
                    {chip.long_description}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

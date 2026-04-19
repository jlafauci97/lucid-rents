import type { City } from "@/lib/cities";
import { FAQ_BY_CITY } from "@/lib/city-home/faq";

export function CityFaq({ city }: { city: City }) {
  const items = FAQ_BY_CITY[city];
  if (!items || items.length === 0) return null;

  return (
    <section className="py-20 bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="text-center mb-10">
          <p className="text-xs uppercase tracking-[0.18em] text-[#3B82F6] font-medium">FAQ</p>
          <h2 className="font-serif text-4xl sm:text-5xl text-[#0F1D2E] mt-2 tracking-tight">
            Common questions.
          </h2>
        </header>
        <div className="border-t border-[#e2e8f0]">
          {items.map((item, i) => (
            <details
              key={i}
              className="group border-b border-[#e2e8f0] py-6 open:bg-[#fbfcfe]"
              open={i === 0}
            >
              <summary className="cursor-pointer list-none font-serif text-xl sm:text-2xl text-[#0F1D2E] tracking-tight flex justify-between items-center gap-4">
                <span>{item.q}</span>
                <span className="w-7 h-7 rounded-full flex items-center justify-center text-[#64748b] border border-[#e2e8f0] group-open:bg-[#0F1D2E] group-open:text-white group-open:border-transparent transition font-light text-xl">
                  <span className="group-open:hidden">+</span>
                  <span className="hidden group-open:inline">−</span>
                </span>
              </summary>
              <p className="mt-4 text-[15px] leading-relaxed text-[#334155]">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

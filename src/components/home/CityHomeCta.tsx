import Link from "next/link";
import type { City } from "@/lib/cities";
import { CITY_META } from "@/lib/cities";

export function CityHomeCta({ city }: { city: City }) {
  const meta = CITY_META[city];
  const prefix = meta.urlPrefix;

  return (
    <section className="py-24 bg-[#0F1D2E] text-white relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 80% at 50% 130%, rgba(59,130,246,0.3), transparent 60%)",
        }}
      />
      <div className="relative max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="font-serif text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-[1.02]">
          Know the building <em className="text-[#93c5fd]">before you sign.</em>
        </h2>
        <p className="text-[17px] text-[#c7d2e0] leading-relaxed max-w-xl mx-auto mt-5 mb-8">
          Search any rental address across {meta.fullName}. Get the full record, the LucidIQ score, and the tenant voice. Free, forever.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link
            href={`/${prefix}/search`}
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-white text-[#0F1D2E] font-semibold text-sm hover:bg-[#3B82F6] hover:text-white transition"
          >
            Start a search →
          </Link>
          <Link
            href={`/${prefix}/review/new`}
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full border border-white/25 text-white font-medium text-sm hover:bg-white/5 hover:border-white transition"
          >
            Leave a review
          </Link>
        </div>
      </div>
    </section>
  );
}

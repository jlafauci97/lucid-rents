import Link from "next/link";
import {
  Building2,
  Users,
  Siren,
  TrainFront,
  BarChart3,
} from "lucide-react";
import type { City } from "@/lib/cities";
import { CITY_META } from "@/lib/cities";

const TILES = [
  { icon: Building2,     label: "Buildings",  desc: "Every building in the city, indexed.", path: "/buildings",   count: "INDEXED" },
  { icon: Users,         label: "Landlords",  desc: "Who owns what, and their record.",     path: "/landlords",   count: "PROFILED" },
  { icon: Siren,         label: "Crime Data", desc: "Zip-level incidents, 12 months.",      path: "/crime",       count: "UPDATED DAILY" },
  { icon: TrainFront,    label: "Transit",    desc: "Walk to every station.",                path: "/transit",     count: "" },
  { icon: BarChart3,     label: "Rent Data",  desc: "12+ years of registered rents.",        path: "/rent-data",   count: "" },
];

export function ExploreDataGrid({ city }: { city: City }) {
  const meta = CITY_META[city];
  const prefix = meta.urlPrefix;
  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="mb-8 max-w-2xl">
          <p className="text-xs uppercase tracking-[0.18em] text-[#3B82F6] font-medium">
            Explore
          </p>
          <h2 className="font-serif text-4xl sm:text-5xl text-[#0F1D2E] mt-2 leading-[1.02] tracking-tight">
            Data across <em className="text-[#3B82F6]">{meta.fullName}.</em>
          </h2>
        </header>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {TILES.map((t) => (
            <Link
              key={t.label}
              href={`/${prefix}${t.path}`}
              className="group bg-white border border-[#e2e8f0] rounded-xl p-6 flex flex-col gap-4 transition hover:border-[#0F1D2E] hover:bg-[#f8fafc]"
            >
              <div className="w-10 h-10 rounded-lg bg-[#f8fafc] flex items-center justify-center text-[#3B82F6]">
                <t.icon className="w-5 h-5" />
              </div>
              <h4 className="font-serif text-[22px] text-[#0F1D2E] leading-tight">
                {t.label}
              </h4>
              <p className="text-sm text-[#64748b] leading-relaxed">{t.desc}</p>
              {t.count && (
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#64748b] mt-auto">
                  {t.count}
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

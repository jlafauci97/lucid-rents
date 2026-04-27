import { ExternalLink, Repeat } from "lucide-react";
import { mapsHref, normalizeBorough, type ShedRow } from "./utils";

function splitDuration(days: number): { primary: string; unit: string; secondary: string | null } {
  if (days < 0) return { primary: "—", unit: "", secondary: null };
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  if (years >= 1) {
    return {
      primary: String(years),
      unit: years === 1 ? "year" : "years",
      secondary: months > 0 ? `${months} mo` : null,
    };
  }
  if (months > 0) return { primary: String(months), unit: "months", secondary: null };
  return { primary: String(days), unit: "days", secondary: null };
}

export function HallOfShame({ data }: { data: ShedRow[] }) {
  const top = data
    .slice()
    .sort((a, b) => b.total_days - a.total_days)
    .slice(0, 6);

  if (top.length === 0) return null;

  return (
    <section className="mb-6">
      <div className="flex items-baseline justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#0F1D2E]">
            Hall of Shame
          </h2>
          <p className="text-sm text-[#64748b] mt-1">
            The longest-standing active sidewalk sheds in NYC.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {top.map((s, i) => {
          const d = splitDuration(s.total_days);
          const isExtreme = s.total_days >= 365 * 5;
          const isLong = s.total_days >= 365;

          return (
            <a
              key={`${s.house_no}-${s.street_name}-${i}`}
              href={mapsHref(s)}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative flex flex-col rounded-xl bg-white border border-[#e2e8f0] hover:border-[#0F1D2E]/50 hover:shadow-lg transition-all overflow-hidden"
            >
              <div className="absolute top-3 right-3 flex items-center justify-center w-7 h-7 rounded-full bg-[#0F1D2E] text-white text-xs font-bold tabular-nums">
                #{i + 1}
              </div>

              <div
                className={`px-5 pt-5 pb-4 border-b ${
                  isExtreme
                    ? "bg-gradient-to-br from-red-50 to-orange-50 border-red-100"
                    : isLong
                      ? "bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-100"
                      : "bg-[#f8fafc] border-[#e2e8f0]"
                }`}
              >
                <div className="flex items-baseline gap-2">
                  <span
                    className={`text-5xl sm:text-6xl font-bold tabular-nums leading-none tracking-tight ${
                      isExtreme
                        ? "text-red-600"
                        : isLong
                          ? "text-amber-600"
                          : "text-[#0F1D2E]"
                    }`}
                  >
                    {d.primary}
                  </span>
                  <span
                    className={`text-base font-semibold ${
                      isExtreme
                        ? "text-red-700"
                        : isLong
                          ? "text-amber-700"
                          : "text-[#334155]"
                    }`}
                  >
                    {d.unit}
                    {d.secondary ? (
                      <span className="text-xs font-normal text-[#64748b] ml-1.5">
                        + {d.secondary}
                      </span>
                    ) : null}
                  </span>
                </div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#64748b] mt-1.5">
                  Continuously up since{" "}
                  {new Date(s.first_issued).toLocaleDateString("en-US", {
                    month: "short",
                    year: "numeric",
                  })}
                </div>
              </div>

              <div className="p-5 flex-1 flex flex-col">
                <div className="text-base font-bold text-[#0F1D2E] leading-tight">
                  {s.house_no} {s.street_name}
                </div>
                <div className="text-xs text-[#64748b] mt-0.5">
                  {normalizeBorough(s.borough)}
                  {s.zip_code ? ` · ${s.zip_code}` : ""}
                </div>

                <div className="flex items-center gap-3 mt-3 text-xs text-[#475569]">
                  <span className="inline-flex items-center gap-1">
                    <Repeat className="w-3.5 h-3.5 text-[#94a3b8]" />
                    <span className="tabular-nums font-semibold">
                      {s.permit_count}
                    </span>
                    <span className="text-[#64748b]">
                      renewal{s.permit_count === 1 ? "" : "s"}
                    </span>
                  </span>
                </div>

                {s.owner_business_name ? (
                  <div className="mt-3 pt-3 border-t border-[#f1f5f9]">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8]">
                      Owner of record
                    </div>
                    <div className="text-xs text-[#334155] mt-0.5 truncate">
                      {s.owner_business_name}
                    </div>
                  </div>
                ) : null}

                <div className="mt-auto pt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#3B82F6] group-hover:gap-2 transition-all">
                  View on Google Maps
                  <ExternalLink className="w-3 h-3" />
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}

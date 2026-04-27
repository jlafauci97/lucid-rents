"use client";

import { useMemo, useState } from "react";
import { Search, Construction, MapPin } from "lucide-react";
import {
  formatDuration,
  mapsHref,
  normalizeBorough,
  type ShedRow,
  type ZipShedRow,
} from "./utils";

export function ScaffoldingHero({
  totalActive,
  oldestYears,
  longestSheds,
  zipData,
}: {
  totalActive: number;
  oldestYears: number;
  longestSheds: ShedRow[];
  zipData: ZipShedRow[];
}) {
  const [q, setQ] = useState("");

  const trimmed = q.trim();
  const isZipQuery = /^\d{3,5}$/.test(trimmed);

  const matchedZips = useMemo(() => {
    if (trimmed.length < 3) return [];
    if (isZipQuery) {
      return zipData
        .filter((z) => z.zip_code.startsWith(trimmed))
        .sort((a, b) => b.shed_count - a.shed_count)
        .slice(0, 5);
    }
    return [];
  }, [trimmed, isZipQuery, zipData]);

  const matchedSheds = useMemo(() => {
    if (trimmed.length < 3) return [];
    const lower = trimmed.toLowerCase();
    return longestSheds
      .filter((s) => {
        if (isZipQuery) return s.zip_code?.startsWith(trimmed);
        const street = (s.street_name || "").toLowerCase();
        const full = `${s.house_no} ${s.street_name}`.toLowerCase();
        return street.includes(lower) || full.includes(lower);
      })
      .sort((a, b) => b.total_days - a.total_days)
      .slice(0, 8);
  }, [trimmed, longestSheds, isZipQuery]);

  const totalInZips = matchedZips.reduce((sum, z) => sum + z.shed_count, 0);
  const hasResults = matchedZips.length > 0 || matchedSheds.length > 0;
  const showResults = trimmed.length >= 3;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#1f2937] bg-gradient-to-br from-[#0F1D2E] via-[#152339] to-[#0F1D2E] p-6 sm:p-10 mb-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, #F59E0B 0 24px, transparent 24px 60px)",
        }}
      />

      <div className="relative">
        <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-300 ring-1 ring-amber-500/30 mb-4">
          <Construction className="w-3.5 h-3.5" />
          NYC Sidewalk Sheds
        </div>

        <h1 className="text-3xl sm:text-5xl font-bold leading-[1.05] tracking-tight text-white max-w-3xl">
          How long has the scaffolding
          <br className="hidden sm:block" />{" "}
          <span className="text-amber-400">on your block</span> been up?
        </h1>

        <p className="text-sm sm:text-base text-slate-300 mt-4 max-w-2xl">
          {totalActive > 0 ? (
            <>
              <span className="font-semibold text-white">
                {totalActive.toLocaleString()}
              </span>{" "}
              active sidewalk sheds across NYC right now. Some addresses have
              had shed permits for{" "}
              <span className="font-semibold text-amber-300">{oldestYears}+ years</span>.
            </>
          ) : (
            "Tracking active sidewalk shed permits across NYC."
          )}
        </p>

        <div className="mt-7 max-w-2xl">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Enter your zip code or street name (e.g. 10003 or Broadway)"
              className="w-full bg-white/95 text-[#0F1D2E] placeholder:text-slate-400 rounded-xl border border-white/20 pl-12 pr-4 py-4 text-sm sm:text-base font-medium shadow-lg shadow-black/20 outline-none focus:ring-2 focus:ring-amber-400 transition"
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          {showResults ? (
            <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-sm p-4 sm:p-5">
              {!hasResults ? (
                <p className="text-sm text-slate-300">
                  No matches for &ldquo;{trimmed}&rdquo;.{" "}
                  <span className="text-slate-400">
                    Try a 5-digit zip code or a major street name.
                  </span>
                </p>
              ) : null}

              {matchedZips.length > 0 ? (
                <div className="mb-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-300 mb-2">
                    {matchedZips.length === 1
                      ? `Zip ${matchedZips[0].zip_code} · ${normalizeBorough(matchedZips[0].borough)}`
                      : `${matchedZips.length} matching zips`}
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold text-white">
                    {totalInZips.toLocaleString()}
                    <span className="text-sm font-medium text-slate-300 ml-2">
                      active shed{totalInZips === 1 ? "" : "s"}
                      {matchedZips.length > 1 ? " across these zips" : " in this zip"}
                    </span>
                  </div>
                </div>
              ) : null}

              {matchedSheds.length > 0 ? (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Long-standing sheds matching your search
                  </div>
                  <ul className="divide-y divide-white/10">
                    {matchedSheds.map((s, i) => {
                      const years = s.total_days / 365;
                      const tone =
                        years >= 5
                          ? "text-red-300"
                          : years >= 1
                            ? "text-amber-300"
                            : "text-slate-200";
                      return (
                        <li
                          key={`${s.house_no}-${s.street_name}-${i}`}
                          className="py-2.5 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-white truncate">
                              {s.house_no} {s.street_name}
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5">
                              {normalizeBorough(s.borough)}
                              {s.zip_code ? ` · ${s.zip_code}` : ""}
                              {s.permit_count > 1 ? ` · ${s.permit_count} renewals` : ""}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <div className={`text-sm font-bold tabular-nums ${tone}`}>
                              {formatDuration(s.total_days)}
                            </div>
                            <a
                              href={mapsHref(s)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center rounded-md text-slate-300 hover:text-white hover:bg-white/10 p-1.5 transition"
                              aria-label="View on Google Maps"
                            >
                              <MapPin className="w-4 h-4" />
                            </a>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-xs text-slate-400">
              Tip: try a 5-digit zip code (10003) or a street name (Broadway).
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

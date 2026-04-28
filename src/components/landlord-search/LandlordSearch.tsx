"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, ArrowRight } from "lucide-react";
import { cityPath, landlordUrl } from "@/lib/seo";
import type { City } from "@/lib/cities";

interface Result {
  name: string;
  buildingCount: number;
  totalViolations: number;
}

interface Props {
  city: City;
  cityName: string;
}

/**
 * Type-ahead landlord search. Hits /api/landlords?city=X&search=... with a
 * 220ms debounce. Up to 8 results shown in a dropdown, each linking to
 * /[city]/landlord/[name]. Submitting (Enter or button) navigates to the
 * full directory filtered by the query.
 */
export function LandlordSearch({ city, cityName }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[] | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Debounced fetch.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/landlords?city=${encodeURIComponent(city)}&search=${encodeURIComponent(trimmed)}&sort=violations&page=1`,
          { signal: ctrl.signal }
        );
        if (!res.ok) {
          setResults([]);
          return;
        }
        const data = (await res.json()) as { landlords?: Result[] };
        setResults((data.landlords ?? []).slice(0, 8));
        setActiveIdx(-1);
      } catch (e: unknown) {
        if ((e as { name?: string })?.name !== "AbortError") setResults([]);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [query, city]);

  // Close dropdown when clicking outside.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!results || results.length === 0) {
      if (e.key === "Enter" && query.trim()) {
        router.push(`${cityPath("/landlords", city)}?search=${encodeURIComponent(query.trim())}`);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIdx >= 0 && results[activeIdx]) {
        router.push(landlordUrl(results[activeIdx].name, city));
      } else if (query.trim()) {
        router.push(`${cityPath("/landlords", city)}?search=${encodeURIComponent(query.trim())}`);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const showDropdown = open && query.trim().length >= 2;

  return (
    <div ref={wrapRef} className="relative w-full max-w-2xl">
      <form
        action={cityPath("/landlords", city)}
        method="GET"
        className="relative"
        onSubmit={(e) => {
          if (activeIdx >= 0 && results?.[activeIdx]) {
            e.preventDefault();
            router.push(landlordUrl(results[activeIdx].name, city));
          }
        }}
      >
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94a3b8] pointer-events-none" />
        <input
          type="text"
          name="search"
          autoComplete="off"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={`Search ${cityName} landlords by name…`}
          className="w-full pl-14 pr-32 py-4 sm:py-5 text-base sm:text-lg bg-white border border-[#e2e8f0] rounded-xl text-[#0F1D2E] placeholder-[#94a3b8] focus:outline-none focus:border-[#0F1D2E] focus:shadow-[0_0_0_3px_rgba(15,29,46,0.08)] transition-all"
          style={{ fontFamily: 'var(--sans)' }}
        />
        <button
          type="submit"
          className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2.5 text-sm font-semibold bg-[#0F1D2E] text-white rounded-lg hover:bg-[#1e293b] transition-colors flex items-center gap-1.5"
        >
          Search
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>

      {showDropdown && (
        <div className="absolute z-30 left-0 right-0 mt-2 bg-white border border-[#e2e8f0] rounded-xl overflow-hidden shadow-[0_12px_32px_-12px_rgba(15,29,46,0.25),0_0_0_1px_rgba(15,29,46,0.04)]">
          {loading && results === null && (
            <div
              className="px-5 py-4 text-[12px] uppercase tracking-[0.08em] text-[#94a3b8]"
              style={{ fontFamily: 'var(--mono)' }}
            >
              searching…
            </div>
          )}
          {results && results.length === 0 && !loading && (
            <div className="px-5 py-4 text-sm text-[#52606d]">
              No landlords match{" "}
              <span className="font-semibold text-[#0F1D2E]">&ldquo;{query.trim()}&rdquo;</span>.
            </div>
          )}
          {results && results.length > 0 && (
            <>
              <ul className="divide-y divide-[#e2e8f0]">
                {results.map((r, i) => {
                  const active = i === activeIdx;
                  return (
                    <li key={r.name}>
                      <Link
                        href={landlordUrl(r.name, city)}
                        className={
                          active
                            ? "flex items-center gap-3 px-5 py-3 bg-[#f8fafc]"
                            : "flex items-center gap-3 px-5 py-3 hover:bg-[#f8fafc] transition-colors"
                        }
                        onMouseEnter={() => setActiveIdx(i)}
                      >
                        <span
                          className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#94a3b8] tabular-nums w-7"
                          style={{ fontFamily: 'var(--mono)' }}
                        >
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[#0F1D2E] truncate">{r.name}</p>
                          <p
                            className="text-[11px] uppercase tracking-[0.06em] text-[#52606d] tabular-nums"
                            style={{ fontFamily: 'var(--mono)' }}
                          >
                            {r.buildingCount.toLocaleString()} bldg ·{" "}
                            {r.totalViolations.toLocaleString()} viol
                          </p>
                        </div>
                        <ArrowRight
                          className={
                            active
                              ? "w-4 h-4 text-[#0F1D2E] flex-shrink-0"
                              : "w-4 h-4 text-[#cbd5e1] flex-shrink-0"
                          }
                        />
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <Link
                href={`${cityPath("/landlords", city)}?search=${encodeURIComponent(query.trim())}`}
                className="block px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[#0F1D2E] bg-[#f8fafc] border-t border-[#e2e8f0] hover:bg-[#0F1D2E] hover:text-white transition-colors"
                style={{ fontFamily: 'var(--mono)' }}
              >
                See all matches for &ldquo;{query.trim()}&rdquo; →
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}

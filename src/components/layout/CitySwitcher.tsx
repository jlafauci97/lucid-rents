"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MapPin, ChevronDown, Check } from "lucide-react";
import { type City, VALID_CITIES, CITY_META } from "@/lib/cities";
import { useCityFromPath } from "@/lib/city-context";

/**
 * Given the current pathname and city, compute the equivalent path for another city.
 *
 * We use the **internal** city key (e.g. "los-angeles") rather than the external
 * urlPrefix ("CA/Los-Angeles") so that client-side <Link> navigation works
 * without relying on middleware rewrites (which only run on server requests).
 * The internal key matches the [city] dynamic segment directly.
 */
function buildCityPath(pathname: string, fromCity: City, toCity: City): string {
  // The current path may use either the internal key or the external urlPrefix
  // depending on whether we arrived via middleware rewrite or direct navigation.
  const fromInternal = `/${fromCity}`;
  const fromExternal = `/${CITY_META[fromCity].urlPrefix}`;
  const toInternal = `/${toCity}`;

  // Try stripping the external prefix first (longer, more specific)
  if (fromExternal !== fromInternal && pathname.startsWith(fromExternal)) {
    const rest = pathname.slice(fromExternal.length); // e.g. "/search" or ""
    return `${toInternal}${rest || ""}`;
  }

  // Then try stripping the internal prefix
  if (pathname.startsWith(fromInternal)) {
    const rest = pathname.slice(fromInternal.length);
    return `${toInternal}${rest || ""}`;
  }

  // Fallback: just go to the other city's root
  return toInternal;
}

export function CitySwitcher() {
  const city = useCityFromPath();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-sm text-gray-300 hover:text-white transition-colors"
        aria-label="Switch city"
      >
        <MapPin className="w-4 h-4 text-[#6366F1]" />
        <span className="font-medium">{CITY_META[city].name}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-48 bg-[#1A2B3D] border border-white/10 rounded-lg shadow-xl overflow-hidden z-50">
          {VALID_CITIES.map((c) => {
            const isActive = c === city;
            const href = isActive ? pathname : `/${c}`;

            return (
              <Link
                key={c}
                href={href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                  isActive
                    ? "text-white bg-white/5"
                    : "text-gray-300 hover:text-white hover:bg-white/5"
                }`}
              >
                <MapPin
                  className={`w-4 h-4 flex-shrink-0 ${
                    isActive ? "text-[#6366F1]" : "text-gray-500"
                  }`}
                />
                <span className="flex-1">{CITY_META[c].fullName}</span>
                {isActive && (
                  <Check className="w-4 h-4 text-[#6366F1] flex-shrink-0" />
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Inline city switcher for the mobile menu (no dropdown, just a row of options).
 */
export function MobileCitySwitcher() {
  const city = useCityFromPath();
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-2 px-3 py-2.5">
      <MapPin className="w-4 h-4 text-[#6366F1] flex-shrink-0" />
      <span className="text-xs text-gray-400 uppercase tracking-wider mr-1">City</span>
      {VALID_CITIES.map((c) => {
        const isActive = c === city;
        const href = isActive ? pathname : `/${c}`;

        return (
          <Link
            key={c}
            href={href}
            className={`text-sm px-3 py-1 rounded-full transition-colors ${
              isActive
                ? "bg-[#6366F1]/20 text-[#6366F1] font-medium"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            {CITY_META[c].name}
          </Link>
        );
      })}
    </div>
  );
}

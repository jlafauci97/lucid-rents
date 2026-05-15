"use client";

/**
 * Client-side dropdown for the nav city picker.
 * Keeps the mockup's .city-picker markup intact; adds a menu that opens
 * on click, closes on outside-click or Escape, and routes via <Link>.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { VALID_CITIES, CITY_META, type City } from "@/lib/cities";
import { useCityFromPath } from "@/lib/city-context";

interface Props {
  currentCity: City;
}

export function NavCityPicker({ currentCity }: Props) {
  // Root layout is cached across client navigations in Next.js App Router,
  // so the server-rendered `currentCity` prop goes stale after the user
  // navigates between cities via <Link>. Read from the live pathname to
  // always reflect the current URL.
  const pathCity = useCityFromPath();
  const activeCity: City = pathCity ?? currentCity;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const cityName = CITY_META[activeCity]?.name ?? "City";

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        className="city-picker"
        aria-label="Switch city"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        {cityName}
        <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label="Cities"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            minWidth: 220,
            background: "#0F1D2E",
            border: "1px solid rgba(96,165,250,0.25)",
            borderRadius: "var(--radius-sm)",
            boxShadow: "0 20px 40px -12px rgba(0,0,0,0.5)",
            padding: 6,
            zIndex: 50,
          }}
        >
          {VALID_CITIES.map((c) => {
            const meta = CITY_META[c];
            const isActive = c === activeCity;
            return (
              <Link
                key={c}
                href={`/${meta.urlPrefix}`}
                role="option"
                aria-selected={isActive}
                aria-current={isActive ? "true" : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px",
                  borderRadius: 6,
                  color: isActive ? "#60a5fa" : "#fff",
                  background: isActive ? "rgba(96,165,250,0.12)" : "transparent",
                  fontSize: 13,
                  fontWeight: isActive ? 700 : 500,
                  textDecoration: "none",
                }}
                onClick={() => setOpen(false)}
              >
                <span
                  aria-hidden={!isActive}
                  style={{
                    width: 12,
                    display: "inline-flex",
                    justifyContent: "center",
                    color: "#60a5fa",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {isActive ? "✓" : ""}
                </span>
                <span style={{ flex: 1 }}>{meta.fullName}</span>
                <span style={{ opacity: 0.55, fontFamily: "var(--mono)", fontSize: 11 }}>{meta.stateCode}</span>
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { VALID_CITIES, CITY_META, type City } from "@/lib/cities";

interface Props {
  currentCity: City;
}

export function NavV2CityPicker({ currentCity }: Props) {
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

  const current = CITY_META[currentCity];

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "rgba(255,255,255,0.10)",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: "var(--v2-radius-chip)",
          padding: "6px 12px",
          color: "#fff",
          fontFamily: "var(--v2-sans)",
          fontSize: 13,
          fontWeight: 500,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
        aria-label={`Switch city, currently ${current.name}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {/* Pin icon */}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
        {current.name}
        {/* Chevron */}
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transition: "transform 0.15s", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            minWidth: 180,
            background: "var(--v2-surface)",
            border: "1px solid var(--v2-border)",
            borderRadius: "var(--v2-radius-sm)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            zIndex: 100,
            overflow: "hidden",
          }}
        >
          {VALID_CITIES.map((city) => {
            const meta = CITY_META[city];
            const isActive = city === currentCity;
            return (
              <Link
                key={city}
                href={`/${meta.urlPrefix}`}
                role="option"
                aria-selected={isActive}
                onClick={() => setOpen(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 16px",
                  color: isActive ? "var(--v2-brand)" : "var(--v2-ink)",
                  fontFamily: "var(--v2-sans)",
                  fontSize: 14,
                  fontWeight: isActive ? 600 : 400,
                  background: isActive ? "var(--v2-sky)" : "transparent",
                  textDecoration: "none",
                  transition: "background 0.1s",
                }}
              >
                {isActive && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20 6L9 17l-5-5"/>
                    <polyline points="20 6 9 17 4 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                  </svg>
                )}
                {!isActive && <span style={{ width: 12 }} />}
                {meta.fullName}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CITY_META, type City } from "@/lib/cities";

interface Props {
  city: City;
}

export function NavV2Search({ city }: Props) {
  const [query, setQuery] = useState("");
  const router = useRouter();
  const cityPrefix = CITY_META[city].urlPrefix;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    router.push(`/${cityPrefix}/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <form onSubmit={handleSubmit} style={{ flex: 1, maxWidth: 400 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "rgba(255,255,255,0.10)",
          border: "1px solid rgba(255,255,255,0.18)",
          borderRadius: "var(--v2-radius-chip)",
          padding: "6px 14px",
          transition: "border-color 0.15s",
        }}
      >
        {/* Search icon */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search an address, building, or landlord…"
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: "#fff",
            fontFamily: "var(--v2-sans)",
            fontSize: 13,
            minWidth: 0,
          }}
        />
        <kbd
          style={{
            fontFamily: "var(--v2-mono)",
            fontSize: 11,
            color: "rgba(255,255,255,0.35)",
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 4,
            padding: "1px 5px",
            flexShrink: 0,
          }}
        >
          ⌘K
        </kbd>
      </div>
    </form>
  );
}

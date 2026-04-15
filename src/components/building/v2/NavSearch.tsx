"use client";

/**
 * Client-side search input for the v2 nav. Keeps the mockup's .nav-search
 * markup intact: search icon + placeholder text. Replaces the static
 * <span> with a real <input> that submits to /{cityPrefix}/search?q=…
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CITY_META, type City } from "@/lib/cities";

interface Props {
  city: City;
}

export function NavSearch({ city }: Props) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const prefix = CITY_META[city]?.urlPrefix ?? "nyc";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = q.trim();
    if (!trimmed) return;
    router.push(`/${prefix}/search?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <form className="nav-search" role="search" onSubmit={submit}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <input
        type="search"
        placeholder="Search an address, building, or landlord…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Search"
        style={{
          flex: 1,
          background: "transparent",
          border: "none",
          outline: "none",
          color: "#fff",
          font: "inherit",
          padding: 0,
          minWidth: 0,
        }}
      />
    </form>
  );
}

"use client";

/**
 * Nav search input with live autocomplete.
 *
 * - Debounced fetch to `/api/search?q=…&city=…&limit=6`
 * - Dropdown shows matching buildings (address + borough + review count)
 * - Arrow keys navigate, Enter routes to highlighted result (or full-search
 *   page when none is highlighted)
 * - Closes on outside-click / Escape / route change
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CITY_META, type City } from "@/lib/cities";
import { buildingUrl } from "@/lib/seo";

interface Suggestion {
  id: string;
  full_address: string;
  borough: string;
  slug: string;
  review_count?: number | null;
  violation_count?: number | null;
}

interface Props {
  city: City;
}

export function NavSearch({ city }: Props) {
  const router = useRouter();
  const rootRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const prefix = CITY_META[city]?.urlPrefix ?? "nyc";

  // Debounced search
  useEffect(() => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(trimmed)}&city=${city}&limit=6`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error(`search ${res.status}`);
        const json = await res.json();
        const buildings: Suggestion[] = (json.buildings ?? []).slice(0, 6);
        setSuggestions(buildings);
        setActiveIdx(-1);
      } catch (err) {
        if ((err as { name?: string }).name !== "AbortError") {
          setSuggestions([]);
        }
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [q, city]);

  // Outside click / Escape close
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (activeIdx >= 0 && suggestions[activeIdx]) {
      const s = suggestions[activeIdx];
      router.push(buildingUrl({ borough: s.borough, slug: s.slug }, city));
      setOpen(false);
      return;
    }
    const trimmed = q.trim();
    if (!trimmed) return;
    router.push(`/${prefix}/search?q=${encodeURIComponent(trimmed)}`);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    }
  }

  const showDropdown = open && q.trim().length >= 2;

  return (
    <form ref={rootRef} className="nav-search" role="search" onSubmit={submit} style={{ position: "relative" }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <input
        ref={inputRef}
        type="search"
        placeholder="Search an address, building, or landlord…"
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        aria-label="Search"
        aria-autocomplete="list"
        aria-expanded={showDropdown}
        aria-controls="nav-search-results"
      />

      {showDropdown ? (
        <div
          id="nav-search-results"
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            background: "#0F1D2E",
            border: "1px solid rgba(96,165,250,0.25)",
            borderRadius: 10,
            boxShadow: "0 20px 40px -12px rgba(0,0,0,0.5)",
            padding: 4,
            zIndex: 60,
            maxHeight: 380,
            overflowY: "auto",
          }}
        >
          {loading && suggestions.length === 0 ? (
            <div style={{ padding: "10px 12px", color: "rgba(255,255,255,0.6)", fontSize: 13, fontFamily: "var(--mono, ui-monospace, monospace)" }}>Searching…</div>
          ) : null}
          {!loading && suggestions.length === 0 ? (
            <div style={{ padding: "10px 12px", color: "rgba(255,255,255,0.6)", fontSize: 13 }}>
              No matches. Press Enter to search instead.
            </div>
          ) : null}
          {suggestions.map((s, i) => (
            <Link
              key={s.id}
              href={buildingUrl({ borough: s.borough, slug: s.slug }, city)}
              role="option"
              aria-selected={activeIdx === i}
              onClick={() => setOpen(false)}
              onMouseEnter={() => setActiveIdx(i)}
              style={{
                display: "block",
                padding: "8px 10px",
                borderRadius: 6,
                background: activeIdx === i ? "rgba(96,165,250,0.16)" : "transparent",
                color: "#fff",
                textDecoration: "none",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {s.full_address}
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontFamily: "var(--mono, ui-monospace, monospace)", marginTop: 2 }}>
                {s.borough}
                {typeof s.review_count === "number" && s.review_count > 0 ? ` · ${s.review_count} review${s.review_count === 1 ? "" : "s"}` : ""}
                {typeof s.violation_count === "number" && s.violation_count > 0 ? ` · ${s.violation_count} violation${s.violation_count === 1 ? "" : "s"}` : ""}
              </div>
            </Link>
          ))}
          {suggestions.length > 0 ? (
            <Link
              href={`/${prefix}/search?q=${encodeURIComponent(q.trim())}`}
              onClick={() => setOpen(false)}
              style={{
                display: "block",
                marginTop: 4,
                padding: "8px 10px",
                borderRadius: 6,
                background: "rgba(255,255,255,0.04)",
                color: "#60a5fa",
                fontSize: 12,
                fontWeight: 700,
                textAlign: "center",
                textDecoration: "none",
              }}
            >
              See all results for &quot;{q.trim()}&quot; →
            </Link>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}

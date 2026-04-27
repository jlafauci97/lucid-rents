"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import type { City } from "@/lib/cities";
import { useCityFromPath } from "@/lib/city-context";
import { SearchOverlay } from "./SearchOverlay";

interface Props {
  city: City;
}

/**
 * Toolbar pill button that opens the site-wide search overlay. Shown as
 * a magnifying-glass + "Search" pill on desktop and an icon-only button
 * on mobile. ⌘K / Ctrl+K toggles the overlay open from anywhere.
 */
export function SearchTrigger({ city: propCity }: Props) {
  const pathCity = useCityFromPath();
  const city: City = pathCity ?? propCity;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      const isTyping =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === "/" && !isTyping && !open) {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="nav-search-trigger"
        aria-label="Open search"
        aria-haspopup="dialog"
      >
        <Search className="nav-search-trigger-icon" aria-hidden="true" />
        <span className="nav-search-trigger-label">Search</span>
      </button>
      {open ? (
        <SearchOverlay city={city} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

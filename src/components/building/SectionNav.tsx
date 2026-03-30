"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const SECTIONS = [
  { id: "reviews", label: "Reviews" },
  { id: "rent", label: "Rent" },
  { id: "amenities", label: "Amenities" },
  { id: "violation-trends", label: "Violations" },
  { id: "location", label: "Location" },
  { id: "building-details", label: "Details" },
  { id: "transit", label: "Transit" },
  { id: "crime", label: "Crime" },
] as const;

const NAV_HEIGHT = 48; // height of this sticky nav
const NAVBAR_HEIGHT = 64; // h-16 main navbar
const SCROLL_OFFSET = NAV_HEIGHT + NAVBAR_HEIGHT + 16;

export function SectionNav() {
  const [activeId, setActiveId] = useState<string>("reviews");
  const [visible, setVisible] = useState(false);
  const [existingSections, setExistingSections] = useState<string[]>([]);
  const navRef = useRef<HTMLElement>(null);
  const isClickScrolling = useRef(false);

  // On mount, determine which sections actually exist on the page
  useEffect(() => {
    const found = SECTIONS.filter((s) => document.getElementById(s.id)).map((s) => s.id);
    setExistingSections(found);
  }, []);

  // Show nav after scrolling past BuildingHeader
  useEffect(() => {
    function onScroll() {
      // Show once scrolled past ~300px (roughly past BuildingHeader)
      setVisible(window.scrollY > 300);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // IntersectionObserver to track active section
  const handleIntersect = useCallback((entries: IntersectionObserverEntry[]) => {
    if (isClickScrolling.current) return;

    // Find the topmost visible section
    const visibleEntries = entries.filter((e) => e.isIntersecting);
    if (visibleEntries.length === 0) return;

    // Pick the one closest to top of viewport
    let closest = visibleEntries[0];
    for (const entry of visibleEntries) {
      if (entry.boundingClientRect.top < closest.boundingClientRect.top) {
        closest = entry;
      }
    }
    setActiveId(closest.target.id);
  }, []);

  useEffect(() => {
    if (existingSections.length === 0) return;

    const observer = new IntersectionObserver(handleIntersect, {
      rootMargin: `-${SCROLL_OFFSET}px 0px -60% 0px`,
      threshold: 0,
    });

    for (const id of existingSections) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [existingSections, handleIntersect]);

  function scrollToSection(id: string) {
    const el = document.getElementById(id);
    if (!el) return;

    isClickScrolling.current = true;
    setActiveId(id);

    const top = el.getBoundingClientRect().top + window.scrollY - SCROLL_OFFSET;
    window.scrollTo({ top, behavior: "smooth" });

    // Re-enable observer after scroll settles
    setTimeout(() => {
      isClickScrolling.current = false;
    }, 800);
  }

  // Scroll active tab into view in the nav bar
  useEffect(() => {
    if (!navRef.current) return;
    const activeBtn = navRef.current.querySelector(`[data-section="${activeId}"]`);
    if (activeBtn) {
      (activeBtn as HTMLElement).scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [activeId]);

  const filtered = SECTIONS.filter((s) => existingSections.includes(s.id));

  if (filtered.length === 0) return null;

  return (
    <nav
      ref={navRef}
      className={`sticky top-16 z-30 bg-white border-b border-[#e2e8f0] transition-all duration-200 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex overflow-x-auto scrollbar-hide -mb-px" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
          {filtered.map((section) => (
            <button
              key={section.id}
              data-section={section.id}
              onClick={() => scrollToSection(section.id)}
              className={`shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeId === section.id
                  ? "border-[#3B82F6] text-[#3B82F6]"
                  : "border-transparent text-[#64748b] hover:text-[#0F1D2E] hover:border-[#cbd5e1]"
              }`}
            >
              {section.label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}

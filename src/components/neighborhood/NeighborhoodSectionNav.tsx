"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  BarChart3,
  Building2,
  TrendingUp,
  Siren,
  Activity,
  DollarSign,
  Star,
  AlertTriangle,
  Footprints,
  Users,
  Sparkles,
  ArrowLeftRight,
  HelpCircle,
  MapPin,
} from "lucide-react";
import { T } from "@/lib/design-tokens";

const SECTIONS = [
  { id: "grades", label: "Grades", icon: BarChart3 },
  { id: "stats", label: "Stats", icon: Building2 },
  { id: "rankings", label: "Rankings", icon: TrendingUp },
  { id: "crime", label: "Crime", icon: Siren },
  { id: "pulse", label: "Pulse", icon: Activity },
  { id: "rent-trends", label: "Rent Trends", icon: DollarSign },
  { id: "best-apartments", label: "Best Apts", icon: Star },
  { id: "flagged-buildings", label: "Flagged", icon: AlertTriangle },
  { id: "walkability", label: "Walkability", icon: Footprints },
  { id: "demographics", label: "Demographics", icon: Users },
  { id: "vibe-check", label: "Vibe Check", icon: Sparkles },
  { id: "compare", label: "Compare", icon: ArrowLeftRight },
  { id: "faq", label: "FAQ", icon: HelpCircle },
  { id: "related", label: "Related", icon: MapPin },
] as const;

const NAV_HEIGHT = 56;
const NAVBAR_HEIGHT = 64;
const SCROLL_OFFSET = NAV_HEIGHT + NAVBAR_HEIGHT + 16;

export function NeighborhoodSectionNav() {
  const [activeId, setActiveId] = useState<string>("grades");
  const [isSticky, setIsSticky] = useState(false);
  const [existingSections, setExistingSections] = useState<string[]>([]);
  const navRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const isClickScrolling = useRef(false);

  // Watch for sections appearing in the DOM (Suspense boundaries stream them in)
  useEffect(() => {
    function scan() {
      const found = SECTIONS.filter((s) => document.getElementById(s.id)).map((s) => s.id);
      setExistingSections((prev) => {
        if (prev.length === found.length && prev.every((id, i) => id === found[i])) return prev;
        return found;
      });
    }
    scan();
    // Re-scan as Suspense boundaries resolve and new sections appear
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  // Track when nav becomes sticky using a sentinel element
  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsSticky(!entry.isIntersecting);
      },
      { threshold: 0 }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, []);

  // IntersectionObserver to track active section
  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (isClickScrolling.current) return;

      const visibleEntries = entries.filter((e) => e.isIntersecting);
      if (visibleEntries.length === 0) return;

      let closest = visibleEntries[0];
      for (const entry of visibleEntries) {
        if (entry.boundingClientRect.top < closest.boundingClientRect.top) {
          closest = entry;
        }
      }
      setActiveId(closest.target.id);
    },
    []
  );

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

    setTimeout(() => {
      isClickScrolling.current = false;
    }, 800);
  }

  // Scroll active tab into view horizontally (without moving the page vertically)
  useEffect(() => {
    if (!navRef.current) return;
    const container = navRef.current;
    const activeBtn = container.querySelector(
      `[data-section="${activeId}"]`
    ) as HTMLElement | null;
    if (!activeBtn) return;

    const containerRect = container.getBoundingClientRect();
    const btnRect = activeBtn.getBoundingClientRect();
    const scrollLeft =
      container.scrollLeft +
      (btnRect.left - containerRect.left) -
      containerRect.width / 2 +
      btnRect.width / 2;

    container.scrollTo({ left: scrollLeft, behavior: "smooth" });
  }, [activeId]);

  const filtered = SECTIONS.filter((s) => existingSections.includes(s.id));

  if (filtered.length === 0) return null;

  return (
    <>
      {/* Sentinel: when this scrolls out of view, the shadow appears */}
      <div ref={sentinelRef} className="h-0" aria-hidden="true" />

      <nav
        className={`sticky top-16 z-30 transition-shadow duration-200 ${
          isSticky ? "shadow-lg shadow-black/20" : ""
        }`}
        style={{
          backgroundColor: "#0F1D2E",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div
            ref={navRef}
            className="flex overflow-x-auto -mb-px gap-1 py-1"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {filtered.map((section) => {
              const Icon = section.icon;
              const isActive = activeId === section.id;

              return (
                <button
                  key={section.id}
                  data-section={section.id}
                  onClick={() => scrollToSection(section.id)}
                  className="group shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150"
                  style={{
                    color: isActive ? "#FFFFFF" : "rgba(255,255,255,0.5)",
                    backgroundColor: isActive ? `${T.accent}25` : "transparent",
                    boxShadow: isActive ? `0 0 12px ${T.accent}40` : "none",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = "rgba(255,255,255,0.85)";
                      e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.05)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = "rgba(255,255,255,0.5)";
                      e.currentTarget.style.backgroundColor = "transparent";
                    }
                  }}
                >
                  <Icon
                    className="w-4 h-4 transition-colors"
                    style={{ color: "inherit" }}
                  />
                  <span className="whitespace-nowrap">{section.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
}

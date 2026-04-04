"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Star,
  BarChart3,
  MessageSquare,
  DollarSign,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  MapPin,
  Building2,
  Train,
  Shield,
  GraduationCap,
  TreePine,
} from "lucide-react";
import { T } from "@/lib/design-tokens";

const SECTIONS = [
  { id: "verdict", label: "Verdict", icon: Star },
  { id: "report-card", label: "Report Card", icon: BarChart3 },
  { id: "rent-intelligence", label: "Rent Intel", icon: DollarSign },
  { id: "pulse", label: "Building Pulse", icon: TrendingUp },
  { id: "reviews", label: "Reviews", icon: MessageSquare },
  { id: "rent", label: "Listings", icon: DollarSign },
  { id: "amenities", label: "Amenities", icon: Sparkles },
  { id: "violations", label: "Issues", icon: AlertTriangle },
  { id: "location", label: "Map", icon: MapPin },
  { id: "building-details", label: "Details", icon: Building2 },
  { id: "transit", label: "Transit", icon: Train },
  { id: "schools", label: "Schools", icon: GraduationCap },
  { id: "recreation", label: "Parks", icon: TreePine },
  { id: "crime", label: "Crime", icon: Shield },
] as const;

const NAV_HEIGHT = 56;
const NAVBAR_HEIGHT = 64;
const SCROLL_OFFSET = NAV_HEIGHT + NAVBAR_HEIGHT + 16;

export function SectionNav() {
  const [activeId, setActiveId] = useState<string>("reviews");
  const [isSticky, setIsSticky] = useState(false);
  const [existingSections, setExistingSections] = useState<string[]>([]);
  const navRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const isClickScrolling = useRef(false);

  // On mount, determine which sections actually exist on the page
  useEffect(() => {
    const found = SECTIONS.filter((s) => document.getElementById(s.id)).map(
      (s) => s.id
    );
    setExistingSections(found);
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
        className={`sticky top-16 z-30 backdrop-blur-xl transition-shadow duration-200 ${
          isSticky ? "shadow-sm" : ""
        }`}
        style={{
          backgroundColor: `${T.surface}E6`,
          borderBottom: `1px solid ${T.border}`,
        }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
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
                    color: isActive ? T.accent : T.text3,
                    backgroundColor: isActive ? `${T.accent}10` : "transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = T.text2;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = T.text3;
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

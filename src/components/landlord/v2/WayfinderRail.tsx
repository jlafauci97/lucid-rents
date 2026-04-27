"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cityPath } from "@/lib/seo";
import type { City } from "@/lib/cities";

interface Props {
  grade: string;
  displayName: string;
  city: City;
  slug: string;
}

const SECTIONS = [
  { id: "glance",   label: "Portfolio at a glance", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 5-5"/></svg> },
  { id: "record",   label: "The record", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg> },
  { id: "casefile", label: "Case file", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 21h8M12 17v4M7 3h10l4 8H3z"/></svg> },
  { id: "buildings", label: "The buildings", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg> },
  { id: "ownership", label: "Ownership", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="7" r="4"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></svg> },
  { id: "voice",    label: "Tenant voice", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
  { id: "where",    label: "Where they operate", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> },
  { id: "compare",  label: "Compare & act", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3h13M3 12h18M3 21h13"/></svg> },
  { id: "faq",      label: "FAQ", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/></svg> },
];

export function WayfinderRail({ grade, displayName, city, slug }: Props) {
  // Initialise to null so the server renders no active item; the client
  // computes the active section in useEffect after mount. This avoids any
  // hydration mismatch on the `active` className that would otherwise abort
  // hydration and orphan the scroll listener.
  const [activeId, setActiveId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Scroll-based tracking instead of IntersectionObserver. The streamed
  // section components swap their DOM nodes when Suspense resolves, which
  // would orphan IO observation targets. Re-querying #ids on each scroll
  // tick handles the swap transparently and also dodges layout-coordinate
  // issues from V2Zoom's `zoom: 0.9` on desktop.
  useEffect(() => {
    const update = () => {
      const trigger = window.innerHeight * 0.3;
      let bestId = SECTIONS[0].id;
      let bestTop = -Infinity;
      for (const s of SECTIONS) {
        const el = document.getElementById(s.id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        if (top <= trigger && top > bestTop) {
          bestTop = top;
          bestId = s.id;
        }
      }
      setActiveId((prev: string | null) => (prev === bestId ? prev : bestId));
    };

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        update();
        ticking = false;
      });
    };

    update();
    // Sections stream in via Suspense, so the initial update() may run before
    // their DOM nodes exist. Re-run update() as the page settles so the
    // active highlight resolves to a real section.
    const settleTimers = [120, 400, 1200, 3000].map((ms) =>
      window.setTimeout(update, ms)
    );
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      for (const t of settleTimers) window.clearTimeout(t);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // Split the name into two lines at the space closest to the middle.
  const spaceIdx = (() => {
    if (!displayName.includes(" ")) return -1;
    const target = Math.floor(displayName.length / 2);
    let best = -1;
    let bestDist = Infinity;
    for (let i = 0; i < displayName.length; i++) {
      if (displayName[i] === " ") {
        const d = Math.abs(i - target);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
    }
    return best;
  })();
  const firstLine = spaceIdx > 0 ? displayName.slice(0, spaceIdx) : displayName;
  const secondLine = spaceIdx > 0 ? displayName.slice(spaceIdx + 1) : null;

  return (
    <aside
      className="wayfinder"
      // Explicit sticky override: the shared `.v2 .wayfinder` rule declares
      // `position: sticky; top: 84px;`, but the `zoom: 0.9` applied to the
      // root `.v2` container via V2Zoom can break sticky in some browsers.
      // Pinning inline guarantees the rail tracks the viewport on scroll.
      style={{ position: "sticky", top: 20 }}
    >
      <header className="way-head">
        <div className="way-grade">{grade}</div>
        <div className="way-meta">
          <div className="way-eyebrow">Portfolio Score</div>
          <div className="way-name">
            {firstLine}
            {secondLine ? <><br />{secondLine}</> : null}
          </div>
        </div>
      </header>

      <ol className="waylist">
        {SECTIONS.map((s) => (
          <li key={s.id} className={activeId === s.id ? "active" : undefined}>
            <a href={`#${s.id}`}>
              <span className="wicon">{s.icon}</span>
              {s.label}
            </a>
          </li>
        ))}
      </ol>

      <div className="tools">
        <a
          className="tool"
          style={{ cursor: "pointer" }}
          onClick={() => {
            navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
          {copied ? "Copied!" : "Share"}
        </a>
        <Link href={cityPath("/compare", city)} className="tool">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 3h13M3 12h18M3 21h13"/>
          </svg>
          Compare buildings
        </Link>
        <a href={`#casefile`} className="tool">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 21h8M12 17v4M7 3h10l4 8H3z"/>
          </svg>
          Jump to case file
        </a>
      </div>

      <span data-slug={slug} style={{ display: "none" }} />
    </aside>
  );
}

"use client";

import { useEffect, useState } from "react";

type Section = { id: string; label: string; tone: string };

const SECTIONS: Section[] = [
  { id: "stats",      label: "Overview",     tone: "#ec4899" },
  { id: "worst",      label: "Shame",        tone: "#ec4899" },
  { id: "watchlist",  label: "Watchlist",    tone: "#f97316" },
  { id: "rankings",   label: "Rankings",     tone: "#7c3aed" },
  { id: "movers",     label: "Movers",       tone: "#10b981" },
  { id: "era-size",   label: "Era & size",   tone: "#3b82f6" },
  { id: "boroughs",   label: "Boroughs",     tone: "#f59e0b" },
  { id: "zips",       label: "Top zips",     tone: "#7c3aed" },
  { id: "complaints", label: "Complaints",   tone: "#ec4899" },
  { id: "best",       label: "Best",         tone: "#10b981" },
  { id: "directory",  label: "Directory",    tone: "#3b82f6" },
];

const SANS = `"Geist", "Inter", system-ui, sans-serif`;
const MONO = `"Geist Mono", ui-monospace, monospace`;

export function BentoWayfinder() {
  const [activeId, setActiveId] = useState("stats");

  useEffect(() => {
    // Track which section is "active" based on scroll position. Active =
    // the last section whose top has scrolled above the nav line.
    // Direct scroll listener is more reliable than IntersectionObserver
    // for sections of wildly different heights.
    const compute = () => {
      // Distance from viewport top below which a section is considered
      // "passed" — global nav (~68px) + wayfinder (~60px) + small buffer.
      const NAV_OFFSET = 140;
      let nextActive = SECTIONS[0].id;
      for (const s of SECTIONS) {
        const el = document.getElementById(s.id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        if (top - NAV_OFFSET <= 0) {
          nextActive = s.id;
        } else {
          break;
        }
      }
      setActiveId((cur) => (cur === nextActive ? cur : nextActive));
    };

    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        compute();
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    compute();

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // Auto-scroll the active pill into view in the horizontal scroll rail
  useEffect(() => {
    const rail = document.getElementById("bento-wayfinder-rail");
    const pill = rail?.querySelector(`a[data-section-id="${activeId}"]`) as HTMLElement | null;
    if (rail && pill) {
      const railRect = rail.getBoundingClientRect();
      const pillRect = pill.getBoundingClientRect();
      if (pillRect.left < railRect.left || pillRect.right > railRect.right) {
        pill.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      }
    }
  }, [activeId]);

  return (
    <>
      <nav
        aria-label="Page sections"
        className="bento-wayfinder"
      >
        <div id="bento-wayfinder-rail" className="bento-wayfinder-rail">
          <span className="bento-wayfinder-label">Jump to</span>
          {SECTIONS.map((s, i) => {
            const active = activeId === s.id;
            return (
              <span key={s.id} className="bento-wayfinder-item">
                {i > 0 && <span className="bento-wayfinder-sep" aria-hidden="true" />}
                <a
                  href={`#${s.id}`}
                  data-section-id={s.id}
                  className={`bento-wayfinder-pill ${active ? "is-active" : ""}`}
                  style={{
                    color: active ? "#0a0e1a" : "rgba(255,255,255,0.78)",
                    background: active ? "#fff" : "transparent",
                  }}
                >
                  <span
                    className="bento-wayfinder-dot"
                    style={{
                      background: active ? s.tone : "transparent",
                      borderColor: s.tone,
                    }}
                  />
                  {s.label}
                </a>
              </span>
            );
          })}
        </div>
      </nav>

      <style>{`
        .bento-wayfinder {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          top: auto;
          z-index: 40;
          background: #0a0e1a;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          font-family: ${SANS};
        }

        .bento-wayfinder-rail {
          display: flex;
          align-items: stretch;
          overflow-x: auto;
          padding: 0 16px;
          scrollbar-width: none;
          -ms-overflow-style: none;
          max-width: 1320px;
          margin: 0 auto;
          height: 64px;
          padding-bottom: env(safe-area-inset-bottom);
        }
        .bento-wayfinder-rail::-webkit-scrollbar { display: none; }

        .bento-wayfinder-label {
          font-family: ${MONO};
          font-size: 10px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.45);
          font-weight: 600;
          padding-right: 14px;
          margin-right: 6px;
          border-right: 1px solid rgba(255, 255, 255, 0.10);
          white-space: nowrap;
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
        }

        .bento-wayfinder-item {
          display: inline-flex;
          align-items: center;
          flex-shrink: 0;
        }

        .bento-wayfinder-sep {
          display: inline-block;
          width: 1px;
          height: 18px;
          background: rgba(255, 255, 255, 0.10);
          flex-shrink: 0;
        }

        .bento-wayfinder-pill {
          font-family: ${SANS};
          font-size: 13px;
          font-weight: 500;
          padding: 11px 14px;
          margin: 0 4px;
          border-radius: 8px;
          white-space: nowrap;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          flex-shrink: 0;
          border: 1px solid transparent;
          transition: background 160ms, color 160ms, border-color 160ms;
          min-height: 40px;
        }
        .bento-wayfinder-pill.is-active {
          font-weight: 600;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3), 0 8px 20px -8px rgba(0, 0, 0, 0.5);
        }
        .bento-wayfinder-pill:not(.is-active):hover {
          background: rgba(255, 255, 255, 0.06);
          color: #fff !important;
        }

        .bento-wayfinder-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          border: 1px solid;
          transition: all 160ms;
          flex-shrink: 0;
        }
        .bento-wayfinder-pill.is-active .bento-wayfinder-dot {
          border-color: transparent;
        }

        @media (min-width: 768px) {
          .bento-wayfinder {
            position: sticky;
            top: 60px;
            bottom: auto;
            z-index: 30;
            border-top: none;
            border-bottom: 1px solid rgba(255, 255, 255, 0.10);
          }
          .bento-wayfinder-rail {
            padding: 0 24px;
            height: 60px;
          }
        }
        @media (min-width: 1024px) {
          .bento-wayfinder {
            top: 68px;
          }
        }
      `}</style>
    </>
  );
}

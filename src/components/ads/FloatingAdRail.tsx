"use client";

import { usePathname } from "next/navigation";
import { AdUnit } from "./AdUnit";
import { SLOT_FLOATING_RAIL } from "./ad-slots";
import { shouldShowAdsForPath } from "./should-show-ads";

interface FloatingAdRailProps {
  /** Number of vertical ads to stack. Default 2. */
  count?: number;
}

/**
 * Vertical ad rail that sits in the empty space to the right of max-w-7xl
 * page content on wide screens. Renders nothing under 1600px so it never
 * overlaps with content (max-w-7xl is 1280px → centered leaves 320px of
 * gutter on each side at 1920px).
 *
 * Why fixed-position instead of a grid column?
 *   - Doesn't disturb the 30+ existing pages already using <AdSidebar>
 *   - Each page keeps its current max-w-7xl centered layout
 *   - Mobile is automatically unaffected (display:none under 1600px)
 *
 * The 1600px breakpoint matches: 1280px content + 16px gutter + 300px ad =
 * 1596px minimum viewport before the rail has room to appear without
 * overlapping content.
 */
export function FloatingAdRail({ count = 2 }: FloatingAdRailProps) {
  const pathname = usePathname();
  if (!shouldShowAdsForPath(pathname)) return null;

  return (
    <aside
      aria-label="Advertisement"
      style={{
        position: "fixed",
        top: 96,
        right: 16,
        width: 300,
        maxHeight: "calc(100vh - 120px)",
        overflowY: "auto",
        zIndex: 10,
        // Hidden by default — only revealed when there's room outside the
        // 1280px content column. Uses a media query injected via the
        // surrounding component because inline style can't do @media.
      }}
      className="floating-ad-rail"
    >
      <style>{`
        .floating-ad-rail { display: none; }
        @media (min-width: 1600px) { .floating-ad-rail { display: block; } }
      `}</style>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {Array.from({ length: count }).map((_, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <AdUnit
            key={i}
            slot={SLOT_FLOATING_RAIL}
            format="vertical"
            minHeight={600}
            responsive={false}
          />
        ))}
      </div>
    </aside>
  );
}

import { AdUnit } from "./AdUnit";
import { SLOT_SIDEBAR_VERTICAL } from "./ad-slots";

interface AdRailProps {
  /** Number of vertical ads to stack. Default 2 — more = banner blindness. */
  count?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Stacked vertical ads for a sidebar column. Use inside the building page's
 * existing `.sr` right column, below the SideRail content.
 *
 * Each ad reserves 600px for a 300x600 skyscraper. Three ads = 1800px of
 * stacked content, which is roughly the height of a typical building page,
 * so you'll see the second/third ads as the user scrolls past mid-page.
 *
 * Hidden under 900px — the v2 .body grid collapses to a single column at
 * that breakpoint, which would reflow these verticals below the main
 * content. 300x600 skyscrapers are a desktop format; mobile users already
 * get horizontal in-content ads + the sticky anchor, so dumping verticals
 * at the bottom of mobile is mostly wasted impressions.
 */
export function AdRail({ count = 2, className, style }: AdRailProps) {
  return (
    <>
      <style>{`
        @media (max-width: 900px) {
          .ad-rail-hide-mobile { display: none !important; }
        }
      `}</style>
      <div
        className={`ad-rail-hide-mobile${className ? ` ${className}` : ""}`}
        style={{ display: "flex", flexDirection: "column", gap: 24, ...style }}
      >
        {Array.from({ length: count }).map((_, i) => (
          // Stacked ads use the same slot ID — AdSense permits this and serves
          // distinct creatives. Per AdSense policy, no special slot config needed.
          // eslint-disable-next-line react/no-array-index-key
          <AdUnit
            key={i}
            slot={SLOT_SIDEBAR_VERTICAL}
            format="vertical"
            minHeight={600}
            responsive={false}
            style={{ width: "100%", maxWidth: 300 }}
          />
        ))}
      </div>
    </>
  );
}

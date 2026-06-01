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
 */
export function AdRail({ count = 2, className, style }: AdRailProps) {
  return (
    <div
      className={className}
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
  );
}

import { AdUnit } from "./AdUnit";
import { SLOT_IN_FEED, SLOT_IN_FEED_LAYOUT_KEY } from "./ad-slots";

interface InFeedAdProps {
  /**
   * Override the default in-feed layout key. Defaults to the value baked at
   * unit creation time (see ad-slots.ts). Override only if you create a
   * separate styled in-feed unit for a specific feed.
   */
  layoutKey?: string;
  className?: string;
}

/**
 * In-feed ad designed to slot between cards in listing pages (rankings,
 * search results, building lists, feed).
 *
 * Style it to match the surrounding feed (card vs row) so it reads as
 * native — AdSense bids significantly higher for in-feed units that
 * match their container.
 *
 * Recommended placement: every 5-8 results.
 */
export function InFeedAd({ layoutKey = SLOT_IN_FEED_LAYOUT_KEY, className }: InFeedAdProps) {
  return (
    <div className={className} style={{ width: "100%" }}>
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "rgba(15,29,46,0.4)",
          marginBottom: 6,
        }}
      >
        Advertisement
      </div>
      <AdUnit
        slot={SLOT_IN_FEED}
        format="fluid"
        layout="in-feed"
        layoutKey={layoutKey}
        minHeight={200}
      />
    </div>
  );
}

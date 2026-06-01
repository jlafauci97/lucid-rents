import { FloatingAdRail } from "@/components/ads/FloatingAdRail";
import { InContentAd } from "@/components/ads/InContentAd";
import { MultiplexAd } from "@/components/ads/MultiplexAd";

interface AdSidebarProps {
  children: React.ReactNode;
  /** Number of vertical ads in the floating side rail. Default 2. */
  railCount?: number;
  /**
   * When true, also inject a horizontal in-content ad after children (good
   * for short pages without a natural midpoint). Defaults to true.
   */
  withInContentAd?: boolean;
  /**
   * When true, render a Multiplex ("related content" grid) ad after the
   * children. Best for long-form / article-style pages where the user has
   * just finished reading — gives Google a high-CTR native unit.
   * Opt-in (defaults to false) so listing pages don't get a redundant
   * "related" widget below their in-feed ads.
   */
  withMultiplexAd?: boolean;
}

/**
 * Used as a wrapper around top-level page content on static / listing pages.
 * Adds a floating vertical ad rail that appears in the empty space outside
 * the centered max-w container on wide screens (>=1600px), plus one
 * horizontal in-content ad after the page content.
 *
 * Design notes:
 *  - Children are rendered unchanged → existing page layouts stay intact
 *  - FloatingAdRail is position:fixed → no impact on grid/flex layout
 *  - InContentAd appears at the end so it doesn't break heading/hero flow
 *
 * Excluded pages (auth, dashboard, embed, etc.) are filtered inside
 * FloatingAdRail via shouldShowAdsForPath.
 */
export function AdSidebar({
  children,
  railCount = 2,
  withInContentAd = true,
  withMultiplexAd = false,
}: AdSidebarProps) {
  return (
    <>
      {children}
      {withInContentAd ? (
        <div style={{ maxWidth: 970, margin: "0 auto", padding: "0 16px" }}>
          <InContentAd />
        </div>
      ) : null}
      {withMultiplexAd ? (
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 16px" }}>
          <MultiplexAd />
        </div>
      ) : null}
      <FloatingAdRail count={railCount} />
    </>
  );
}

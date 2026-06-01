"use client";

import { usePathname } from "next/navigation";
import { AdUnit } from "./AdUnit";
import { SLOT_FOOTER_BANNER } from "./ad-slots";
import { shouldShowAdsForPath } from "./should-show-ads";

/**
 * Horizontal banner ad rendered below the global footer on every page,
 * except auth/dashboard/embed/error pages (see should-show-ads.ts).
 *
 * Renders a 90px-min responsive horizontal banner — fits leaderboard
 * (728x90), large mobile banner (320x100), and most responsive sizes
 * Google serves into a wide horizontal slot.
 */
export function FooterAd() {
  const pathname = usePathname();
  if (!shouldShowAdsForPath(pathname)) return null;

  return (
    <div
      style={{
        background: "#0F1D2E",
        borderTop: "1px solid rgba(255,255,255,0.05)",
        padding: "16px 0",
      }}
      aria-label="Advertisement"
    >
      <div style={{ maxWidth: 970, margin: "0 auto", padding: "0 16px" }}>
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.4)",
            marginBottom: 8,
            textAlign: "center",
          }}
        >
          Advertisement
        </div>
        <AdUnit
          slot={SLOT_FOOTER_BANNER}
          format="horizontal"
          minHeight={90}
        />
      </div>
    </div>
  );
}

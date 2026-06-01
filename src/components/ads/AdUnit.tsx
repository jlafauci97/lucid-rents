"use client";

import { useEffect, useRef } from "react";
import { ADSENSE_CLIENT_ID, isRealSlot } from "./ad-slots";

interface AdUnitProps {
  slot: string;
  /**
   * AdSense ad format. `auto` is the default responsive format; the rest map to
   * dashboard unit types — pick the one that matches the unit you created.
   * `autorelaxed` is the Multiplex unit format.
   */
  format?: "auto" | "autorelaxed" | "fluid" | "rectangle" | "vertical" | "horizontal";
  /** Used for in-article and in-feed formats. */
  layout?: "in-article" | "in-feed";
  /** Used for in-feed format — generated in the AdSense dashboard. */
  layoutKey?: string;
  /** Allow ad to expand to full container width (default true for display ads). */
  responsive?: boolean;
  /**
   * Reserved height in px to prevent CLS while the ad loads. Pick the minimum
   * height the ad format will render at — under-reserving causes layout shift,
   * over-reserving leaves empty space on no-fill.
   */
  minHeight: number;
  className?: string;
  style?: React.CSSProperties;
}

declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>>;
  }
}

/**
 * Base AdSense ad unit. All higher-level ad components wrap this.
 *
 * Behavior:
 *  - Pushes to `window.adsbygoogle` exactly once on mount (useRef guard)
 *  - Renders a placeholder div while waiting for the AdSense script
 *  - No-ops with a dev-only warning when the slot ID is still a TODO_ placeholder
 *  - Reserves space (`minHeight`) to prevent CLS even on no-fill
 */
export function AdUnit({
  slot,
  format = "auto",
  layout,
  layoutKey,
  responsive = true,
  minHeight,
  className,
  style,
}: AdUnitProps) {
  const pushed = useRef(false);

  useEffect(() => {
    if (pushed.current) return;
    if (!isRealSlot(slot)) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // adsbygoogle.js not loaded yet (cookie blocker, slow network, ad block).
      // Silent no-op — the ad just won't render, which is the desired outcome.
    }
  }, [slot]);

  if (!isRealSlot(slot)) {
    // Placeholder mode — show a visible reserved space in dev so the layout
    // can be eyeballed, render nothing in production.
    if (process.env.NODE_ENV !== "production") {
      return (
        <div
          className={className}
          style={{
            minHeight,
            background:
              "repeating-linear-gradient(45deg, rgba(59,130,246,0.06), rgba(59,130,246,0.06) 12px, rgba(59,130,246,0.12) 12px, rgba(59,130,246,0.12) 24px)",
            border: "1px dashed rgba(59,130,246,0.4)",
            color: "rgba(15,29,46,0.5)",
            fontSize: 12,
            fontFamily: "ui-monospace, monospace",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 8,
            ...style,
          }}
        >
          ad slot · {slot}
        </div>
      );
    }
    return null;
  }

  return (
    <div className={className} style={{ minHeight, overflow: "hidden", ...style }}>
      <ins
        className="adsbygoogle"
        style={{ display: "block", minHeight }}
        data-ad-client={ADSENSE_CLIENT_ID}
        data-ad-slot={slot}
        data-ad-format={format}
        {...(layout ? { "data-ad-layout": layout } : {})}
        {...(layoutKey ? { "data-ad-layout-key": layoutKey } : {})}
        data-full-width-responsive={responsive ? "true" : "false"}
      />
    </div>
  );
}

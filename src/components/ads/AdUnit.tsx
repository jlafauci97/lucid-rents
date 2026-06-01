"use client";

import { useEffect, useRef } from "react";
import { ADSENSE_CLIENT_ID, isRealSlot } from "./ad-slots";

/** Distance (px) from the viewport edge at which we trigger the ad push.
 *  Larger value = ads start loading earlier as the user scrolls toward
 *  them, so they're more likely to be filled by the time they're visible.
 *  Smaller value = less wasted bandwidth on ads the user never reaches. */
const VIEWPORT_PREFETCH_MARGIN_PX = 300;

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
 *  - Defers `adsbygoogle.push()` until the slot is within ~one viewport of
 *    visibility (IntersectionObserver). Ads at the bottom of a long page
 *    never load if the user doesn't scroll there → big TBT / network savings.
 *  - Pushes exactly once (useRef guard survives observer fire + re-render)
 *  - Falls back to immediate push on browsers without IntersectionObserver
 *  - Renders a dev-only striped placeholder for TODO_ slots
 *  - Reserves `minHeight` to prevent CLS even on no-fill
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
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (pushed.current) return;
    if (!isRealSlot(slot)) return;
    const el = containerRef.current;
    if (!el) return;

    function push() {
      if (pushed.current) return;
      pushed.current = true;
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch {
        // adsbygoogle.js not loaded yet (cookie blocker, slow network, ad block).
        // Silent no-op — the ad just won't render, which is the desired outcome.
      }
    }

    // Fallback for browsers without IntersectionObserver (effectively zero
    // share of real traffic in 2026, but keeps the component safe).
    if (typeof IntersectionObserver === "undefined") {
      push();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        push();
        observer.disconnect();
      },
      { rootMargin: `${VIEWPORT_PREFETCH_MARGIN_PX}px 0px` },
    );
    observer.observe(el);

    return () => observer.disconnect();
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
    <div
      ref={containerRef}
      className={className}
      style={{ minHeight, overflow: "hidden", ...style }}
    >
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

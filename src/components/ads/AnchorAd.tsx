"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ADSENSE_CLIENT_ID, SLOT_MOBILE_ANCHOR, isRealSlot } from "./ad-slots";
import { shouldShowAdsForPath } from "./should-show-ads";

/**
 * Mobile-only sticky anchor ad at bottom of screen. AdSense's highest-RPM
 * mobile placement.
 *
 * Constraints:
 *  - Only one anchor ad per page (AdSense policy)
 *  - Hidden on desktop (>= 768px) — too obtrusive for desktop UX
 *  - User-dismissable (close button)
 *  - Excluded from auth/dashboard/error pages via shouldShowAdsForPath
 *
 * Uses the standard `<ins class="adsbygoogle">` markup with `data-ad-format="auto"`
 * since AdSense's auto-anchor unit type works via a different (Auto Ads) flow.
 * For a manual anchor we render a fixed bottom container with a regular display ad.
 */
export function AnchorAd() {
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(false);
  const pushed = useRef(false);

  useEffect(() => {
    if (pushed.current) return;
    if (!isRealSlot(SLOT_MOBILE_ANCHOR)) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // ads.js not loaded — silent no-op
    }
  }, []);

  if (!shouldShowAdsForPath(pathname)) return null;
  if (dismissed) return null;

  return (
    <>
      <style>{`
        .anchor-ad { display: none; }
        @media (max-width: 767px) {
          .anchor-ad {
            display: block;
            position: fixed;
            bottom: 0; left: 0; right: 0;
            background: #fff;
            border-top: 1px solid rgba(15,29,46,0.12);
            box-shadow: 0 -2px 8px rgba(0,0,0,0.08);
            z-index: 9999;
            padding: 4px 4px 0;
          }
          .anchor-ad-close {
            position: absolute;
            top: -28px; right: 4px;
            width: 24px; height: 24px;
            background: rgba(15,29,46,0.85);
            color: #fff;
            border: none; border-radius: 12px;
            font-size: 14px; line-height: 1;
            cursor: pointer;
            display: flex; align-items: center; justify-content: center;
          }
        }
      `}</style>
      <div className="anchor-ad" aria-label="Advertisement">
        <button
          type="button"
          className="anchor-ad-close"
          aria-label="Close advertisement"
          onClick={() => setDismissed(true)}
        >
          ×
        </button>
        {isRealSlot(SLOT_MOBILE_ANCHOR) ? (
          <ins
            className="adsbygoogle"
            style={{ display: "block", minHeight: 60, width: "100%" }}
            data-ad-client={ADSENSE_CLIENT_ID}
            data-ad-slot={SLOT_MOBILE_ANCHOR}
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        ) : process.env.NODE_ENV !== "production" ? (
          <div
            style={{
              minHeight: 60,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              color: "rgba(15,29,46,0.5)",
              fontFamily: "ui-monospace, monospace",
            }}
          >
            anchor ad slot · {SLOT_MOBILE_ANCHOR}
          </div>
        ) : null}
      </div>
    </>
  );
}

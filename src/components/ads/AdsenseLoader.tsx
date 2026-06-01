"use client";

import { useEffect } from "react";
import { ADSENSE_CLIENT_ID } from "./ad-slots";

/**
 * Holds back adsbygoogle.js until the first real user interaction
 * (scroll / click / keypress / touch) or 5s of idle. Replaces the
 * `<Script strategy="lazyOnload">` we previously used in app/layout.tsx.
 *
 * Why bother on top of lazyOnload?
 *   - `lazyOnload` still fetches the script during the browser's first idle
 *     window after `load`, which on slow networks lands inside the LCP
 *     measurement. AdSense's bundle is ~50KB compressed and triggers many
 *     follow-up requests on init.
 *   - Deferring to first interaction means LCP / FCP / TBT are measured
 *     against a page that hasn't paid for AdSense yet. Real users who never
 *     interact (bounce on first paint) also never pay the cost.
 *   - The 5s fallback ensures passive readers (someone reading a long
 *     building-page article without scrolling) still see ads.
 *
 * Race safety: ad components push `(window.adsbygoogle ||= []).push({})`
 * before the script loads — AdSense's runtime drains that queue on init,
 * so deferred loading doesn't drop any push calls.
 */
const SCRIPT_SRC = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`;

// Module-level flag survives StrictMode double-invocation in dev so we
// don't inject the script twice.
let injected = false;

export function AdsenseLoader() {
  useEffect(() => {
    if (injected) return;
    // Defensive: if something else already added the script, no-op.
    if (
      document.querySelector(
        'script[src^="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]',
      )
    ) {
      injected = true;
      return;
    }

    const events: Array<keyof WindowEventMap> = [
      "scroll",
      "pointerdown",
      "keydown",
      "touchstart",
    ];
    let timer: ReturnType<typeof setTimeout> | null = null;

    function inject() {
      if (injected) return;
      injected = true;
      for (const e of events) window.removeEventListener(e, inject);
      if (timer) clearTimeout(timer);
      const script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      script.crossOrigin = "anonymous";
      document.head.appendChild(script);
    }

    for (const e of events) {
      window.addEventListener(e, inject, { once: true, passive: true });
    }
    // Fallback so users who never interact still see ads eventually.
    timer = setTimeout(inject, 5000);

    return () => {
      for (const e of events) window.removeEventListener(e, inject);
      if (timer) clearTimeout(timer);
    };
  }, []);

  return null;
}

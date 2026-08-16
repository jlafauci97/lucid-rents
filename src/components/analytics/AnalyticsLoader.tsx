"use client";

import { useEffect } from "react";

/**
 * Holds back gtag.js (GA4) and Microsoft Clarity until the first real user
 * interaction (scroll / click / keypress / touch) or 5s of idle — the same
 * proven pattern as AdsenseLoader, and for the same reason: these scripts
 * were the largest main-thread cost in the initial load (gtag alone is
 * ~166KB and the pair contributed most of the 1.1-1.5s TBT the Aug 2026
 * audit measured on every page).
 *
 * Measurement trade-offs, considered:
 *   - GA: visits shorter than 5s with zero interaction go uncounted. Those
 *     are bounces by definition; losing them overstates engagement slightly
 *     but loses no actionable signal. Everyone else is counted — at first
 *     interaction or the 5s idle fallback.
 *   - Clarity: session replay starts at the triggering interaction, so the
 *     recording loses the pre-interaction beat that the old afterInteractive
 *     strategy captured (the previous inline comment defended that choice).
 *     Post-audit, the CWV cost of paying Clarity's boot on every page —
 *     including every Googlebot render — outweighs the first second of
 *     replay footage.
 *   - Crawlers and Lighthouse never interact, so they never pay for either
 *     script. That is the point: lab and Googlebot-experienced latency now
 *     measure the page, not the analytics stack.
 *
 * The gtag stub + dataLayer queue is installed synchronously below, so any
 * gtag() calls made before injection are queued and drained on load —
 * nothing is dropped.
 */

const GA_MEASUREMENT_ID = "G-FS7Q3PF982";
const CLARITY_PROJECT_ID = "xvce52ac0c";

// Module-level flag survives StrictMode double-invocation in dev.
let injected = false;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    clarity?: { (...args: unknown[]): void; q?: unknown[] };
  }
}

export function AnalyticsLoader() {
  useEffect(() => {
    if (injected) return;
    if (document.querySelector('script[src^="https://www.googletagmanager.com/gtag/js"]')) {
      injected = true;
      return;
    }

    // Install queue stubs immediately so calls made before the scripts load
    // are preserved (both runtimes drain their queues on init).
    window.dataLayer = window.dataLayer || [];
    if (!window.gtag) {
      window.gtag = function gtag() {
        // eslint-disable-next-line prefer-rest-params
        window.dataLayer!.push(arguments);
      };
      window.gtag("js", new Date());
      window.gtag("config", GA_MEASUREMENT_ID);
    }
    if (!window.clarity) {
      const clarityStub: { (...args: unknown[]): void; q?: unknown[] } = function (
        ...args: unknown[]
      ) {
        (clarityStub.q = clarityStub.q || []).push(args);
      };
      window.clarity = clarityStub;
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

      const gtagScript = document.createElement("script");
      gtagScript.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
      gtagScript.async = true;
      document.head.appendChild(gtagScript);

      const clarityScript = document.createElement("script");
      clarityScript.src = `https://www.clarity.ms/tag/${CLARITY_PROJECT_ID}`;
      clarityScript.async = true;
      document.head.appendChild(clarityScript);
    }

    for (const e of events) {
      window.addEventListener(e, inject, { once: true, passive: true });
    }
    // Fallback so passive readers are still measured.
    timer = setTimeout(inject, 5000);

    return () => {
      for (const e of events) window.removeEventListener(e, inject);
      if (timer) clearTimeout(timer);
    };
  }, []);

  return null;
}

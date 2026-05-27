"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Forces scroll-to-top on forward navigation (Link clicks, router.push).
 *
 * Next.js's built-in scroll-to-top fails when middleware/proxy rewrites the
 * URL (e.g. /CA/Los-Angeles/... → /los-angeles/...): the client router can't
 * map the visible URL to a route segment, so it skips the scroll reset and
 * the user lands at whatever scroll position the previous page had.
 *
 * Skips browser back/forward so the framework's history-based scroll
 * restoration still works there. Skips hash anchors so #section links land
 * on the section.
 *
 * Effect registration is deferred to requestIdleCallback so the first paint
 * doesn't pay for an effect that can't fire (no prior pathname to compare
 * against on initial render).
 */
export function ScrollToTopOnNav() {
  const [ready, setReady] = useState(false);
  const pathname = usePathname();
  const isBackForward = useRef(false);

  useEffect(() => {
    type IdleWindow = Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    const w = window as IdleWindow;
    const hasIdle = typeof w.requestIdleCallback === "function";
    const handle: number = hasIdle && w.requestIdleCallback
      ? w.requestIdleCallback(() => setReady(true), { timeout: 2000 })
      : window.setTimeout(() => setReady(true), 500);
    return () => {
      if (hasIdle) {
        w.cancelIdleCallback?.(handle);
      } else {
        clearTimeout(handle);
      }
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const onPopState = () => {
      isBackForward.current = true;
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    if (isBackForward.current) {
      isBackForward.current = false;
      return;
    }
    if (window.location.hash) return;
    window.scrollTo(0, 0);
  }, [pathname, ready]);

  return null;
}

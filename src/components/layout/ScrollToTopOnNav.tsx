"use client";

import { useEffect, useRef } from "react";
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
 */
export function ScrollToTopOnNav() {
  const pathname = usePathname();
  const isBackForward = useRef(false);

  useEffect(() => {
    const onPopState = () => {
      isBackForward.current = true;
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (isBackForward.current) {
      isBackForward.current = false;
      return;
    }
    if (window.location.hash) return;
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Once-only IntersectionObserver visibility hook. Replaces framer-motion's
 * useInView for the two sitewide components (FadeIn, GradeBar) whose effects
 * are achievable with CSS transitions — framer-motion was the last heavy
 * dependency landing in shared chunks without a dynamic boundary.
 */
export function useInViewOnce<T extends Element>(rootMargin = "0px") {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return { ref, inView };
}

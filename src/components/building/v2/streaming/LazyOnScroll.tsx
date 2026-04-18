"use client";

/**
 * LazyOnScroll — client-side viewport gate for below-the-fold sections.
 *
 * Mounts `children` only after the wrapper scrolls within `rootMargin` of the
 * viewport. Until then it renders `fallback` (typically a skeleton matching the
 * section's shape). Once the children mount we disconnect the observer so it
 * never fires again.
 *
 * Important: in the App Router a `"use client"` component can still accept
 * async server components as its `children` prop — Next.js resolves those on
 * the server, serializes them into the stream, and hands the resulting RSC
 * tree down through this client boundary.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback: ReactNode;
  /** How far ahead of the viewport to start mounting (default 400px). */
  rootMargin?: string;
}

export function LazyOnScroll({ children, fallback, rootMargin = "400px" }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // SSR-safe guard — bail to visible=true in environments without IO.
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [rootMargin]);

  return <div ref={ref}>{visible ? children : fallback}</div>;
}

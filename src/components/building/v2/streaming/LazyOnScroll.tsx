"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback: ReactNode;
  rootMargin?: string;
}

/**
 * LazyOnScroll — defers rendering of `children` until the placeholder scrolls
 * close enough to the viewport. Uses IntersectionObserver with a generous
 * rootMargin so the real content starts loading before the user sees the gap.
 */
export function LazyOnScroll({ children, fallback, rootMargin = "400px" }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [rootMargin]);

  return <div ref={ref}>{visible ? children : fallback}</div>;
}

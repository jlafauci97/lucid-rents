"use client";

import { useInViewOnce } from "@/lib/useInViewOnce";

interface FadeInProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

/** CSS-transition fade/rise on first viewport entry. Framer-motion-free —
 * same curve and timing as the previous motion.div implementation. */
export function FadeIn({ children, delay = 0, className = "" }: FadeInProps) {
  const { ref, inView } = useInViewOnce<HTMLDivElement>("-40px");

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0)" : "translateY(24px)",
        transition: `opacity 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${delay}s, transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

"use client";
import { useEffect } from "react";

/**
 * Applies the 90% desktop zoom only on wide viewports. Mobile renders at 100%
 * so the content doesn't overflow horizontally.
 * CSS `zoom` is stripped by PostCSS so we have to set it via JS at runtime.
 */
export function V2Zoom() {
  useEffect(() => {
    const apply = () => {
      const root = document.querySelector<HTMLElement>("div.v2");
      if (!root) return;
      if (window.innerWidth >= 900) {
        root.style.zoom = "0.9";
      } else {
        root.style.zoom = "";
      }
    };
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, []);
  return null;
}

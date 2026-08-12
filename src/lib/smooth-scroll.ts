/**
 * Quick, eased in-page scroll for the wayfinder section nav (building + landlord
 * v2 pages).
 *
 * Why JS and not CSS `scroll-behavior: smooth`?  The native smooth scroll has no
 * speed control — its duration grows with distance, so jumping to a far section
 * on these long pages crawls. The product ask is a *quick* glide, so we drive a
 * short, distance-clamped easeOut ourselves via requestAnimationFrame.
 *
 * Two page-specific wrinkles this handles:
 *  - V2Zoom applies `zoom: 0.9` to `div.v2` on desktop. `scrollY` + a section's
 *    `getBoundingClientRect().top` are both in rendered (post-zoom) px, so the
 *    absolute target needs no zoom correction — but the section's
 *    `scroll-margin-top` is authored in the element's own (pre-zoom) px, so we
 *    scale it by the zoom factor to land exactly where a native anchor jump would.
 *  - Sections set the sticky-header offset via `scroll-mt-*`
 *    (`scroll-margin-top`); we read it instead of hardcoding so there's one
 *    source of truth.
 *
 * The animation is interruptible (any wheel / touch / scroll-key bails out so we
 * never fight the user) and honours `prefers-reduced-motion` with an instant jump.
 */

// Only one programmatic scroll may run at a time; a second nav click cancels the
// first so two rAF loops don't fight over the scroll position.
let cancelActive: (() => void) | null = null;

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

function currentZoom(): number {
  const root = document.querySelector<HTMLElement>("div.v2");
  if (!root) return 1;
  // V2Zoom sets this inline; prefer it, then computed, then no zoom.
  const inline = parseFloat(root.style.zoom);
  if (inline > 0) return inline;
  const computed = parseFloat(getComputedStyle(root).zoom || "");
  return computed > 0 ? computed : 1;
}

/**
 * Smoothly scroll the viewport so the element with `id` sits just below the
 * sticky header, matching where a native `#id` anchor jump would land.
 */
export function smoothScrollToId(id: string): void {
  if (typeof window === "undefined") return;
  cancelActive?.();

  const el = document.getElementById(id);
  if (!el) return;

  const marginTop = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
  const startY = window.scrollY;
  const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  const rawTarget = startY + el.getBoundingClientRect().top - marginTop * currentZoom();
  const targetY = Math.max(0, Math.min(rawTarget, maxY));
  const distance = targetY - startY;
  if (Math.abs(distance) < 2) return;

  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    window.scrollTo(0, targetY);
    return;
  }

  // Quick: ~280ms for short hops, scaling mildly with distance, capped so even
  // a full-page jump never drags past ~half a second.
  const duration = Math.min(520, Math.max(280, Math.abs(distance) * 0.4));

  // Guard against any element-level `scroll-behavior: smooth` turning each
  // per-frame scrollTo into its own animation that compounds with ours.
  const docEl = document.documentElement;
  const prevBehavior = docEl.style.scrollBehavior;
  docEl.style.scrollBehavior = "auto";

  let startTime: number | null = null;
  let raf = 0;
  let done = false;

  const cleanup = () => {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    window.removeEventListener("wheel", cancel, { capture: false } as EventListenerOptions);
    window.removeEventListener("touchstart", cancel, { capture: false } as EventListenerOptions);
    window.removeEventListener("keydown", onKey, true);
    docEl.style.scrollBehavior = prevBehavior;
    if (cancelActive === cancel) cancelActive = null;
  };

  function cancel() {
    cleanup();
  }

  const onKey = (e: KeyboardEvent) => {
    if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " ", "Spacebar"].includes(e.key)) {
      cancel();
    }
  };

  // Passive: we don't preventDefault — a real input just ends our glide and the
  // user takes over.
  window.addEventListener("wheel", cancel, { passive: true });
  window.addEventListener("touchstart", cancel, { passive: true });
  window.addEventListener("keydown", onKey, true);
  cancelActive = cancel;

  const step = (now: number) => {
    if (done) return;
    if (startTime === null) startTime = now;
    const t = Math.min(1, (now - startTime) / duration);
    window.scrollTo(0, startY + distance * easeOutCubic(t));
    if (t < 1) {
      raf = requestAnimationFrame(step);
    } else {
      cleanup();
    }
  };
  raf = requestAnimationFrame(step);
}

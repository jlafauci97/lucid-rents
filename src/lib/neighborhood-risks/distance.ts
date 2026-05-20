/**
 * Formats a distance in miles. Distances under 0.1 mi are labeled "on block".
 */
export function formatDistance(mi: number): string {
  if (mi < 0.1) return "on block";
  return `${mi.toFixed(2)} mi`;
}

/**
 * Estimated walking time in whole minutes at 3 mph (20 min/mi). Minimum 1 minute.
 */
export function walkMinutes(mi: number): number {
  return Math.max(1, Math.round(mi * 20));
}

/**
 * True when within roughly a city block (< 0.1 mi).
 */
export function isOnBlock(mi: number): boolean {
  return mi < 0.1;
}

/**
 * Compact label combining distance and walk time, e.g. "0.31 mi · 6 min walk".
 * Returns "on block" for short distances where walk time is meaningless.
 */
export function distanceLabel(mi: number): string {
  if (isOnBlock(mi)) return "on block";
  return `${formatDistance(mi)} · ${walkMinutes(mi)} min walk`;
}

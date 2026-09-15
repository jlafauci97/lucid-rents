import type { CSSProperties } from "react";

interface Props {
  updatedAt: string | null | undefined;
}

function absoluteDate(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

const wrapStyle: CSSProperties = {
  marginTop: 32,
  paddingTop: 16,
  borderTop: "1px solid var(--v2-line, rgba(0,0,0,0.08))",
  fontSize: 13,
  color: "var(--v2-muted, #6b7280)",
  textAlign: "center",
};

export function LastUpdated({ updatedAt }: Props) {
  if (!updatedAt) return null;
  const abs = absoluteDate(updatedAt);
  if (!abs) return null;
  // Absolute date only — a "3 days ago" relative stamp computed from
  // Date.now() made every ISR regeneration a *changed* output, and Vercel
  // bills an ISR write only when the stored output changed. With the page
  // otherwise deterministic, unchanged buildings regenerate for free.
  return (
    <div className="building-last-updated" style={wrapStyle}>
      Building record last updated{" "}
      <time dateTime={updatedAt}>{abs}</time>
      . Sourced from HPD, DOB, 311, and Lucid Rents data syncs.
    </div>
  );
}

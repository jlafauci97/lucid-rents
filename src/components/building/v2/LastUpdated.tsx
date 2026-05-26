import type { CSSProperties } from "react";

interface Props {
  updatedAt: string | null | undefined;
}

const DAY_MS = 86_400_000;
const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function relativeFromNow(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const diffDays = Math.round((then - Date.now()) / DAY_MS);
  if (Math.abs(diffDays) >= 30) {
    const months = Math.round(diffDays / 30);
    return rtf.format(months, "month");
  }
  if (Math.abs(diffDays) >= 1) return rtf.format(diffDays, "day");
  const diffHours = Math.round((then - Date.now()) / 3_600_000);
  if (Math.abs(diffHours) >= 1) return rtf.format(diffHours, "hour");
  return rtf.format(0, "day");
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
  const rel = relativeFromNow(updatedAt);
  const abs = absoluteDate(updatedAt);
  if (!abs) return null;
  return (
    <div className="building-last-updated" style={wrapStyle}>
      Building record last updated{" "}
      <time dateTime={updatedAt} title={abs}>
        {rel || abs}
      </time>
      . Sourced from HPD, DOB, 311, and Lucid Rents data syncs.
    </div>
  );
}

"use client";

import { useState } from "react";

interface Row {
  id: string;
  source: "HPD" | "DOB" | "311" | "OTHER";
  date: string;
  category: string;
  class: string | null;
  status: string | null;
  description: string;
}

type Tab = "HPD" | "DOB" | "311";

const TAB_LABELS: Record<Tab, string> = {
  HPD: "HPD Violations",
  DOB: "DOB Violations",
  "311": "311 Complaints",
};

const TAB_COLORS: Record<Tab, string> = {
  HPD: "var(--v2-bad)",
  DOB: "var(--v2-brand)",
  "311": "var(--v2-warn)",
};

function classBadge(cls: string | null): React.ReactNode {
  if (!cls) return null;
  const upper = cls.toUpperCase();
  let bg = "var(--v2-paper-2)";
  let color = "var(--v2-ink-mute)";
  if (upper.includes("C") || upper.includes("IMMED")) {
    bg = "#fee2e2";
    color = "#b91c1c";
  } else if (upper.includes("B") || upper.includes("HAZ")) {
    bg = "#fff7ed";
    color = "#c2410c";
  } else if (upper.includes("A") || upper.includes("NON")) {
    bg = "#f0fdf4";
    color = "#15803d";
  }
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 999,
        background: bg,
        color,
        fontFamily: "var(--v2-mono)",
        fontSize: 10,
        fontWeight: 600,
        textTransform: "uppercase" as const,
        letterSpacing: "0.05em",
        whiteSpace: "nowrap" as const,
      }}
    >
      {cls}
    </span>
  );
}

function statusBadge(status: string | null): React.ReactNode {
  if (!status) return null;
  const upper = status.toUpperCase();
  const isOpen = upper.includes("OPEN") || upper.includes("ACTIVE") || upper.includes("IN PROGRESS");
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 999,
        background: isOpen ? "#fee2e2" : "var(--v2-paper-2)",
        color: isOpen ? "#b91c1c" : "var(--v2-ink-mute)",
        fontFamily: "var(--v2-mono)",
        fontSize: 10,
        fontWeight: 600,
        textTransform: "uppercase" as const,
        letterSpacing: "0.05em",
        whiteSpace: "nowrap" as const,
      }}
    >
      {status}
    </span>
  );
}

function formatDate(d: string): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

export function RecentViolationsTabs({ rows }: { rows: Row[] }) {
  const [tab, setTab] = useState<Tab>("HPD");
  const filtered = rows.filter((r) => r.source === tab);

  const countFor = (t: Tab) => rows.filter((r) => r.source === t).length;

  return (
    <div>
      {/* Tab row */}
      <div
        role="tablist"
        style={{
          display: "flex",
          gap: 2,
          borderBottom: "2px solid var(--v2-border)",
          marginBottom: 0,
          overflowX: "auto" as const,
        }}
      >
        {(["HPD", "DOB", "311"] as Tab[]).map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              role="tab"
              aria-selected={active}
              aria-controls={`tab-panel-${t}`}
              id={`tab-${t}`}
              onClick={() => setTab(t)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                  const tabs: Tab[] = ["HPD", "DOB", "311"];
                  const idx = tabs.indexOf(t);
                  const next = e.key === "ArrowRight"
                    ? tabs[(idx + 1) % tabs.length]
                    : tabs[(idx - 1 + tabs.length) % tabs.length];
                  setTab(next);
                  const nextBtn = document.getElementById(`tab-${next}`);
                  nextBtn?.focus();
                }
              }}
              style={{
                padding: "10px 16px",
                border: "none",
                borderBottom: active ? `2px solid ${TAB_COLORS[t]}` : "2px solid transparent",
                marginBottom: -2,
                background: "transparent",
                fontFamily: "var(--v2-sans)",
                fontSize: 13,
                fontWeight: active ? 600 : 500,
                color: active ? "var(--v2-ink)" : "var(--v2-ink-mute)",
                cursor: "pointer",
                transition: "color 0.1s, border-bottom-color 0.1s",
                whiteSpace: "nowrap" as const,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {TAB_LABELS[t]}
              <span
                style={{
                  fontFamily: "var(--v2-mono)",
                  fontSize: 11,
                  color: active ? TAB_COLORS[t] : "var(--v2-ink-faint)",
                }}
              >
                ({countFor(t)})
              </span>
            </button>
          );
        })}
      </div>

      {/* Violation rows */}
      {filtered.length === 0 ? (
        <div
          role="tabpanel"
          id={`tab-panel-${tab}`}
          aria-labelledby={`tab-${tab}`}
          style={{
            padding: "24px",
            fontFamily: "var(--v2-sans)",
            fontSize: 14,
            color: "var(--v2-ink-mute)",
            textAlign: "center" as const,
            background: "var(--v2-paper)",
            border: "1px solid var(--v2-border)",
            borderTop: "none",
            borderRadius: "0 0 var(--v2-radius-sm) var(--v2-radius-sm)",
          }}
        >
          No recent {TAB_LABELS[tab].toLowerCase()} on record.
        </div>
      ) : (
        <ul
          role="tabpanel"
          id={`tab-panel-${tab}`}
          aria-labelledby={`tab-${tab}`}
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            border: "1px solid var(--v2-border)",
            borderTop: "none",
            borderRadius: "0 0 var(--v2-radius-sm) var(--v2-radius-sm)",
            overflow: "hidden",
          }}
        >
          {filtered.map((row, i) => (
            <li
              key={row.id}
              style={{
                padding: "14px 16px",
                borderTop: i > 0 ? "1px solid var(--v2-border)" : undefined,
                display: "flex",
                flexDirection: "column" as const,
                gap: 6,
                background: "var(--v2-surface)",
              }}
            >
              {/* Header row */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap" as const,
                  gap: 8,
                  alignItems: "center",
                }}
              >
                {classBadge(row.class)}
                {statusBadge(row.status)}
                <span
                  style={{
                    marginLeft: "auto",
                    fontFamily: "var(--v2-mono)",
                    fontSize: 11,
                    color: "var(--v2-ink-mute)",
                    whiteSpace: "nowrap" as const,
                  }}
                >
                  {formatDate(row.date)}
                </span>
              </div>
              {/* Description */}
              <p
                style={{
                  margin: 0,
                  fontFamily: "var(--v2-sans)",
                  fontSize: 13,
                  color: "var(--v2-ink-soft)",
                  lineHeight: 1.5,
                }}
              >
                {row.description.length > 120
                  ? row.description.slice(0, 120) + "…"
                  : row.description || row.category}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import Link from "next/link";
import { regionSlug } from "@/lib/seo";
import { CITY_META } from "@/lib/cities";
import type { Building } from "@/types";
import type { TimelineEvent, TimelineEventType } from "@/lib/timeline";
import type { City } from "@/lib/cities";

// ── Type badge colors per event type ─────────────────────────────────────────

const TYPE_META: Record<
  TimelineEventType,
  { label: string; bg: string; color: string; dot: string }
> = {
  hpd_violation:  { label: "HPD",        bg: "#fee2e2", color: "#dc2626", dot: "#ef4444" },
  dob_violation:  { label: "DOB",        bg: "#ffedd5", color: "#c2410c", dot: "#f97316" },
  complaint_311:  { label: "311",        bg: "#fef9c3", color: "#a16207", dot: "#eab308" },
  litigation:     { label: "Litigation", bg: "#ede9fe", color: "#7c3aed", dot: "#8b5cf6" },
  bedbug:         { label: "Bedbugs",    bg: "#fdf2e9", color: "#92400e", dot: "#92400e" },
  eviction:       { label: "Eviction",   bg: "#fee2e2", color: "#7f1d1d", dot: "#991b1b" },
  permit:         { label: "Permit",     bg: "#dbeafe", color: "#1d4ed8", dot: "#3b82f6" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: TimelineEventType }) {
  const meta = TYPE_META[type] ?? { label: type, bg: "#f1f5f9", color: "#64748b", dot: "#94a3b8" };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 4,
        background: meta.bg,
        color: meta.color,
        fontFamily: "var(--v2-mono)",
        fontSize: 10,
        fontWeight: 600,
        textTransform: "uppercase" as const,
        letterSpacing: "0.06em",
        flexShrink: 0,
      }}
    >
      {meta.label}
    </span>
  );
}

function TimelineRow({ event, isLast }: { event: TimelineEvent; isLast: boolean }) {
  const meta = TYPE_META[event.type] ?? TYPE_META.hpd_violation;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "20px 1fr",
        gap: "0 16px",
        paddingBottom: isLast ? 0 : 24,
      }}
    >
      {/* Left gutter: dot + line */}
      <div
        style={{
          display: "flex",
          flexDirection: "column" as const,
          alignItems: "center",
          paddingTop: 4,
        }}
      >
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: meta.dot,
            border: "2px solid var(--v2-surface, #fff)",
            boxShadow: `0 0 0 2px ${meta.dot}30`,
            flexShrink: 0,
            zIndex: 1,
          }}
        />
        {!isLast && (
          <div
            style={{
              flex: 1,
              width: 1,
              background: "var(--v2-border, #e2e8f0)",
              marginTop: 4,
            }}
          />
        )}
      </div>

      {/* Right: content */}
      <div style={{ paddingBottom: isLast ? 0 : 4 }}>
        {/* Date + badge row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 4,
            flexWrap: "wrap" as const,
          }}
        >
          <span
            style={{
              fontFamily: "var(--v2-mono)",
              fontSize: 11,
              color: "var(--v2-ink-mute)",
              letterSpacing: "0.04em",
            }}
          >
            {formatDate(event.date)}
          </span>
          <TypeBadge type={event.type} />
        </div>

        {/* Title */}
        <div
          style={{
            fontFamily: "var(--v2-sans)",
            fontSize: 14,
            fontWeight: 600,
            color: "var(--v2-ink)",
            marginBottom: 2,
            lineHeight: 1.4,
          }}
        >
          {event.title}
        </div>

        {/* Description */}
        {event.description && (
          <div
            style={{
              fontFamily: "var(--v2-sans)",
              fontSize: 13,
              color: "var(--v2-ink-mute)",
              lineHeight: 1.5,
            }}
          >
            {event.description}
          </div>
        )}
      </div>
    </div>
  );
}

// ── S07: Main export ──────────────────────────────────────────────────────────

interface Props {
  timeline: TimelineEvent[];
  building: Building;
  city: City;
}

export function S07_History({ timeline, building, city }: Props) {
  const cityPrefix = CITY_META[city].urlPrefix;
  const boroughSlug = building.borough ? regionSlug(building.borough) : "unknown";
  const timelineUrl = `/${cityPrefix}/building/${boroughSlug}/${building.slug}/timeline`;

  const DISPLAY_CAP = 20;
  const displayEvents = timeline.slice(0, DISPLAY_CAP);
  const hasMore = timeline.length > DISPLAY_CAP;

  return (
    <section
      id="history"
      style={{
        paddingTop: 80,
        borderTop: "1px dashed var(--v2-border)",
        marginTop: 40,
      }}
    >
      {/* Section header */}
      <div style={{ marginBottom: 28 }}>
        <div
          style={{
            fontFamily: "var(--v2-mono)",
            fontSize: 11,
            textTransform: "uppercase" as const,
            letterSpacing: "0.1em",
            color: "var(--v2-ink-mute)",
            marginBottom: 8,
          }}
        >
          07 · History
        </div>
        <h2
          style={{
            fontFamily: "var(--v2-serif)",
            fontSize: "clamp(24px, 3vw, 32px)",
            fontWeight: 700,
            color: "var(--v2-ink)",
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          History of the building
        </h2>
      </div>

      {displayEvents.length === 0 ? (
        /* Empty state */
        <div
          style={{
            background: "var(--v2-paper)",
            border: "1px solid var(--v2-border)",
            borderRadius: "var(--v2-radius-sm)",
            padding: "40px 24px",
            textAlign: "center" as const,
          }}
        >
          <p
            style={{
              fontFamily: "var(--v2-sans)",
              fontSize: 14,
              color: "var(--v2-ink-mute)",
              margin: 0,
            }}
          >
            No recorded events yet for this building.
          </p>
        </div>
      ) : (
        <div
          style={{
            background: "var(--v2-paper)",
            border: "1px solid var(--v2-border)",
            borderRadius: "var(--v2-radius-sm)",
            padding: "28px 24px",
          }}
        >
          {/* Timeline list */}
          <div>
            {displayEvents.map((event, idx) => (
              <TimelineRow
                key={event.id}
                event={event}
                isLast={idx === displayEvents.length - 1 && !hasMore}
              />
            ))}
          </div>

          {/* "View full history" link */}
          {hasMore && (
            <div
              style={{
                borderTop: "1px solid var(--v2-border)",
                marginTop: 16,
                paddingTop: 16,
              }}
            >
              <Link
                href={timelineUrl}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontFamily: "var(--v2-sans)",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--v2-brand)",
                  textDecoration: "none",
                }}
              >
                View full history
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </Link>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

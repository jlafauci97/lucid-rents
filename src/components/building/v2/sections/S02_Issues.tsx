import type { BuildingV2Data } from "@/app/[city]/building/[borough]/[slug]/v2/_data";
import { TrendChart } from "./TrendChart";
import { RecentViolationsTabs } from "./RecentViolationsTabs";

interface Props {
  issues: BuildingV2Data["issues"];
  buildingName: string;
}

// ── Source count cards ────────────────────────────────────────────────────────
interface SourceCardProps {
  label: string;
  count: number;
  descriptor: string;
  accent: string;
}

function SourceCard({ label, count, descriptor, accent }: SourceCardProps) {
  return (
    <div
      style={{
        background: "var(--v2-surface)",
        border: "1px solid var(--v2-border)",
        borderTop: `3px solid ${accent}`,
        borderRadius: "var(--v2-radius-sm)",
        padding: "20px",
        display: "flex",
        flexDirection: "column" as const,
        gap: 6,
      }}
    >
      <div
        style={{
          fontFamily: "var(--v2-mono)",
          fontSize: 11,
          textTransform: "uppercase" as const,
          letterSpacing: "0.08em",
          color: "var(--v2-ink-mute)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--v2-serif)",
          fontSize: 36,
          fontWeight: 700,
          color: "var(--v2-ink)",
          lineHeight: 1,
        }}
      >
        {count.toLocaleString()}
      </div>
      <div
        style={{
          fontFamily: "var(--v2-mono)",
          fontSize: 10,
          color: "var(--v2-ink-mute)",
          textTransform: "uppercase" as const,
          letterSpacing: "0.06em",
        }}
      >
        {descriptor}
      </div>
    </div>
  );
}

// ── Top issues list ───────────────────────────────────────────────────────────
function TopIssuesList({
  title,
  items,
  accent,
}: {
  title: string;
  items: Array<{ label: string; count: number }>;
  accent: string;
}) {
  if (items.length === 0) {
    return (
      <div>
        <div
          style={{
            fontFamily: "var(--v2-sans)",
            fontSize: 14,
            fontWeight: 600,
            color: "var(--v2-ink)",
            marginBottom: 12,
          }}
        >
          {title}
        </div>
        <p
          style={{
            fontFamily: "var(--v2-sans)",
            fontSize: 13,
            color: "var(--v2-ink-mute)",
          }}
        >
          No data available.
        </p>
      </div>
    );
  }

  const max = Math.max(...items.map((i) => i.count), 1);

  return (
    <div>
      <div
        style={{
          fontFamily: "var(--v2-sans)",
          fontSize: 14,
          fontWeight: 600,
          color: "var(--v2-ink)",
          marginBottom: 12,
        }}
      >
        {title}
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column" as const, gap: 8 }}>
        {items.map((item) => (
          <li key={item.label} style={{ display: "flex", flexDirection: "column" as const, gap: 3 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--v2-sans)",
                  fontSize: 13,
                  color: "var(--v2-ink-soft)",
                  textTransform: "capitalize" as const,
                }}
              >
                {item.label.toLowerCase()}
              </span>
              <span
                style={{
                  fontFamily: "var(--v2-mono)",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--v2-ink)",
                }}
              >
                {item.count}
              </span>
            </div>
            <div
              style={{
                height: 3,
                background: "var(--v2-border)",
                borderRadius: 999,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${Math.round((item.count / max) * 100)}%`,
                  background: accent,
                  borderRadius: 999,
                  transition: "width 0.3s",
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── S02: Main export ──────────────────────────────────────────────────────────
export function S02_Issues({ issues, buildingName }: Props) {
  // Sum counts per source from trends
  const hpdTotal = issues.trends.reduce((s, t) => s + t.hpd, 0);
  const dobTotal = issues.trends.reduce((s, t) => s + t.dob, 0);
  const complaintsTotal = issues.trends.reduce((s, t) => s + t.complaints, 0);
  const evictionsTotal = issues.trends.reduce((s, t) => s + t.evictions, 0);

  const sourceCards: SourceCardProps[] = [
    { label: "HPD", count: hpdTotal, descriptor: "Housing violations", accent: "var(--v2-bad)" },
    { label: "DOB", count: dobTotal, descriptor: "Building & construction", accent: "var(--v2-warn)" },
    { label: "311", count: complaintsTotal, descriptor: "Tenant complaints", accent: "var(--v2-brand)" },
    { label: "Evictions", count: evictionsTotal, descriptor: "Filed proceedings", accent: "var(--v2-ink-mute)" },
  ];

  const hpdTopItems = issues.hpdTop.map((i) => ({ label: i.category, count: i.count }));
  const complaintsTopItems = issues.complaintsTop.map((i) => ({ label: i.type, count: i.count }));

  return (
    <section
      id="issues"
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
          02 · Issues &amp; Filings
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
          Violations, 311, &amp; more
        </h2>
      </div>

      {/* 1. 7-year trend chart */}
      {issues.trends.length > 0 ? (
        <div
          style={{
            background: "var(--v2-surface)",
            border: "1px solid var(--v2-border)",
            borderRadius: "var(--v2-radius-sm)",
            padding: "20px",
            marginBottom: 20,
          }}
        >
          <div
            style={{
              fontFamily: "var(--v2-sans)",
              fontSize: 15,
              fontWeight: 600,
              color: "var(--v2-ink)",
              marginBottom: 4,
            }}
          >
            Violation &amp; complaint trends
          </div>
          <div
            style={{
              fontFamily: "var(--v2-mono)",
              fontSize: 11,
              color: "var(--v2-ink-mute)",
              marginBottom: 16,
            }}
          >
            Monthly counts · all sources · last 7 years
          </div>
          <TrendChart data={issues.trends} />
        </div>
      ) : (
        <div
          style={{
            marginBottom: 20,
            background: "var(--v2-paper)",
            border: "1px solid var(--v2-border)",
            borderRadius: "var(--v2-radius-sm)",
            padding: "24px",
            fontFamily: "var(--v2-sans)",
            fontSize: 14,
            color: "var(--v2-ink-mute)",
            textAlign: "center" as const,
          }}
        >
          No trend data available for this building.
        </div>
      )}

      {/* 2. 4 source cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        {sourceCards.map((card) => (
          <SourceCard key={card.label} {...card} />
        ))}
      </div>

      {/* 3. Top issues breakdown */}
      {(hpdTopItems.length > 0 || complaintsTopItems.length > 0) && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 24,
            marginBottom: 28,
            background: "var(--v2-paper)",
            border: "1px solid var(--v2-border)",
            borderRadius: "var(--v2-radius-sm)",
            padding: "20px",
          }}
        >
          <TopIssuesList
            title="Top HPD violations"
            items={hpdTopItems.slice(0, 5)}
            accent="var(--v2-bad)"
          />
          <TopIssuesList
            title="Top 311 complaints"
            items={complaintsTopItems.slice(0, 5)}
            accent="var(--v2-warn)"
          />
        </div>
      )}

      {/* 4. Recent violations — tabbed */}
      <div
        style={{
          background: "var(--v2-surface)",
          border: "1px solid var(--v2-border)",
          borderRadius: "var(--v2-radius-sm)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "16px 16px 0",
          }}
        >
          <div
            style={{
              fontFamily: "var(--v2-sans)",
              fontSize: 15,
              fontWeight: 600,
              color: "var(--v2-ink)",
              marginBottom: 12,
            }}
          >
            Recent records
          </div>
        </div>
        <div style={{ padding: "0 16px 16px" }}>
          <RecentViolationsTabs rows={issues.recentViolations} />
        </div>
      </div>
    </section>
  );
}

// TODO: replace with proper NLP/LLM summarizer

import type { BuildingV2Data } from "@/app/[city]/building/[borough]/[slug]/v2/_data";

// ── sentiment wordlists ───────────────────────────────────────────────────────

const POSITIVE = ["great", "clean", "responsive", "quiet", "nice", "friendly", "maintained", "safe", "helpful", "spacious"];
const NEGATIVE = ["slow", "broken", "roaches", "bedbugs", "dirty", "loud", "noisy", "mold", "leak", "rude", "unsafe"];

type ReviewRow = BuildingV2Data["reviews"]["pullQuotes"][number];

function extractSentiment(reviews: ReviewRow[]): {
  pros: Array<[string, number]>;
  cons: Array<[string, number]>;
} {
  const pros = new Map<string, number>();
  const cons = new Map<string, number>();
  for (const r of reviews) {
    const tokens = (r.body ?? "").toLowerCase().split(/\W+/);
    for (const t of tokens) {
      if (POSITIVE.includes(t)) pros.set(t, (pros.get(t) ?? 0) + 1);
      if (NEGATIVE.includes(t)) cons.set(t, (cons.get(t) ?? 0) + 1);
    }
  }
  const sorted = (m: Map<string, number>) =>
    Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);
  return { pros: sorted(pros), cons: sorted(cons) };
}

function stars(rating: number): string {
  const full = Math.round(rating);
  return "★".repeat(full) + "☆".repeat(Math.max(0, 5 - full));
}

// ── component ─────────────────────────────────────────────────────────────────

interface Props {
  reviews: BuildingV2Data["reviews"];
}

export function R02_ReviewSummary({ reviews }: Props) {
  if (reviews.total === 0 || reviews.pullQuotes.length === 0) {
    return (
      <section style={cardStyle}>
        <header style={headStyle}>
          <span style={iconStyle}>
            <ThumbUpIcon />
          </span>
          <h4 style={headingStyle}>What tenants say</h4>
        </header>
        <p style={muteStyle}>No reviews yet.</p>
      </section>
    );
  }

  const { pros, cons } = extractSentiment(reviews.pullQuotes);
  const avg = reviews.avgRating;

  return (
    <section style={cardStyle}>
      <header style={headStyle}>
        <span style={iconStyle}>
          <ThumbUpIcon />
        </span>
        <h4 style={headingStyle}>What tenants say</h4>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--v2-ink-mute)", whiteSpace: "nowrap" }}>
          {reviews.total} reviews
        </span>
      </header>

      {/* Aggregate rating */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, padding: "10px 12px", background: "rgba(219,234,254,0.5)", borderRadius: "var(--v2-radius-sm)" }}>
        <span style={{ fontSize: 24, fontWeight: 700, color: "var(--v2-brand-hi)", fontFamily: "var(--v2-sans)" }}>
          {avg.toFixed(1)}
        </span>
        <div>
          <div style={{ color: "#f59e0b", fontSize: 14, letterSpacing: "0.05em" }}>{stars(avg)}</div>
          <div style={{ fontSize: 11, color: "var(--v2-ink-mute)" }}>out of 5 · {reviews.total} tenants</div>
        </div>
      </div>

      {/* Pros + Cons columns */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {/* Pros */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 8, fontSize: 10, fontFamily: "var(--v2-mono)", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--v2-good)", fontWeight: 600 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: 12, height: 12 }}>
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
            </svg>
            Pros
          </div>
          {pros.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--v2-ink-faint)", margin: 0 }}>—</p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 5 }}>
              {pros.map(([word, count]) => (
                <li key={word} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "var(--v2-ink-soft)", textTransform: "capitalize" }}>{word}</span>
                  <span style={{ fontSize: 10, background: "#d1fae5", color: "#065f46", borderRadius: "var(--v2-radius-chip)", padding: "1px 6px", fontWeight: 600, fontFamily: "var(--v2-mono)" }}>
                    {count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Cons */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 8, fontSize: 10, fontFamily: "var(--v2-mono)", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--v2-bad)", fontWeight: 600 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: 12, height: 12 }}>
              <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
            </svg>
            Cons
          </div>
          {cons.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--v2-ink-faint)", margin: 0 }}>—</p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 5 }}>
              {cons.map(([word, count]) => (
                <li key={word} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "var(--v2-ink-soft)", textTransform: "capitalize" }}>{word}</span>
                  <span style={{ fontSize: 10, background: "#fee2e2", color: "#991b1b", borderRadius: "var(--v2-radius-chip)", padding: "1px 6px", fontWeight: 600, fontFamily: "var(--v2-mono)" }}>
                    {count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

// ── icon ──────────────────────────────────────────────────────────────────────

function ThumbUpIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
    </svg>
  );
}

// ── styles ────────────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: "rgba(219, 234, 254, 0.35)",
  border: "1px solid var(--v2-border)",
  borderRadius: "var(--v2-radius)",
  padding: "16px 18px",
};

const headStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginBottom: 14,
};

const iconStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 28,
  height: 28,
  background: "var(--v2-sky)",
  borderRadius: "var(--v2-radius-sm)",
  color: "var(--v2-brand-hi)",
  flexShrink: 0,
};

const headingStyle: React.CSSProperties = {
  fontFamily: "var(--v2-sans)",
  fontSize: 14,
  fontWeight: 600,
  color: "var(--v2-ink)",
  margin: 0,
};

const muteStyle: React.CSSProperties = {
  fontFamily: "var(--v2-sans)",
  fontSize: 13,
  color: "var(--v2-ink-mute)",
  margin: 0,
};

import type { BuildingV2Data } from "@/app/[city]/building/[borough]/[slug]/v2/_data";

// ── helpers ───────────────────────────────────────────────────────────────────

const BED_LABELS: Record<number, string> = {
  0: "Studio",
  1: "1 Bed",
  2: "2 Bed",
  3: "3 Bed",
  4: "4+ Bed",
};

function bedLabel(n: number): string {
  return BED_LABELS[n] ?? `${n} Bed`;
}

function fmt(n: number): string {
  return `$${n.toLocaleString()}`;
}

// ── card ──────────────────────────────────────────────────────────────────────

interface Props {
  rents: BuildingV2Data["rents"];
  buildingName: string;
}

export function R01_RentComparison({ rents }: Props) {
  const { current, neighborhood } = rents;

  // Neighborhood median — use latest month entry
  const latestNeighb = neighborhood.slice().sort((a, b) =>
    b.month.localeCompare(a.month)
  )[0] ?? null;
  const neighMedian = latestNeighb?.median_rent ?? null;
  const neighDate = latestNeighb?.month ?? null;

  if (current.length === 0) {
    return (
      <section style={cardStyle}>
        <header style={headStyle}>
          <span style={iconStyle}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
              <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          </span>
          <h4 style={headingStyle}>Rent comparison</h4>
        </header>
        <p style={muteStyle}>No rent data available.</p>
      </section>
    );
  }

  return (
    <section style={cardStyle}>
      <header style={headStyle}>
        <span style={iconStyle}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
            <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
          </svg>
        </span>
        <h4 style={headingStyle}>Rent comparison</h4>
      </header>

      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
        {current.map((row) => {
          const med = row.median_rent;
          const min = row.min_rent;
          const max = row.max_rent;

          let deltaEl: React.ReactNode = null;
          if (med != null && neighMedian != null && neighMedian > 0) {
            const pct = ((med - neighMedian) / neighMedian) * 100;
            const sign = pct >= 0 ? "+" : "";
            const color = pct <= 0 ? "var(--v2-good)" : "var(--v2-bad)";
            deltaEl = (
              <span style={{ fontSize: 11, fontFamily: "var(--v2-mono)", color, fontWeight: 600 }}>
                {sign}{pct.toFixed(0)}% area avg
              </span>
            );
          }

          // Bar comparison
          const barBuilding = med ?? ((min != null && max != null) ? (min + max) / 2 : null);
          const maxVal = Math.max(barBuilding ?? 0, neighMedian ?? 0, 1);

          return (
            <li key={row.bedrooms} style={{ fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                <span style={{ fontFamily: "var(--v2-mono)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--v2-ink-mute)" }}>
                  {bedLabel(row.bedrooms)}
                </span>
                <span style={{ fontWeight: 600, color: "var(--v2-ink)", fontSize: 13 }}>
                  {min != null && max != null ? `${fmt(min)} – ${fmt(max)}` : med != null ? fmt(med) : "—"}
                </span>
              </div>
              {/* Mini dual bar */}
              {barBuilding != null && (
                <div style={{ display: "grid", gap: 3, marginBottom: 3 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 48, fontSize: 10, color: "var(--v2-ink-mute)", flexShrink: 0 }}>This bldg</div>
                    <div style={{ flex: 1, height: 6, background: "var(--v2-paper-2)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(barBuilding / maxVal) * 100}%`, background: "var(--v2-brand)", borderRadius: 3 }} />
                    </div>
                  </div>
                  {neighMedian != null && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 48, fontSize: 10, color: "var(--v2-ink-mute)", flexShrink: 0 }}>Neighborhood</div>
                      <div style={{ flex: 1, height: 6, background: "var(--v2-paper-2)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${(neighMedian / maxVal) * 100}%`, background: "var(--v2-sky-deep)", borderRadius: 3 }} />
                      </div>
                      <div style={{ fontSize: 11, color: "var(--v2-ink-soft)", flexShrink: 0 }}>{fmt(neighMedian)}</div>
                    </div>
                  )}
                </div>
              )}
              {deltaEl}
            </li>
          );
        })}
      </ul>

      <footer style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--v2-border)", fontSize: 11, color: "var(--v2-ink-faint)" }}>
        Compared to neighborhood median
        {neighDate ? ` · ${neighDate.slice(0, 7)}` : ""}
      </footer>
    </section>
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

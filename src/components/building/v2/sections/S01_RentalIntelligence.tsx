import type { BuildingV2Data } from "@/app/[city]/building/[borough]/[slug]/v2/_data";

interface Props {
  rents: BuildingV2Data["rents"];
  neighborhoodName: string;
  zipCode: string | null;
}

function bedLabel(beds: number): string {
  if (beds === 0) return "Studio";
  if (beds === 1) return "1 BR";
  if (beds === 2) return "2 BR";
  if (beds === 3) return "3 BR";
  if (beds === 4) return "4 BR";
  return `${beds} BR`;
}

function fmt(n: number): string {
  return "$" + n.toLocaleString("en-US");
}

// ── S01-A: Current rent tiles ─────────────────────────────────────────────────
function CurrentRentTiles({ current }: { current: BuildingV2Data["rents"]["current"] }) {
  // Group by bedrooms, keep first entry per bedroom band
  const map = new Map<number, BuildingV2Data["rents"]["current"][number]>();
  for (const row of current) {
    if (!map.has(row.bedrooms)) map.set(row.bedrooms, row);
  }
  const rows = Array.from(map.entries()).sort((a, b) => a[0] - b[0]);

  return (
    <div style={{ marginTop: 20 }}>
      <div
        style={{
          fontFamily: "var(--v2-mono)",
          fontSize: 11,
          textTransform: "uppercase" as const,
          letterSpacing: "0.08em",
          color: "var(--v2-ink-mute)",
          marginBottom: 12,
        }}
      >
        Current rent by bedroom
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          gap: 12,
        }}
      >
        {rows.map(([beds, row]) => {
          const median = row.median_rent ?? row.min_rent ?? row.max_rent;
          return (
            <div
              key={beds}
              style={{
                background: "var(--v2-paper)",
                border: "1px solid var(--v2-border)",
                borderRadius: "var(--v2-radius-sm)",
                padding: "16px",
                display: "flex",
                flexDirection: "column" as const,
                gap: 4,
              }}
            >
              <div
                style={{
                  fontFamily: "var(--v2-mono)",
                  fontSize: 11,
                  textTransform: "uppercase" as const,
                  letterSpacing: "0.07em",
                  color: "var(--v2-ink-mute)",
                }}
              >
                {bedLabel(beds)}
              </div>
              <div
                style={{
                  fontFamily: "var(--v2-serif)",
                  fontSize: 26,
                  fontWeight: 700,
                  color: "var(--v2-ink)",
                  lineHeight: 1.1,
                }}
              >
                {median ? fmt(median) : "—"}
                {median && (
                  <small
                    style={{
                      fontFamily: "var(--v2-sans)",
                      fontSize: 13,
                      fontWeight: 400,
                      color: "var(--v2-ink-mute)",
                      marginLeft: 2,
                    }}
                  >
                    /mo
                  </small>
                )}
              </div>
              {(row.min_rent || row.max_rent) && row.min_rent !== row.max_rent && (
                <div
                  style={{
                    fontFamily: "var(--v2-mono)",
                    fontSize: 11,
                    color: "var(--v2-ink-mute)",
                  }}
                >
                  {row.min_rent && fmt(row.min_rent)}
                  {row.min_rent && row.max_rent && " – "}
                  {row.max_rent && fmt(row.max_rent)}
                </div>
              )}
              {row.listing_count > 0 && (
                <div
                  style={{
                    fontFamily: "var(--v2-mono)",
                    fontSize: 10,
                    color: "var(--v2-ink-faint)",
                    marginTop: 2,
                  }}
                >
                  {row.listing_count} listing{row.listing_count !== 1 ? "s" : ""}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── S01-B: Historic rent tiles ────────────────────────────────────────────────
function HistoricRentTiles({ historic }: { historic: BuildingV2Data["rents"]["historic"] }) {
  // Take up to 10 most recent months (already sorted desc from query)
  const rows = historic.slice(0, 10);
  if (rows.length === 0) return null;

  return (
    <div
      style={{
        marginTop: 24,
        paddingTop: 24,
        borderTop: "1px dashed var(--v2-border)",
      }}
    >
      <div
        style={{
          fontFamily: "var(--v2-mono)",
          fontSize: 11,
          textTransform: "uppercase" as const,
          letterSpacing: "0.08em",
          color: "var(--v2-ink-mute)",
          marginBottom: 12,
        }}
      >
        Historic rent · this building
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
          gap: 8,
        }}
      >
        {rows.map((row, i) => {
          const prev = rows[i + 1];
          const trend =
            prev && row.median_rent && prev.median_rent
              ? row.median_rent > prev.median_rent
                ? "up"
                : row.median_rent < prev.median_rent
                ? "down"
                : "flat"
              : null;

          const [year, month] = row.month.split("-");
          const label = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("en-US", {
            month: "short",
            year: "2-digit",
          });

          return (
            <div
              key={`${row.month}-${row.beds}`}
              style={{
                background: "var(--v2-paper)",
                border: "1px solid var(--v2-border)",
                borderRadius: "var(--v2-radius-sm)",
                padding: "12px",
                display: "flex",
                flexDirection: "column" as const,
                gap: 3,
              }}
            >
              <div
                style={{
                  fontFamily: "var(--v2-mono)",
                  fontSize: 10,
                  color: "var(--v2-ink-mute)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>{label}</span>
                {trend === "up" && <span style={{ color: "var(--v2-good)" }}>▲</span>}
                {trend === "down" && <span style={{ color: "var(--v2-bad)" }}>▼</span>}
              </div>
              <div
                style={{
                  fontFamily: "var(--v2-serif)",
                  fontSize: 18,
                  fontWeight: 700,
                  color: "var(--v2-ink)",
                  lineHeight: 1,
                }}
              >
                {row.median_rent ? fmt(row.median_rent) : "—"}
              </div>
              <div
                style={{
                  fontFamily: "var(--v2-mono)",
                  fontSize: 10,
                  color: "var(--v2-ink-faint)",
                }}
              >
                {bedLabel(row.beds)} · {row.listing_count} listing{row.listing_count !== 1 ? "s" : ""}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── S01-C: Neighborhood median rent card ──────────────────────────────────────
function NeighborhoodRentCard({
  neighborhood,
  neighborhoodName,
}: {
  neighborhood: BuildingV2Data["rents"]["neighborhood"];
  neighborhoodName: string;
}) {
  if (neighborhood.length === 0) {
    return (
      <div
        style={{
          marginTop: 24,
          paddingTop: 24,
          borderTop: "1px dashed var(--v2-border)",
          fontFamily: "var(--v2-sans)",
          fontSize: 14,
          color: "var(--v2-ink-mute)",
          fontStyle: "italic",
        }}
      >
        No neighborhood rent data available yet.
      </div>
    );
  }

  // Latest month median
  const latest = neighborhood[0];
  // Last 12 months for mini histogram
  const histRows = neighborhood.slice(0, 12).reverse();
  const maxRent = Math.max(...histRows.map((r) => r.median_rent ?? 0), 1);

  const [year, month] = latest.month.split("-");
  const latestLabel = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div
      style={{
        marginTop: 24,
        paddingTop: 24,
        borderTop: "1px dashed var(--v2-border)",
      }}
    >
      <div
        style={{
          fontFamily: "var(--v2-mono)",
          fontSize: 11,
          textTransform: "uppercase" as const,
          letterSpacing: "0.08em",
          color: "var(--v2-ink-mute)",
          marginBottom: 12,
        }}
      >
        Neighborhood median · {neighborhoodName}
      </div>

      <div
        style={{
          background: "var(--v2-paper)",
          border: "1px solid var(--v2-border)",
          borderRadius: "var(--v2-radius-sm)",
          padding: "20px",
          display: "flex",
          flexDirection: "column" as const,
          gap: 16,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div
              style={{
                fontFamily: "var(--v2-serif)",
                fontSize: 32,
                fontWeight: 700,
                color: "var(--v2-ink)",
                lineHeight: 1,
              }}
            >
              {latest.median_rent ? fmt(latest.median_rent) : "—"}
              {latest.median_rent && (
                <small
                  style={{
                    fontFamily: "var(--v2-sans)",
                    fontSize: 14,
                    fontWeight: 400,
                    color: "var(--v2-ink-mute)",
                    marginLeft: 4,
                  }}
                >
                  /mo
                </small>
              )}
            </div>
            <div
              style={{
                fontFamily: "var(--v2-mono)",
                fontSize: 11,
                color: "var(--v2-ink-mute)",
                marginTop: 4,
              }}
            >
              {latestLabel}
            </div>
          </div>
        </div>

        {/* Mini histogram */}
        {histRows.length > 1 && (
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: 3,
                height: 56,
              }}
            >
              {histRows.map((row, i) => {
                const pct = row.median_rent ? Math.max(4, Math.round((row.median_rent / maxRent) * 100)) : 4;
                return (
                  <div
                    key={i}
                    title={`${row.month}: ${row.median_rent ? fmt(row.median_rent) : "—"}`}
                    style={{
                      flex: 1,
                      background: "var(--v2-brand)",
                      opacity: i === histRows.length - 1 ? 1 : 0.4,
                      height: `${pct}%`,
                      borderRadius: "2px 2px 0 0",
                      minWidth: 6,
                    }}
                  />
                );
              })}
            </div>
            <div
              style={{
                fontFamily: "var(--v2-mono)",
                fontSize: 9,
                color: "var(--v2-ink-faint)",
                textAlign: "right",
              }}
            >
              Last {histRows.length} months
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── S01: Main export ──────────────────────────────────────────────────────────
export function S01_RentalIntelligence({ rents, neighborhoodName, zipCode }: Props) {
  const isEmpty = rents.current.length === 0 && rents.historic.length === 0;

  return (
    <section
      id="rent"
      style={{
        paddingTop: 80,
        borderTop: "1px dashed var(--v2-border)",
        marginTop: 40,
      }}
    >
      {/* Section header */}
      <div style={{ marginBottom: 8 }}>
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
          01 · Rent &amp; Value
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
          Rental intelligence
        </h2>
      </div>

      {isEmpty ? (
        <div
          style={{
            marginTop: 24,
            background: "var(--v2-paper)",
            border: "1px solid var(--v2-border)",
            borderRadius: "var(--v2-radius-sm)",
            padding: "32px 24px",
            fontFamily: "var(--v2-sans)",
            fontSize: 14,
            color: "var(--v2-ink-mute)",
            textAlign: "center" as const,
          }}
        >
          Not enough market data yet for this building.
        </div>
      ) : (
        <>
          {rents.current.length > 0 && <CurrentRentTiles current={rents.current} />}
          {rents.historic.length > 0 && <HistoricRentTiles historic={rents.historic} />}
          <NeighborhoodRentCard neighborhood={rents.neighborhood} neighborhoodName={neighborhoodName} />
        </>
      )}
    </section>
  );
}

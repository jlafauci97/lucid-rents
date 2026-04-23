import Link from "next/link";
import type { LandlordV2Data } from "@/app/[city]/landlord/[name]/_data";
import type { City } from "@/lib/cities";
import { CITY_META } from "@/lib/cities";
import { buildingUrl, cityPath } from "@/lib/seo";
import { normalizeScore } from "@/lib/constants";

interface Props {
  buildings: LandlordV2Data["buildings"];
  city: City;
  slug: string;
}

function gradeFor(score: number | null): { letter: string; bg: string; fg: string } {
  if (score === null) return { letter: "—", bg: "var(--paper-2)", fg: "var(--ink-mute)" };
  const s = normalizeScore(score);
  if (s >= 3.65) return { letter: "A", bg: "var(--good)", fg: "white" };
  if (s >= 3.0) return { letter: "B", bg: "var(--sky-deep)", fg: "var(--ink)" };
  if (s >= 2.3) return { letter: "C", bg: "var(--warn)", fg: "var(--ink)" };
  if (s >= 1.0) return { letter: "D", bg: "#ea580c", fg: "white" };
  return { letter: "F", bg: "var(--bad)", fg: "white" };
}

function score10(score: number | null): string {
  if (score === null) return "—";
  return (normalizeScore(score) * 2).toFixed(1);
}

export function S04_Buildings({ buildings, city, slug }: Props) {
  const { worstThree, rows, total, filterCounts } = buildings;
  const regionLabel = CITY_META[city].regionLabel.toLowerCase();

  if (total === 0) {
    return (
      <section className="section" id="buildings">
        <div className="section-head">
          <div>
            <div className="num">04 / 09</div>
            <h2>The buildings.</h2>
          </div>
          <div className="meta">—</div>
        </div>
        <p className="prose">No buildings tracked for this portfolio.</p>
      </section>
    );
  }

  return (
    <section className="section" id="buildings">
      <div className="section-head">
        <div>
          <div className="num">04 / 09</div>
          <h2>The buildings.</h2>
        </div>
        <div className="meta">
          {total.toLocaleString()} total
          <br />
          sorted by score
        </div>
      </div>

      {worstThree.length > 0 ? (
        <>
          <h3
            style={{
              fontSize: 14,
              fontFamily: "var(--mono)",
              color: "var(--ink-mute)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              margin: "0 0 12px",
            }}
          >
            Worst {Math.min(3, worstThree.length)} in portfolio
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${Math.min(3, worstThree.length)}, 1fr)`,
              gap: 14,
              marginBottom: 22,
            }}
          >
            {worstThree.map((b, i) => {
              const g = gradeFor(b.overall_score);
              return (
                <Link
                  key={b.id}
                  href={buildingUrl({ borough: b.borough ?? "unknown", slug: b.slug ?? "" }, city)}
                  style={{
                    background: "var(--paper)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    padding: "16px 18px",
                    position: "relative",
                    overflow: "hidden",
                    display: "block",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: 3,
                      background: "linear-gradient(180deg, var(--bad), var(--warn))",
                    }}
                  />
                  <div
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: 11,
                      fontWeight: 800,
                      color: "var(--bad)",
                      letterSpacing: "0.08em",
                    }}
                  >
                    #{i + 1} · {g.letter} · {score10(b.overall_score)} / 10
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--sans)",
                      fontSize: 14,
                      fontWeight: 700,
                      color: "var(--ink)",
                      letterSpacing: "-0.005em",
                      margin: "6px 0 2px",
                    }}
                  >
                    {b.full_address.split(",")[0] ?? b.full_address}
                  </div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-mute)", letterSpacing: "0.02em" }}>
                    {b.borough ?? "—"}
                    {b.year_built ? ` · built ${b.year_built}` : ""}
                    {b.total_units ? ` · ${b.total_units} units` : ""}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 14,
                      marginTop: 10,
                      fontFamily: "var(--sans)",
                      fontSize: 12,
                      color: "var(--ink-mute)",
                    }}
                  >
                    <span>
                      <b style={{ color: "var(--bad)", fontWeight: 700, marginRight: 3 }}>
                        {(b.violation_count ?? 0).toLocaleString()}
                      </b>
                      violations
                    </span>
                    <span>
                      <b style={{ color: "var(--ink)", fontWeight: 700, marginRight: 3 }}>
                        {(b.complaint_count ?? 0).toLocaleString()}
                      </b>
                      complaints
                    </span>
                    {(b.litigation_count ?? 0) > 0 ? (
                      <span>
                        <b style={{ color: "#8B5CF6", fontWeight: 700, marginRight: 3 }}>
                          {(b.litigation_count ?? 0).toLocaleString()}
                        </b>
                        suits
                      </span>
                    ) : null}
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      ) : null}

      {/* Filter chips (static for Phase 1) */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <FilterChip label={`All · ${total.toLocaleString()}`} active />
        {filterCounts.regions.map((r) => (
          <FilterChip key={r.region} label={`${r.region} · ${r.count.toLocaleString()}`} />
        ))}
        {filterCounts.violations100Plus > 0 ? (
          <FilterChip label={`100+ violations · ${filterCounts.violations100Plus.toLocaleString()}`} />
        ) : null}
        {filterCounts.rentStab > 0 ? (
          <FilterChip label={`Rent-stabilized · ${filterCounts.rentStab.toLocaleString()}`} />
        ) : null}
      </div>

      {/* Table */}
      <div
        style={{
          background: "var(--paper)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "auto 2.2fr 1fr 1fr 1fr 1fr 48px",
            gap: 12,
            padding: "10px 18px",
            background: "var(--paper-2)",
            borderBottom: "1px solid var(--border)",
            fontFamily: "var(--mono)",
            fontSize: 10,
            color: "var(--ink-mute)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            fontWeight: 700,
          }}
        >
          <span>Grade</span>
          <span>Building</span>
          <span>Units</span>
          <span>Violations</span>
          <span>Complaints</span>
          <span>Score</span>
          <span></span>
        </div>
        {rows.map((b) => {
          const g = gradeFor(b.overall_score);
          return (
            <Link
              key={b.id}
              href={buildingUrl({ borough: b.borough ?? "unknown", slug: b.slug ?? "" }, city)}
              style={{
                display: "grid",
                gridTemplateColumns: "auto 2.2fr 1fr 1fr 1fr 1fr 48px",
                gap: 12,
                padding: "12px 18px",
                borderBottom: "1px solid var(--border)",
                alignItems: "center",
                color: "inherit",
                textDecoration: "none",
              }}
            >
              <span
                style={{
                  width: 28,
                  height: 32,
                  borderRadius: 6,
                  display: "grid",
                  placeItems: "center",
                  fontFamily: "var(--serif)",
                  fontSize: 15,
                  fontWeight: 500,
                  background: g.bg,
                  color: g.fg,
                }}
              >
                {g.letter}
              </span>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: "var(--sans)",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--ink)",
                    letterSpacing: "-0.005em",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {b.full_address.split(",")[0] ?? b.full_address}
                </div>
                <small style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-mute)", letterSpacing: "0.02em" }}>
                  {b.borough ?? "—"}
                  {b.year_built ? ` · built ${b.year_built}` : ""}
                </small>
              </div>
              <span style={numStyle(false)}>{b.total_units?.toLocaleString() ?? "—"}</span>
              <span style={numStyle((b.violation_count ?? 0) >= 100)}>
                {(b.violation_count ?? 0).toLocaleString()}
              </span>
              <span style={numStyle((b.complaint_count ?? 0) >= 100)}>
                {(b.complaint_count ?? 0).toLocaleString()}
              </span>
              <span style={numStyle(false)}>{score10(b.overall_score)} / 10</span>
              <span style={{ color: "var(--ink-mute)", textAlign: "right" }}>›</span>
            </Link>
          );
        })}
        <Link
          href={cityPath(`/landlord/${slug}/buildings`, city)}
          style={{
            display: "block",
            background: "var(--paper-2)",
            textAlign: "center",
            fontFamily: "var(--mono)",
            fontSize: 12,
            color: "var(--navy-hi)",
            fontWeight: 700,
            padding: "12px 0",
            letterSpacing: "0.04em",
            textDecoration: "none",
          }}
        >
          {total > rows.length
            ? `See all ${total.toLocaleString()} buildings →`
            : `Open the full building list →`}
        </Link>
      </div>
    </section>
  );
}

function numStyle(warn: boolean): React.CSSProperties {
  return {
    fontFamily: "var(--mono)",
    fontSize: 13,
    fontWeight: 600,
    color: warn ? "var(--bad)" : "var(--ink-soft)",
  };
}

function FilterChip({ label, active }: { label: string; active?: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 12px",
        borderRadius: 999,
        background: active ? "var(--ink)" : "var(--paper)",
        border: `1px solid ${active ? "var(--ink)" : "var(--border)"}`,
        fontFamily: "var(--sans)",
        fontSize: 12,
        fontWeight: 600,
        color: active ? "white" : "var(--ink-soft)",
      }}
    >
      {label}
    </span>
  );
}

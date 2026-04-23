import type { LandlordV2Data } from "@/app/[city]/landlord/[name]/_data";
import type { City } from "@/lib/cities";
import { CITY_META } from "@/lib/cities";
import { normalizeScore } from "@/lib/constants";

interface Props {
  portfolio: LandlordV2Data["portfolio"];
  avgScore: number | null;
  buildingCount: number;
  unitCount: number;
  city: City;
}

const GRADE_ORDER = ["A", "B", "C", "D", "F"] as const;
const GRADE_COLOR: Record<(typeof GRADE_ORDER)[number], string> = {
  A: "var(--good)",
  B: "var(--sky-deep)",
  C: "var(--warn)",
  D: "#ea580c",
  F: "var(--bad)",
};

export function S01_Glance({ portfolio, avgScore, buildingCount, unitCount, city }: Props) {
  const total = GRADE_ORDER.reduce((acc, k) => acc + portfolio.gradeDist[k], 0);
  const score05 = avgScore !== null ? normalizeScore(avgScore) : null;
  const cityAvg05 = portfolio.cityAvgScore > 0 ? normalizeScore(portfolio.cityAvgScore) : null;
  const diff = score05 !== null && cityAvg05 !== null ? score05 - cityAvg05 : null;
  const regionLabel = CITY_META[city].regionLabel.toLowerCase();

  return (
    <section className="section" id="glance">
      <div className="section-head">
        <div>
          <div className="num">01 / 09</div>
          <h2>Portfolio at a glance.</h2>
        </div>
        <div className="meta">
          {buildingCount.toLocaleString()} buildings · {unitCount.toLocaleString()} units
          <br />
          scored by LucidIQ
        </div>
      </div>

      <p className="prose">
        This landlord owns or manages <b>{buildingCount.toLocaleString()} building{buildingCount === 1 ? "" : "s"}</b> across {CITY_META[city].fullName}
        {unitCount > 0 ? <>, housing roughly <b>{unitCount.toLocaleString()} tenant{unitCount === 1 ? "" : "s"}</b></> : null}.
        {" "}
        {diff === null ? (
          <>Scoring will firm up as more LucidIQ signals load for this portfolio.</>
        ) : diff > 0.3 ? (
          <>The portfolio sits <b>above average</b> on compliance for the city.</>
        ) : diff < -0.3 ? (
          <>The portfolio sits <b>below average</b> on compliance for the city.</>
        ) : (
          <>The portfolio sits <b>around the city average</b> on compliance.</>
        )}
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.3fr 1fr",
          gap: "var(--s-5)",
          marginTop: "var(--s-5)",
        }}
      >
        {/* Grade distribution bar */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: "22px 24px",
          }}
        >
          <h3
            style={{
              fontSize: 15,
              fontWeight: 700,
              margin: "0 0 16px",
              letterSpacing: "-0.01em",
              color: "var(--ink)",
            }}
          >
            Grade distribution
          </h3>
          {total === 0 ? (
            <p style={{ fontSize: 13, color: "var(--ink-mute)", margin: 0 }}>
              Scoring not yet available for this portfolio.
            </p>
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  height: 44,
                  borderRadius: 10,
                  overflow: "hidden",
                  marginBottom: 12,
                  border: "1px solid var(--border)",
                }}
              >
                {GRADE_ORDER.map((g) => {
                  const n = portfolio.gradeDist[g];
                  if (n === 0) return null;
                  return (
                    <div
                      key={g}
                      style={{
                        flex: n,
                        background: GRADE_COLOR[g],
                        display: "grid",
                        placeItems: "center",
                        color: g === "C" ? "var(--ink)" : "white",
                        fontFamily: "var(--mono)",
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        minWidth: 0,
                      }}
                      aria-label={`${n} building${n === 1 ? "" : "s"} graded ${g}`}
                    >
                      {n.toLocaleString()}
                    </div>
                  );
                })}
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                  color: "var(--ink-mute)",
                  letterSpacing: "0.04em",
                }}
              >
                {GRADE_ORDER.map((g) => (
                  <span key={g} style={{ color: GRADE_COLOR[g] }}>
                    {g} · {portfolio.gradeDist[g]}
                  </span>
                ))}
              </div>
            </>
          )}

          {diff !== null ? (
            <div
              style={{
                marginTop: 18,
                display: "flex",
                alignItems: "center",
                gap: 18,
                padding: "14px 18px",
                background: "color-mix(in oklch, var(--sky) 22%, var(--paper))",
                borderLeft: "3px solid var(--sky-deep)",
                borderRadius: 10,
              }}
            >
              <div
                style={{
                  fontFamily: "var(--serif)",
                  fontSize: 32,
                  letterSpacing: "-0.02em",
                  color: diff < 0 ? "var(--bad)" : diff > 0 ? "var(--good)" : "var(--ink)",
                }}
              >
                {diff > 0 ? "+" : ""}{diff.toFixed(1)}
              </div>
              <div style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.4 }}>
                <b style={{ color: "var(--ink)" }}>Portfolio score vs {CITY_META[city].name} average.</b>{" "}
                {score05?.toFixed(1)} / 5 vs the city mean of {cityAvg05?.toFixed(1)}.
              </div>
            </div>
          ) : null}
        </div>

        {/* Region preview */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: "22px 24px",
          }}
        >
          <h3
            style={{
              fontSize: 15,
              fontWeight: 700,
              margin: "0 0 16px",
              letterSpacing: "-0.01em",
              color: "var(--ink)",
            }}
          >
            Where they operate
          </h3>
          {portfolio.regionPreview.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--ink-mute)", margin: 0 }}>
              No {regionLabel} data available.
            </p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              {portfolio.regionPreview.map((r) => (
                <li
                  key={r.name}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 12,
                    padding: "10px 0",
                    borderBottom: "1px dashed var(--border)",
                    fontSize: 13,
                  }}
                >
                  <b style={{ color: "var(--ink)", fontWeight: 600 }}>{r.name}</b>
                  <span style={{ fontFamily: "var(--mono)", fontWeight: 700, color: "var(--ink-soft)" }}>
                    {r.count.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {portfolio.worstCount100 > 0 ? (
            <div
              style={{
                marginTop: 14,
                padding: "12px 14px",
                background: "color-mix(in oklch, var(--bad) 7%, var(--paper))",
                border: "1px solid color-mix(in oklch, var(--bad) 30%, var(--border))",
                borderRadius: 10,
                fontSize: 13,
                color: "var(--ink-soft)",
              }}
            >
              <b style={{ color: "var(--bad)", fontFamily: "var(--serif)", fontSize: 18 }}>{portfolio.worstCount100.toLocaleString()}</b>{" "}
              building{portfolio.worstCount100 === 1 ? "" : "s"} carry 100+ violations — see the buildings section below.
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

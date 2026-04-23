import type { LandlordV2Data } from "@/app/[city]/landlord/[name]/_data";
import type { City } from "@/lib/cities";

interface Props {
  caseFile: NonNullable<LandlordV2Data["caseFile"]>;
  city: City;
}

const SECTION_TITLE: Record<NonNullable<LandlordV2Data["caseFile"]>["source"], string> = {
  oath: "OATH case file",
  ladbs: "LADBS enforcement",
  "chi-admin": "Administrative hearings",
  "miami-ceb": "Code Enforcement Board",
  "houston-deo": "DEO orders",
};

const SECTION_SUB: Record<NonNullable<LandlordV2Data["caseFile"]>["source"], string> = {
  oath: "Adjudicated DOB / ECB cases across this portfolio",
  ladbs: "LA Dept. of Building & Safety enforcement record",
  "chi-admin": "City of Chicago Administrative Hearings record",
  "miami-ceb": "Miami-Dade Code Enforcement Board record",
  "houston-deo": "Director's Enforcement Order record",
};

function formatMoney(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function resultBadge(result: string | null): { label: string; bg: string; fg: string } {
  if (!result) return { label: "—", bg: "var(--paper-2)", fg: "var(--ink-soft)" };
  const upper = result.toUpperCase();
  if (upper.includes("DEFAULT")) return { label: "Defaulted", bg: "color-mix(in oklch, var(--bad) 12%, var(--paper))", fg: "var(--bad)" };
  if (upper.includes("VIOLATION") || upper.includes("GUILTY")) return { label: "In violation", bg: "color-mix(in oklch, var(--warn) 14%, var(--paper))", fg: "#a16207" };
  if (upper.includes("DISMIS")) return { label: "Dismissed", bg: "color-mix(in oklch, var(--good) 14%, var(--paper))", fg: "oklch(0.42 0.13 155)" };
  if (upper.includes("PAID")) return { label: "Paid", bg: "color-mix(in oklch, var(--good) 14%, var(--paper))", fg: "oklch(0.42 0.13 155)" };
  return { label: result, bg: "var(--paper-2)", fg: "var(--ink-soft)" };
}

export function S03_CaseFile({ caseFile }: Props) {
  const { summary, recent, source } = caseFile;
  const title = SECTION_TITLE[source];
  const sub = SECTION_SUB[source];

  return (
    <section className="section" id="casefile">
      <div className="section-head">
        <div>
          <div className="num">03 / 09</div>
          <h2>{title}.</h2>
        </div>
        <div className="meta">
          last update {formatDate(summary.latestDate)}
          <br />
          {summary.buildingCount.toLocaleString()} building{summary.buildingCount === 1 ? "" : "s"}
        </div>
      </div>

      <p className="prose">{sub}. Every ticket that went to adjudication — paid, dismissed, or defaulted.</p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
          margin: "var(--s-5) 0",
        }}
      >
        <BigStat k="Total cases" v={summary.totalCases.toLocaleString()} tone="neutral" />
        <BigStat
          k="Open / unpaid"
          v={summary.unpaidCases.toLocaleString()}
          tone={summary.unpaidCases > 0 ? "warn" : "neutral"}
        />
        <BigStat
          k="Balance due"
          v={formatMoney(summary.unpaidBalance)}
          tone={summary.unpaidBalance > 0 ? "warn" : "neutral"}
        />
        <BigStat
          k="Default-judgment rate"
          v={`${summary.defaultRate}%`}
          tone={summary.defaultRate >= 30 ? "warn" : "neutral"}
        />
      </div>

      {recent.length > 0 ? (
        <div
          style={{
            background: "var(--paper)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <h3
            style={{
              margin: 0,
              padding: "14px 18px",
              fontSize: 13,
              fontWeight: 700,
              borderBottom: "1px solid var(--border)",
              background: "var(--paper-2)",
              letterSpacing: "-0.005em",
              color: "var(--ink)",
            }}
          >
            Recent cases ({Math.min(recent.length, 8)} of {summary.totalCases.toLocaleString()})
          </h3>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {recent.slice(0, 8).map((c) => {
              const badge = resultBadge(c.result);
              return (
                <li
                  key={c.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto 1fr auto",
                    gap: 14,
                    padding: "12px 18px",
                    borderBottom: "1px solid var(--border)",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "3px 8px",
                      borderRadius: 4,
                      letterSpacing: "0.04em",
                      background: badge.bg,
                      color: badge.fg,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {badge.label}
                  </span>
                  <div style={{ fontSize: 13, color: "var(--ink)", fontWeight: 500, letterSpacing: "-0.005em", minWidth: 0 }}>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.description || c.agency || "Case"}
                    </div>
                    {c.addressLine ? (
                      <small
                        style={{
                          display: "block",
                          fontSize: 11,
                          color: "var(--ink-mute)",
                          fontFamily: "var(--mono)",
                          marginTop: 2,
                          letterSpacing: "0.02em",
                        }}
                      >
                        {c.addressLine}
                      </small>
                    ) : null}
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    {c.balanceDue != null && c.balanceDue > 0 ? (
                      <span style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, color: "var(--bad)" }}>
                        {formatMoney(c.balanceDue)} due
                      </span>
                    ) : c.penaltyImposed != null && c.penaltyImposed > 0 ? (
                      <span style={{ fontSize: 11, color: "var(--ink-mute)", fontFamily: "var(--mono)" }}>
                        {formatMoney(c.penaltyImposed)} paid
                      </span>
                    ) : null}
                    <div
                      style={{
                        fontSize: 10,
                        color: "var(--ink-mute)",
                        fontFamily: "var(--mono)",
                        fontWeight: 500,
                        marginTop: 2,
                      }}
                    >
                      {formatDate(c.date)}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function BigStat({ k, v, tone }: { k: string; v: string; tone: "warn" | "neutral" }) {
  return (
    <div
      style={{
        padding: "16px 18px",
        background: tone === "warn" ? "color-mix(in oklch, var(--bad) 8%, var(--paper))" : "var(--surface)",
        border: `1px solid ${tone === "warn" ? "color-mix(in oklch, var(--bad) 30%, var(--border))" : "var(--border)"}`,
        borderRadius: 12,
      }}
    >
      <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {k}
      </div>
      <div
        style={{
          fontFamily: "var(--serif)",
          fontSize: 28,
          letterSpacing: "-0.01em",
          marginTop: 6,
          color: tone === "warn" ? "var(--bad)" : "var(--ink)",
        }}
      >
        {v}
      </div>
    </div>
  );
}

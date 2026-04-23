import Link from "next/link";
import type { LandlordV2Data } from "@/app/[city]/landlord/[name]/_data";
import { tenantResourcesForCity, type TenantResource } from "@/lib/landlord-city-adapters";
import type { City } from "@/lib/cities";
import { landlordUrl } from "@/lib/seo";
import { normalizeScore } from "@/lib/constants";

interface Props {
  peers: LandlordV2Data["peers"];
  city: City;
  currentAvgScore: number | null;
}

function gradeChip(score: number | null): { letter: string; bg: string; fg: string } {
  if (score === null) return { letter: "—", bg: "var(--paper-2)", fg: "var(--ink-mute)" };
  const s = normalizeScore(score);
  if (s >= 3.65) return { letter: "A", bg: "var(--good)", fg: "white" };
  if (s >= 3.0) return { letter: "B", bg: "var(--sky-deep)", fg: "var(--ink)" };
  if (s >= 2.3) return { letter: "C", bg: "var(--warn)", fg: "var(--ink)" };
  if (s >= 1.0) return { letter: "D", bg: "#ea580c", fg: "white" };
  return { letter: "F", bg: "var(--bad)", fg: "white" };
}

function ResourceIcon({ icon }: { icon: TenantResource["icon"] }) {
  const common = { viewBox: "0 0 24 24", fill: "none" as const, stroke: "currentColor" as const, strokeWidth: 2, width: 16, height: 16 };
  if (icon === "phone")
    return (
      <svg {...common}>
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72" />
      </svg>
    );
  if (icon === "shield")
    return (
      <svg {...common}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    );
  if (icon === "file-warning")
    return (
      <svg {...common}>
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M8 3h13M3 12h18M3 21h13" />
    </svg>
  );
}

export function S08_Compare({ peers, city, currentAvgScore }: Props) {
  const resources = tenantResourcesForCity(city);

  return (
    <section className="section" id="compare">
      <div className="section-head">
        <div>
          <div className="num">08 / 09</div>
          <h2>Compare &amp; act.</h2>
        </div>
        <div className="meta">peer landlords · tenant<br />resources</div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.1fr 1fr",
          gap: 18,
          marginTop: "var(--s-5)",
        }}
      >
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: "22px 24px",
          }}
        >
          <h3 style={cardHeaderStyle}>Similar-size landlords in this city</h3>
          {peers.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--ink-mute)", margin: 0 }}>
              No peer landlords found in the ±40% building-count band.
            </p>
          ) : (
            peers.map((p) => {
              const g = gradeChip(p.avgScore);
              const currentNormalized = currentAvgScore !== null ? normalizeScore(currentAvgScore) : null;
              const peerNormalized = p.avgScore !== null ? normalizeScore(p.avgScore) : null;
              const delta =
                currentNormalized !== null && peerNormalized !== null
                  ? peerNormalized - currentNormalized
                  : null;
              return (
                <Link
                  key={p.slug}
                  href={landlordUrl(p.name, city)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto 1fr auto",
                    gap: 12,
                    padding: "10px 0",
                    alignItems: "center",
                    borderBottom: "1px dashed var(--border)",
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
                      background: g.bg,
                      color: g.fg,
                      fontFamily: "var(--serif)",
                      fontSize: 14,
                    }}
                  >
                    {g.letter}
                  </span>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.005em" }}>
                    {p.name}
                    <small
                      style={{
                        display: "block",
                        fontFamily: "var(--mono)",
                        fontSize: 10,
                        color: "var(--ink-mute)",
                        marginTop: 2,
                        letterSpacing: "0.02em",
                      }}
                    >
                      {p.buildingCount.toLocaleString()} building{p.buildingCount === 1 ? "" : "s"}
                    </small>
                  </div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", textAlign: "right" }}>
                    {peerNormalized !== null ? `${peerNormalized.toFixed(1)} / 5` : "—"}
                    {delta !== null ? (
                      <small
                        style={{
                          display: "block",
                          color: delta > 0 ? "var(--good)" : delta < 0 ? "var(--bad)" : "var(--ink-mute)",
                          fontWeight: 500,
                          fontSize: 10,
                          marginTop: 2,
                        }}
                      >
                        {delta > 0 ? "+" : ""}
                        {delta.toFixed(1)} vs this landlord
                      </small>
                    ) : null}
                  </div>
                </Link>
              );
            })
          )}
        </div>

        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: "22px 24px",
          }}
        >
          <h3 style={cardHeaderStyle}>Tenant resources</h3>
          {resources.map((r) => {
            const inner = (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 14px",
                  borderRadius: 10,
                  background: "var(--paper)",
                  border: "1px solid var(--border)",
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    background: "color-mix(in oklch, var(--sky) 35%, var(--paper))",
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                    color: "var(--navy-hi)",
                  }}
                >
                  <ResourceIcon icon={r.icon} />
                </div>
                <div>
                  <b style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.005em" }}>
                    {r.label}
                  </b>
                  <small
                    style={{
                      display: "block",
                      fontSize: 11,
                      color: "var(--ink-mute)",
                      marginTop: 2,
                      fontFamily: "var(--mono)",
                      letterSpacing: "0.02em",
                    }}
                  >
                    {r.description}
                  </small>
                </div>
              </div>
            );
            if (r.external) {
              return (
                <a key={r.label} href={r.href} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none" }}>
                  {inner}
                </a>
              );
            }
            return (
              <Link key={r.label} href={r.href} style={{ color: "inherit", textDecoration: "none" }}>
                {inner}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

const cardHeaderStyle: React.CSSProperties = {
  margin: "0 0 14px",
  fontSize: 15,
  fontWeight: 700,
  letterSpacing: "-0.01em",
  color: "var(--ink)",
};

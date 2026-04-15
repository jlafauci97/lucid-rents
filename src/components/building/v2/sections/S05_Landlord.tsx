import Link from "next/link";
import { LucidIQBadge } from "@/components/building/v2/LucidIQBadge";
import {
  buildingUrl,
  landlordUrl,
} from "@/lib/seo";
import {
  scoreToGrade,
  type BuildingV2Data,
} from "@/app/[city]/building/[borough]/[slug]/v2/_data";
import type { City } from "@/lib/cities";

interface Props {
  landlord: BuildingV2Data["landlord"];
  city: City;
  currentBuildingSlug: string;
  currentBuildingBorough: string;
}

// ── Grade badge for individual buildings ─────────────────────────────────────

const GRADE_COLORS: Record<string, { bg: string; color: string }> = {
  "A+": { bg: "#dbeafe", color: "#1d4ed8" },
  A: { bg: "#dbeafe", color: "#1d4ed8" },
  "A-": { bg: "#dbeafe", color: "#1d4ed8" },
  "B+": { bg: "#e0f2fe", color: "#0369a1" },
  B: { bg: "#e0f2fe", color: "#0369a1" },
  "B-": { bg: "#e0f2fe", color: "#0284c7" },
  "C+": { bg: "#fef3c7", color: "#d97706" },
  C: { bg: "#fef3c7", color: "#f59e0b" },
  "C-": { bg: "#fef3c7", color: "#fbbf24" },
  D: { bg: "#fee2e2", color: "#dc2626" },
  F: { bg: "#fee2e2", color: "#7f1d1d" },
  "—": { bg: "#f1f5f9", color: "#94a3b8" },
};

function GradeChip({ grade }: { grade: string }) {
  const colors = GRADE_COLORS[grade] ?? { bg: "#f1f5f9", color: "#94a3b8" };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 36,
        height: 36,
        borderRadius: 6,
        background: colors.bg,
        color: colors.color,
        fontFamily: "var(--v2-serif)",
        fontSize: 14,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {grade}
    </span>
  );
}

// ── Other buildings list ──────────────────────────────────────────────────────

function OtherBuildingsList({
  buildings,
  city,
  currentBuildingSlug,
  currentBuildingBorough,
  landlordName,
  portfolioSize,
}: {
  buildings: BuildingV2Data["landlord"]["otherBuildings"];
  city: City;
  currentBuildingSlug: string;
  currentBuildingBorough: string;
  landlordName: string;
  portfolioSize: number;
}) {
  const profileUrl = landlordUrl(landlordName, city);

  return (
    <div
      style={{
        background: "var(--v2-paper)",
        border: "1px solid var(--v2-border)",
        borderRadius: "var(--v2-radius-sm)",
        overflow: "hidden",
      }}
    >
      {/* Sub-header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px",
          borderBottom: "1px solid var(--v2-border)",
          flexWrap: "wrap" as const,
          gap: 8,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "var(--v2-serif)",
              fontSize: 17,
              fontWeight: 700,
              color: "var(--v2-ink)",
            }}
          >
            Other buildings owned
          </div>
          <div
            style={{
              fontFamily: "var(--v2-mono)",
              fontSize: 11,
              color: "var(--v2-ink-mute)",
              marginTop: 2,
            }}
          >
            Up to 6 shown · sorted by Lucid Score
          </div>
        </div>
        {portfolioSize > 6 && (
          <Link
            href={profileUrl}
            style={{
              fontFamily: "var(--v2-mono)",
              fontSize: 11,
              color: "var(--v2-brand)",
              textDecoration: "none",
              border: "1px solid var(--v2-border)",
              borderRadius: "var(--v2-radius-chip)",
              padding: "4px 10px",
            }}
          >
            See all {portfolioSize} →
          </Link>
        )}
      </div>

      {/* Building rows */}
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {buildings.map((b, idx) => {
          const grade = scoreToGrade(b.overall_score);
          const isCurrent =
            b.slug === currentBuildingSlug && b.borough === currentBuildingBorough;
          const url = buildingUrl({ borough: b.borough, slug: b.slug }, city);

          return (
            <li
              key={b.id}
              style={{
                borderBottom:
                  idx < buildings.length - 1
                    ? "1px solid var(--v2-border)"
                    : "none",
              }}
            >
              <Link
                href={url}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "14px 20px",
                  textDecoration: "none",
                  background: isCurrent ? "rgba(219,234,254,0.3)" : "transparent",
                }}
              >
                <GradeChip grade={grade} />

                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      fontFamily: "var(--v2-sans)",
                      fontSize: 14,
                      fontWeight: 600,
                      color: "var(--v2-ink)",
                      whiteSpace: "nowrap" as const,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {b.full_address}
                    {isCurrent && (
                      <span
                        style={{
                          fontFamily: "var(--v2-mono)",
                          fontSize: 10,
                          color: "var(--v2-brand)",
                          marginLeft: 6,
                          verticalAlign: "middle",
                        }}
                      >
                        · this building
                      </span>
                    )}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--v2-mono)",
                      fontSize: 11,
                      color: "var(--v2-ink-mute)",
                    }}
                  >
                    {b.borough}
                  </span>
                </span>

                {b.overall_score !== null && (
                  <span
                    style={{
                      fontFamily: "var(--v2-mono)",
                      fontSize: 12,
                      color: "var(--v2-ink-soft)",
                      flexShrink: 0,
                    }}
                  >
                    {(b.overall_score / 20).toFixed(1)} / 5
                  </span>
                )}

                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--v2-ink-faint)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  style={{ flexShrink: 0 }}
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── S05: Main export ──────────────────────────────────────────────────────────

export function S05_Landlord({
  landlord,
  city,
  currentBuildingSlug,
  currentBuildingBorough,
}: Props) {
  const profileUrl =
    landlord.name ? landlordUrl(landlord.name, city) : "#";
  const grade = scoreToGrade(landlord.portfolioAvgScore);
  // portfolioAvgScore is 0-100; LucidIQBadge takes rating 0-5
  const rating = landlord.portfolioAvgScore !== null
    ? landlord.portfolioAvgScore / 20
    : 0;

  return (
    <section
      id="landlord"
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
          05 · Landlord
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
          The landlord
        </h2>
      </div>

      {landlord.name === null ? (
        /* Empty state */
        <div
          style={{
            background: "var(--v2-paper)",
            border: "1px solid var(--v2-border)",
            borderRadius: "var(--v2-radius-sm)",
            padding: "40px 24px",
            display: "flex",
            flexDirection: "column" as const,
            alignItems: "center",
            gap: 12,
            textAlign: "center" as const,
          }}
        >
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--v2-ink-faint)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <div>
            <div
              style={{
                fontFamily: "var(--v2-serif)",
                fontSize: 20,
                fontWeight: 700,
                color: "var(--v2-ink)",
                marginBottom: 6,
              }}
            >
              Owner not yet identified
            </div>
            <p
              style={{
                fontFamily: "var(--v2-sans)",
                fontSize: 14,
                color: "var(--v2-ink-mute)",
                margin: 0,
                maxWidth: 380,
              }}
            >
              Owner records for this building have not yet been linked. We
              update ownership data regularly from property and regulatory
              filings.
            </p>
          </div>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column" as const,
            gap: 20,
          }}
        >
          {/* Identity card: 2-col desktop, 1-col mobile */}
          <div
            style={{
              background: "var(--v2-paper)",
              border: "1px solid var(--v2-border)",
              borderRadius: "var(--v2-radius-sm)",
              padding: "28px",
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 28,
              alignItems: "start",
            }}
          >
            {/* Left: name, stats, CTA */}
            <div style={{ minWidth: 0 }}>
              <h3
                style={{
                  fontFamily: "var(--v2-serif)",
                  fontSize: "clamp(20px, 2.5vw, 26px)",
                  fontWeight: 700,
                  color: "var(--v2-ink)",
                  margin: "0 0 16px",
                  lineHeight: 1.25,
                }}
              >
                {landlord.name}
              </h3>

              {/* Portfolio stats row */}
              <div
                style={{
                  display: "flex",
                  gap: 24,
                  flexWrap: "wrap" as const,
                  marginBottom: 20,
                }}
              >
                <div>
                  <div
                    style={{
                      fontFamily: "var(--v2-serif)",
                      fontSize: 24,
                      fontWeight: 700,
                      color: "var(--v2-brand)",
                      lineHeight: 1,
                    }}
                  >
                    {landlord.portfolioSize}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--v2-mono)",
                      fontSize: 11,
                      color: "var(--v2-ink-mute)",
                      marginTop: 2,
                    }}
                  >
                    buildings in portfolio
                  </div>
                </div>
                {landlord.portfolioAvgScore !== null && (
                  <div>
                    <div
                      style={{
                        fontFamily: "var(--v2-serif)",
                        fontSize: 24,
                        fontWeight: 700,
                        color: "var(--v2-ink)",
                        lineHeight: 1,
                      }}
                    >
                      {rating.toFixed(1)}
                      <span
                        style={{
                          fontFamily: "var(--v2-mono)",
                          fontSize: 13,
                          fontWeight: 400,
                          color: "var(--v2-ink-mute)",
                        }}
                      >
                        {" "}
                        / 5
                      </span>
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--v2-mono)",
                        fontSize: 11,
                        color: "var(--v2-ink-mute)",
                        marginTop: 2,
                      }}
                    >
                      portfolio avg score
                    </div>
                  </div>
                )}
              </div>

              <Link
                href={profileUrl}
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
                View full profile
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

            {/* Right: Portfolio grade badge */}
            <div
              style={{
                display: "flex",
                flexDirection: "column" as const,
                alignItems: "center",
                gap: 6,
              }}
            >
              <div
                style={{
                  fontFamily: "var(--v2-mono)",
                  fontSize: 10,
                  textTransform: "uppercase" as const,
                  letterSpacing: "0.1em",
                  color: "var(--v2-ink-mute)",
                }}
              >
                Portfolio Grade
              </div>
              <LucidIQBadge grade={grade} rating={rating} size={96} />
            </div>
          </div>

          {/* Other buildings list */}
          {landlord.otherBuildings.length > 0 && (
            <OtherBuildingsList
              buildings={landlord.otherBuildings}
              city={city}
              currentBuildingSlug={currentBuildingSlug}
              currentBuildingBorough={currentBuildingBorough}
              landlordName={landlord.name}
              portfolioSize={landlord.portfolioSize}
            />
          )}
        </div>
      )}
    </section>
  );
}

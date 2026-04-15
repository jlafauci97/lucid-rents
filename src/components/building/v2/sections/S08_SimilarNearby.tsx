import Link from "next/link";
import { buildingUrl } from "@/lib/seo";
import type { BuildingV2Data } from "@/app/[city]/building/[borough]/[slug]/v2/_data";
import type { City } from "@/lib/cities";

// ── Building illustration SVG ─────────────────────────────────────────────────

function BuildingIllustration() {
  return (
    <svg
      viewBox="0 0 120 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ display: "block", width: "100%", height: "100%" }}
    >
      {/* Building body */}
      <rect x="18" y="22" width="84" height="72" fill="#dbeafe" stroke="#93c5fd" strokeWidth="1.5" />
      {/* Roof */}
      <path d="M18 22 L60 6 L102 22" fill="#bfdbfe" stroke="#93c5fd" strokeWidth="1.5" strokeLinejoin="round" />
      {/* Windows — row 1 */}
      <rect x="30" y="30" width="12" height="11" fill="#3b82f6" rx="1" />
      <rect x="54" y="30" width="12" height="11" fill="#3b82f6" rx="1" />
      <rect x="78" y="30" width="12" height="11" fill="#3b82f6" rx="1" />
      {/* Windows — row 2 */}
      <rect x="30" y="49" width="12" height="11" fill="#3b82f6" rx="1" />
      <rect x="54" y="49" width="12" height="11" fill="#3b82f6" rx="1" />
      <rect x="78" y="49" width="12" height="11" fill="#3b82f6" rx="1" />
      {/* Windows — row 3 */}
      <rect x="30" y="68" width="12" height="11" fill="#60a5fa" rx="1" />
      <rect x="54" y="68" width="12" height="11" fill="#60a5fa" rx="1" />
      <rect x="78" y="68" width="12" height="11" fill="#60a5fa" rx="1" />
      {/* Door */}
      <rect x="52" y="83" width="16" height="11" fill="#1e40af" rx="1" />
    </svg>
  );
}

// ── Single card ───────────────────────────────────────────────────────────────

function SimilarCard({
  building,
  city,
}: {
  building: BuildingV2Data["similar"][number];
  city: City;
}) {
  const url = buildingUrl({ borough: building.borough, slug: building.slug }, city);

  const metaParts: string[] = [];
  if (building.year_built) metaParts.push(`Built ${building.year_built}`);
  if (building.total_units) metaParts.push(`${building.total_units} units`);

  return (
    <article
      style={{
        background: "var(--v2-paper)",
        border: "1px solid var(--v2-border)",
        borderRadius: "var(--v2-radius-sm)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column" as const,
      }}
    >
      {/* Illustration */}
      <div
        style={{
          background: "linear-gradient(180deg, #eff6ff 0%, #dbeafe 100%)",
          padding: "20px 24px 16px",
          height: 110,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
        }}
      >
        <div style={{ width: 90, height: 80 }}>
          <BuildingIllustration />
        </div>
      </div>

      {/* Body */}
      <div
        style={{
          padding: "16px 18px 18px",
          display: "flex",
          flexDirection: "column" as const,
          gap: 6,
          flex: 1,
        }}
      >
        {/* Address */}
        <h3
          style={{
            fontFamily: "var(--v2-serif)",
            fontSize: 17,
            fontWeight: 700,
            color: "var(--v2-ink)",
            margin: 0,
            lineHeight: 1.25,
          }}
        >
          {building.full_address}
        </h3>

        {/* Neighborhood */}
        {building.borough && (
          <div
            style={{
              fontFamily: "var(--v2-mono)",
              fontSize: 11,
              color: "var(--v2-ink-mute)",
              textTransform: "uppercase" as const,
              letterSpacing: "0.06em",
            }}
          >
            {building.borough}
          </div>
        )}

        {/* Meta line */}
        {metaParts.length > 0 && (
          <div
            style={{
              fontFamily: "var(--v2-sans)",
              fontSize: 12,
              color: "var(--v2-ink-soft)",
            }}
          >
            {metaParts.join(" · ")}
          </div>
        )}

        {/* Spacer pushes CTA to bottom */}
        <div style={{ flex: 1 }} />

        {/* CTA */}
        <Link
          href={url}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontFamily: "var(--v2-sans)",
            fontSize: 13,
            fontWeight: 600,
            color: "var(--v2-brand)",
            textDecoration: "none",
            marginTop: 8,
          }}
        >
          View building
          <svg
            width="13"
            height="13"
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
    </article>
  );
}

// ── S08: Main export ──────────────────────────────────────────────────────────

interface Props {
  similar: BuildingV2Data["similar"];
  city: City;
}

export function S08_SimilarNearby({ similar, city }: Props) {
  const displayBuildings = similar.slice(0, 4);

  return (
    <section
      id="similar"
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
          08 · Similar nearby
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
          Similar buildings nearby
        </h2>
      </div>

      {displayBuildings.length === 0 ? (
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
            No nearby buildings found.
          </p>
        </div>
      ) : (
        <>
          <style>{`
            .s08-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 16px;
            }
            @media (max-width: 899px) {
              .s08-grid { grid-template-columns: repeat(2, 1fr); }
            }
            @media (max-width: 499px) {
              .s08-grid { grid-template-columns: 1fr; }
            }
          `}</style>
          <div className="s08-grid">
            {displayBuildings.map((b) => (
              <SimilarCard key={b.id} building={b} city={city} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

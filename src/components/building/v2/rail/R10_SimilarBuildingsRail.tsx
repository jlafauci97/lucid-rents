import Link from "next/link";
import { buildingUrl } from "@/lib/seo";
import type { BuildingV2Data } from "@/app/[city]/building/[borough]/[slug]/v2/_data";
import type { City } from "@/lib/cities";

// ── mini building illustration ────────────────────────────────────────────────

function MiniBuilding() {
  return (
    <svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 44, height: 44, flexShrink: 0 }}>
      <rect x="9" y="11" width="42" height="44" fill="#dbeafe" stroke="#93c5fd" strokeWidth="1.5" />
      <path d="M9 11 L30 3 L51 11" fill="#bfdbfe" stroke="#93c5fd" strokeWidth="1.5" strokeLinejoin="round" />
      <rect x="15" y="16" width="7" height="7" fill="#3b82f6" rx="1" />
      <rect x="27" y="16" width="7" height="7" fill="#3b82f6" rx="1" />
      <rect x="38" y="16" width="7" height="7" fill="#3b82f6" rx="1" />
      <rect x="15" y="28" width="7" height="7" fill="#3b82f6" rx="1" />
      <rect x="27" y="28" width="7" height="7" fill="#3b82f6" rx="1" />
      <rect x="38" y="28" width="7" height="7" fill="#3b82f6" rx="1" />
      <rect x="15" y="40" width="7" height="7" fill="#60a5fa" rx="1" />
      <rect x="27" y="40" width="7" height="7" fill="#60a5fa" rx="1" />
      <rect x="38" y="40" width="7" height="7" fill="#60a5fa" rx="1" />
      <rect x="26" y="49" width="8" height="6" fill="#1e40af" rx="1" />
    </svg>
  );
}

// ── single mini card ──────────────────────────────────────────────────────────

function MiniCard({
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

  const score = building.overall_score;
  const starsCount = score != null ? Math.round((score / 100) * 5) : null;

  return (
    <article style={miniCardStyle}>
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", width: 48, height: 48, background: "linear-gradient(180deg, #eff6ff 0%, #dbeafe 100%)", borderRadius: "var(--v2-radius-sm)" }}>
        <MiniBuilding />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <Link
          href={url}
          style={{ fontSize: 13, fontWeight: 600, color: "var(--v2-brand-hi)", textDecoration: "none", display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
        >
          {building.full_address}
        </Link>
        <div style={{ fontSize: 11, color: "var(--v2-ink-mute)", marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
          {metaParts.length > 0 && <span>{metaParts.join(" · ")}</span>}
          {starsCount != null && (
            <span style={{ color: "#f59e0b", letterSpacing: "0.02em" }}>
              {"★".repeat(starsCount)}{"☆".repeat(Math.max(0, 5 - starsCount))}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

// ── main export ───────────────────────────────────────────────────────────────

interface Props {
  similar: BuildingV2Data["similar"];
  city: City;
}

export function R10_SimilarBuildingsRail({ similar, city }: Props) {
  const buildings = similar.slice(0, 5);

  return (
    <section style={cardStyle}>
      <header style={headStyle}>
        <span style={iconStyle}>
          <GridIcon />
        </span>
        <h4 style={headingStyle}>Similar buildings</h4>
      </header>

      {buildings.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--v2-ink-mute)", margin: 0 }}>No similar buildings found.</p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {buildings.map((b) => (
            <MiniCard key={b.id} building={b} city={city} />
          ))}
        </div>
      )}
    </section>
  );
}

// ── icon ──────────────────────────────────────────────────────────────────────

function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
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

const miniCardStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 10px",
  background: "rgba(255,255,255,0.6)",
  border: "1px solid var(--v2-border)",
  borderRadius: "var(--v2-radius-sm)",
};

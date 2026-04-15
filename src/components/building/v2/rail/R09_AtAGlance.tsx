import type { Building } from "@/types";
import type { City } from "@/lib/cities";

// ── parcel ID helper ──────────────────────────────────────────────────────────

function primaryParcelId(building: Building): { label: string; value: string | null } {
  switch (building.metro as City) {
    case "nyc":
      return { label: "BBL", value: building.bbl };
    case "los-angeles":
      return { label: "APN", value: building.apn };
    case "houston":
      return { label: "Parcel", value: building.apn ?? building.pin };
    case "chicago":
      return { label: "PIN", value: building.pin };
    case "miami":
      return { label: "Folio", value: building.folio_number };
    default:
      return { label: "Parcel", value: building.apn ?? building.bbl ?? building.pin };
  }
}

// ── sub-components ────────────────────────────────────────────────────────────

function FactRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value == null || value === "") return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, fontSize: 13 }}>
      <span style={{ fontFamily: "var(--v2-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--v2-ink-mute)", flexShrink: 0 }}>
        {label}
      </span>
      <span style={{ color: "var(--v2-ink)", fontWeight: 500, fontFamily: "var(--v2-sans)", textAlign: "right" }}>
        {value}
      </span>
    </div>
  );
}

function MonoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, fontSize: 13 }}>
      <span style={{ fontFamily: "var(--v2-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--v2-ink-mute)", flexShrink: 0 }}>
        {label}
      </span>
      <span style={{ color: "var(--v2-ink)", fontWeight: 500, fontFamily: "var(--v2-mono)", fontSize: 12, textAlign: "right" }}>
        {value}
      </span>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

interface Props {
  building: Building;
}

export function R09_AtAGlance({ building }: Props) {
  const parcel = primaryParcelId(building);
  const isNYC = building.metro === "nyc";

  const stabUnits = building.stabilized_units;
  const totalUnits = building.total_units;
  const stabPct = stabUnits != null && totalUnits != null && totalUnits > 0
    ? ` (${Math.round((stabUnits / totalUnits) * 100)}%)`
    : "";

  const stabDisplay = stabUnits != null
    ? `${stabUnits.toLocaleString()}${stabPct}`
    : null;

  return (
    <section style={cardStyle}>
      <header style={headStyle}>
        <span style={iconStyle}><BuildingIcon /></span>
        <h4 style={headingStyle}>At a glance</h4>
      </header>

      <div style={{ display: "grid", gap: 7 }}>
        <FactRow label="Year built" value={building.year_built} />
        <FactRow label="Floors" value={building.num_floors} />
        <FactRow
          label="Total units"
          value={totalUnits != null ? totalUnits.toLocaleString() : null}
        />
        {stabDisplay && <FactRow label="Rent-stab units" value={stabDisplay} />}
        {building.building_class && (
          <FactRow label="Class" value={building.building_class} />
        )}
        <MonoRow label={parcel.label} value={parcel.value} />
        {isNYC && building.bin && <MonoRow label="BIN" value={building.bin} />}
      </div>

      {/* Last 30 days strip */}
      <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--v2-border)" }}>
        <div style={subheadStyle}>
          <ClockIcon />
          LAST 30 DAYS
        </div>
        <div style={{ display: "grid", gap: 7, marginTop: 8 }}>
          <FactRow label="New violations" value="—" />
          <FactRow label="New 311 calls" value="—" />
          <FactRow label="New reviews" value="—" />
          <FactRow label="New listings" value="—" />
        </div>
      </div>
    </section>
  );
}

// ── icons ─────────────────────────────────────────────────────────────────────

function BuildingIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M9 22v-6h6v6M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 11, height: 11 }}>
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
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

const subheadStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  fontFamily: "var(--v2-mono)",
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--v2-ink-mute)",
  fontWeight: 600,
};

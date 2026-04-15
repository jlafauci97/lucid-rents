import type { Building } from "@/types";
import type { BuildingV2Data } from "@/app/[city]/building/[borough]/[slug]/v2/_data";

interface Props {
  building: Building;
  reviews: BuildingV2Data["reviews"];
  hpdCount: number;
  evictionCount: number;
  complaintsCount: number;
}

function fmt(n: number | null | undefined): string {
  if (n == null || n === 0) return "—";
  return n.toLocaleString();
}

function ownerTenureYears(building: Building): number | null {
  // We don't have a deed-transfer date on the building type; return null
  return null;
}

interface StatCellProps {
  value: string;
  label: string;
  last?: boolean;
}

function StatCell({ value, label, last }: StatCellProps) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        padding: "18px 12px",
        borderRight: last ? "none" : "1px solid var(--v2-border)",
        textAlign: "center",
        minWidth: 0,
      }}
    >
      <span
        style={{
          fontFamily: "var(--v2-serif)",
          fontSize: 28,
          fontWeight: 700,
          color: "var(--v2-ink)",
          lineHeight: 1,
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontFamily: "var(--v2-mono)",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.07em",
          color: "var(--v2-ink-mute)",
          lineHeight: 1.3,
        }}
      >
        {label}
      </span>
    </div>
  );
}

export function RecordStrip({ building, reviews, hpdCount, evictionCount, complaintsCount }: Props) {
  const tenure = ownerTenureYears(building);

  const stats = [
    { value: fmt(hpdCount), label: "HPD violations" },
    { value: fmt(evictionCount), label: "Evictions" },
    { value: fmt(reviews.total) === "—" ? "0" : fmt(reviews.total), label: "Reviews" },
    { value: fmt(building.stabilized_units), label: "Rent-stab units" },
    { value: tenure != null ? fmt(tenure) : "—", label: "Owner tenure yrs" },
    { value: fmt(complaintsCount), label: "311 complaints" },
  ];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        border: "1px solid var(--v2-border)",
        borderRadius: "var(--v2-radius)",
        background: "var(--v2-surface)",
        overflow: "hidden",
        marginBottom: 32,
      }}
    >
      {stats.map((stat, i) => (
        <StatCell
          key={stat.label}
          value={stat.value}
          label={stat.label}
          last={i === stats.length - 1}
        />
      ))}
    </div>
  );
}

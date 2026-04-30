import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { City } from "@/lib/cities";
import { buildingUrl, cityBreadcrumbs, cityPath, landlordUrl } from "@/lib/seo";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { V2Zoom } from "@/components/building/v2/V2Zoom";
import type {
  LandlordIncidentGroups,
  LandlordHpdViolationRow,
  LandlordComplaintRow,
  LandlordLitigationRow,
} from "@/app/[city]/landlord/[name]/_data";

interface Props {
  city: City;
  landlordName: string;
  landlordSlug: string;
  violations: LandlordIncidentGroups<LandlordHpdViolationRow>;
  complaints: LandlordIncidentGroups<LandlordComplaintRow>;
  litigations: LandlordIncidentGroups<LandlordLitigationRow>;
}

type BuildingRollup = {
  id: string;
  full_address: string;
  borough: string | null;
  slug: string | null;
  total_units: number | null;
  violations: LandlordHpdViolationRow[];
  violationsTotal: number;
  complaints: LandlordComplaintRow[];
  complaintsTotal: number;
  litigations: LandlordLitigationRow[];
  litigationsTotal: number;
};

function rollup(
  violations: LandlordIncidentGroups<LandlordHpdViolationRow>,
  complaints: LandlordIncidentGroups<LandlordComplaintRow>,
  litigations: LandlordIncidentGroups<LandlordLitigationRow>
): BuildingRollup[] {
  const byId = new Map<string, BuildingRollup>();
  const seed = (b: { id: string; full_address: string; borough: string | null; slug: string | null; total_units: number | null }) => {
    if (byId.has(b.id)) return byId.get(b.id)!;
    const row: BuildingRollup = {
      id: b.id,
      full_address: b.full_address,
      borough: b.borough,
      slug: b.slug,
      total_units: b.total_units,
      violations: [],
      violationsTotal: 0,
      complaints: [],
      complaintsTotal: 0,
      litigations: [],
      litigationsTotal: 0,
    };
    byId.set(b.id, row);
    return row;
  };
  for (const g of violations.buildings) {
    const r = seed(g);
    r.violations = g.records;
    r.violationsTotal = g.totalCount;
  }
  for (const g of complaints.buildings) {
    const r = seed(g);
    r.complaints = g.records;
    r.complaintsTotal = g.totalCount;
  }
  for (const g of litigations.buildings) {
    const r = seed(g);
    r.litigations = g.records;
    r.litigationsTotal = g.totalCount;
  }
  return Array.from(byId.values()).sort((a, b) => {
    const aTotal = a.violationsTotal + a.complaintsTotal + a.litigationsTotal;
    const bTotal = b.violationsTotal + b.complaintsTotal + b.litigationsTotal;
    return bTotal - aTotal;
  });
}

export function LandlordRecordBreakdown({
  city,
  landlordName,
  landlordSlug,
  violations,
  complaints,
  litigations,
}: Props) {
  const rolled = rollup(violations, complaints, litigations);
  const totalViolations = violations.totalRecords;
  const totalComplaints = complaints.totalRecords;
  const totalLitigations = litigations.totalRecords;
  const totalIssues = totalViolations + totalComplaints + totalLitigations;
  const buildingsWithIssues = rolled.length;

  const breadcrumbs = cityBreadcrumbs(
    city,
    { label: "Landlords", href: cityPath("/landlords", city) },
    { label: landlordName, href: cityPath(`/landlord/${landlordSlug}`, city) },
    { label: "Record by building", href: cityPath(`/landlord/${landlordSlug}/record`, city) },
  );

  return (
    <div className="v2">
      <V2Zoom />
      <div className="container">
        <Breadcrumbs items={breadcrumbs} />

        <div style={{ padding: "var(--s-5) 0 var(--s-3)" }}>
          <Link
            href={landlordUrl(landlordName, city)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              borderRadius: 999,
              border: "1px solid var(--border)",
              background: "var(--paper)",
              fontFamily: "var(--mono)",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "var(--ink)",
              textDecoration: "none",
            }}
          >
            <ArrowLeft style={{ width: 14, height: 14 }} />
            Back to {landlordName}
          </Link>
          <h1
            style={{
              fontFamily: "var(--serif)",
              fontSize: "clamp(2rem, 4vw, 3.5rem)",
              letterSpacing: "-0.02em",
              margin: "var(--s-3) 0 var(--s-1)",
              color: "var(--ink)",
              lineHeight: 1.05,
            }}
          >
            The record by building.
          </h1>
          <p
            style={{
              fontFamily: "var(--sans)",
              fontSize: "var(--f-16)",
              color: "var(--ink-soft)",
              margin: 0,
            }}
          >
            {landlordName} · {totalIssues.toLocaleString()} {totalIssues === 1 ? "record" : "records"} across{" "}
            {buildingsWithIssues.toLocaleString()} {buildingsWithIssues === 1 ? "building" : "buildings"} · sorted by total count
          </p>
          <div
            style={{
              display: "flex",
              gap: 18,
              marginTop: "var(--s-3)",
              fontFamily: "var(--mono)",
              fontSize: 11,
              color: "var(--ink-mute)",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            <span>{totalViolations.toLocaleString()} violations</span>
            <span>·</span>
            <span>{totalComplaints.toLocaleString()} complaints</span>
            <span>·</span>
            <span>{totalLitigations.toLocaleString()} litigations</span>
          </div>
        </div>

        {rolled.length === 0 ? (
          <EmptyState />
        ) : (
          <div style={{ display: "grid", gap: "var(--s-4)", margin: "var(--s-5) 0 var(--s-9)" }}>
            {rolled.map((b) => (
              <BuildingBlock key={b.id} building={b} city={city} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BuildingBlock({ building, city }: { building: BuildingRollup; city: City }) {
  const buildingHref =
    building.slug && building.borough ? buildingUrl({ borough: building.borough, slug: building.slug }, city) : null;
  const buildingViolationsHref = buildingHref ? `${buildingHref}/violations` : null;
  const shortAddress = building.full_address.split(",")[0] ?? building.full_address;
  const totalForBuilding = building.violationsTotal + building.complaintsTotal + building.litigationsTotal;

  const headerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "16px 20px",
    background: "var(--paper-2)",
    borderBottom: "1px solid var(--border)",
    color: "inherit",
    textDecoration: "none",
  };

  const headerInner = (
    <>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontFamily: "var(--sans)",
            fontSize: 15,
            fontWeight: 700,
            color: "var(--ink)",
            letterSpacing: "-0.005em",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {shortAddress}
          {buildingHref ? <span style={{ color: "var(--ink-mute)", fontWeight: 400 }}>›</span> : null}
        </div>
        <div
          style={{
            fontFamily: "var(--mono)",
            fontSize: 11,
            color: "var(--ink-mute)",
            letterSpacing: "0.02em",
            marginTop: 2,
          }}
        >
          {building.borough ?? "—"}
          {building.total_units ? ` · ${building.total_units} units` : ""}
          {buildingHref ? " · view building" : ""}
        </div>
      </div>
      <div style={{ display: "flex", gap: 18, flexShrink: 0, textAlign: "right" }}>
        <CountStat label="violations" n={building.violationsTotal} tone={building.violationsTotal > 0 ? "warn" : "neutral"} />
        <CountStat label="complaints" n={building.complaintsTotal} tone="neutral" />
        <CountStat
          label="litigations"
          n={building.litigationsTotal}
          tone={building.litigationsTotal > 0 ? "warn" : "neutral"}
        />
      </div>
    </>
  );

  return (
    <div
      style={{
        background: "var(--paper)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      {buildingHref ? (
        <Link href={buildingHref} style={headerStyle}>
          {headerInner}
        </Link>
      ) : (
        <div style={headerStyle}>{headerInner}</div>
      )}

      {totalForBuilding === 0 ? (
        <div
          style={{
            padding: "16px 20px",
            fontFamily: "var(--sans)",
            fontSize: 13,
            color: "var(--ink-soft)",
          }}
        >
          No records on file for this building.
        </div>
      ) : (
        <>
          {building.violations.length > 0 ? (
            <CategoryBlock title={`Violations · ${building.violationsTotal.toLocaleString()}`}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "120px 80px 1fr 140px",
                  gap: 12,
                  padding: "8px 20px",
                  background: "var(--paper)",
                  borderBottom: "1px solid var(--border)",
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  color: "var(--ink-mute)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  fontWeight: 700,
                }}
              >
                <span>Date</span>
                <span>Class</span>
                <span>Description</span>
                <span>Status</span>
              </div>
              {building.violations.map((r) => (
                <ViolationRow key={r.id} record={r} />
              ))}
            </CategoryBlock>
          ) : null}

          {building.complaints.length > 0 ? (
            <CategoryBlock title={`311 complaints · ${building.complaintsTotal.toLocaleString()}`}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "120px 1.2fr 1.4fr 100px",
                  gap: 12,
                  padding: "8px 20px",
                  background: "var(--paper)",
                  borderBottom: "1px solid var(--border)",
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  color: "var(--ink-mute)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  fontWeight: 700,
                }}
              >
                <span>Date</span>
                <span>Type</span>
                <span>Detail</span>
                <span>Status</span>
              </div>
              {building.complaints.map((r) => (
                <ComplaintRow key={r.id} record={r} />
              ))}
            </CategoryBlock>
          ) : null}

          {building.litigations.length > 0 ? (
            <CategoryBlock title={`Litigations · ${building.litigationsTotal.toLocaleString()}`}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "120px 1.2fr 1.4fr 120px",
                  gap: 12,
                  padding: "8px 20px",
                  background: "var(--paper)",
                  borderBottom: "1px solid var(--border)",
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  color: "var(--ink-mute)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  fontWeight: 700,
                }}
              >
                <span>Opened</span>
                <span>Case type</span>
                <span>Respondent</span>
                <span>Status</span>
              </div>
              {building.litigations.map((r) => (
                <LitigationRow key={r.id} record={r} />
              ))}
            </CategoryBlock>
          ) : null}
        </>
      )}

      {buildingViolationsHref && totalForBuilding > 0 ? (
        <Link
          href={buildingViolationsHref}
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
          See full record at this building →
        </Link>
      ) : null}
    </div>
  );
}

function CountStat({ label, n, tone }: { label: string; n: number; tone: "warn" | "neutral" }) {
  return (
    <div>
      <div
        style={{
          fontFamily: "var(--serif)",
          fontSize: 22,
          letterSpacing: "-0.02em",
          color: tone === "warn" && n > 0 ? "var(--bad)" : "var(--ink)",
          lineHeight: 1,
        }}
      >
        {n.toLocaleString()}
      </div>
      <div
        style={{
          fontFamily: "var(--mono)",
          fontSize: 9,
          color: "var(--ink-mute)",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          marginTop: 2,
        }}
      >
        {label}
      </div>
    </div>
  );
}

function CategoryBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          padding: "12px 20px 6px",
          fontFamily: "var(--sans)",
          fontSize: 13,
          fontWeight: 700,
          color: "var(--ink)",
          letterSpacing: "-0.005em",
          background: "var(--paper)",
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function ViolationRow({ record: r }: { record: LandlordHpdViolationRow }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "120px 80px 1fr 140px",
        gap: 12,
        padding: "8px 20px",
        borderBottom: "1px solid var(--border)",
        fontFamily: "var(--sans)",
        fontSize: 13,
        color: "var(--ink)",
        alignItems: "center",
      }}
    >
      <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-soft)" }}>
        {r.inspection_date ? new Date(r.inspection_date).toLocaleDateString() : "—"}
      </span>
      <span
        style={{
          fontFamily: "var(--mono)",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.04em",
          color: r.class === "C" ? "var(--bad)" : r.class === "B" ? "#ea580c" : "var(--ink-soft)",
        }}
      >
        Class {r.class ?? "—"}
      </span>
      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {r.nov_description ?? "—"}
        {r.apartment ? <span style={{ color: "var(--ink-mute)" }}> · Apt {r.apartment}</span> : null}
      </span>
      <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-mute)", letterSpacing: "0.02em" }}>
        {r.status ?? "—"}
      </span>
    </div>
  );
}

function ComplaintRow({ record: r }: { record: LandlordComplaintRow }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "120px 1.2fr 1.4fr 100px",
        gap: 12,
        padding: "8px 20px",
        borderBottom: "1px solid var(--border)",
        fontFamily: "var(--sans)",
        fontSize: 13,
        color: "var(--ink)",
        alignItems: "center",
      }}
    >
      <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-soft)" }}>
        {r.created_date ? new Date(r.created_date).toLocaleDateString() : "—"}
      </span>
      <span style={{ fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {r.complaint_type ?? "—"}
      </span>
      <span
        style={{
          minWidth: 0,
          color: "var(--ink-soft)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {r.descriptor ?? "—"}
      </span>
      <span
        style={{
          fontFamily: "var(--mono)",
          fontSize: 11,
          color: r.status?.toLowerCase().includes("open") ? "var(--bad)" : "var(--ink-mute)",
          letterSpacing: "0.02em",
        }}
      >
        {r.status ?? "—"}
      </span>
    </div>
  );
}

function LitigationRow({ record: r }: { record: LandlordLitigationRow }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "120px 1.2fr 1.4fr 120px",
        gap: 12,
        padding: "8px 20px",
        borderBottom: "1px solid var(--border)",
        fontFamily: "var(--sans)",
        fontSize: 13,
        color: "var(--ink)",
        alignItems: "center",
      }}
    >
      <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-soft)" }}>
        {r.case_open_date ? new Date(r.case_open_date).toLocaleDateString() : "—"}
      </span>
      <span style={{ fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {r.case_type ?? "—"}
      </span>
      <span
        style={{
          minWidth: 0,
          color: "var(--ink-soft)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {r.respondent ?? "—"}
      </span>
      <span
        style={{
          fontFamily: "var(--mono)",
          fontSize: 11,
          color: r.case_status?.toLowerCase().includes("open") ? "var(--bad)" : "var(--ink-mute)",
          letterSpacing: "0.02em",
        }}
      >
        {r.case_status ?? "—"}
      </span>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        background: "var(--paper)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "var(--s-7)",
        textAlign: "center",
        margin: "var(--s-5) 0 var(--s-9)",
      }}
    >
      <p style={{ fontFamily: "var(--sans)", fontSize: "var(--f-16)", color: "var(--ink-soft)", margin: 0 }}>
        No records on file across this portfolio yet.
      </p>
    </div>
  );
}

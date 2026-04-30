import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { City } from "@/lib/cities";
import { buildingUrl, cityBreadcrumbs, cityPath, landlordUrl } from "@/lib/seo";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { V2Zoom } from "@/components/building/v2/V2Zoom";
import type {
  LandlordIncidentBuilding,
  LandlordIncidentGroups,
} from "@/app/[city]/landlord/[name]/_data";

interface Props<T> {
  city: City;
  landlordName: string;
  landlordSlug: string;
  kind: "violations" | "complaints" | "litigations";
  groups: LandlordIncidentGroups<T>;
  renderRecord: (record: T) => React.ReactNode;
  recordHeader: React.ReactNode;
  recordColumns: string;
  recordLabel: string;
}

const KIND_META = {
  violations: {
    title: "HPD violations",
    crumb: "Violations",
    pathSegment: "violations",
    summarySource: "HPD Online inspections",
    deepLinkSegment: "violations",
  },
  complaints: {
    title: "311 complaints",
    crumb: "311 complaints",
    pathSegment: "complaints",
    summarySource: "NYC 311 service requests",
    deepLinkSegment: "violations",
  },
  litigations: {
    title: "Housing-court litigations",
    crumb: "Litigations",
    pathSegment: "litigations",
    summarySource: "HPD litigation index",
    deepLinkSegment: "violations",
  },
} as const;

export function LandlordIncidentBreakdown<T>({
  city,
  landlordName,
  landlordSlug,
  kind,
  groups,
  renderRecord,
  recordHeader,
  recordColumns,
  recordLabel,
}: Props<T>) {
  const meta = KIND_META[kind];
  const breadcrumbs = cityBreadcrumbs(
    city,
    { label: "Landlords", href: cityPath("/landlords", city) },
    { label: landlordName, href: cityPath(`/landlord/${landlordSlug}`, city) },
    { label: meta.crumb, href: cityPath(`/landlord/${landlordSlug}/${meta.pathSegment}`, city) },
  );

  const { buildings, totalRecords, buildingsWithRecords, totalBuildings } = groups;
  const capped = totalRecords >= 5000;

  return (
    <div className="v2">
      <V2Zoom />
      <div className="container">
        <Breadcrumbs items={breadcrumbs} />

        <div style={{ padding: "var(--s-5) 0 var(--s-3)" }}>
          <Link
            href={landlordUrl(landlordName, city)}
            className="inline-flex items-center gap-1 text-sm text-[#64748b] hover:text-[#0F1D2E] mt-2"
          >
            <ArrowLeft className="w-4 h-4" />
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
            {totalRecords.toLocaleString()} {meta.title.toLowerCase()}.
          </h1>
          <p
            style={{
              fontFamily: "var(--sans)",
              fontSize: "var(--f-16)",
              color: "var(--ink-soft)",
              margin: 0,
            }}
          >
            {landlordName} · across {buildingsWithRecords.toLocaleString()} of{" "}
            {totalBuildings.toLocaleString()} {totalBuildings === 1 ? "building" : "buildings"}
            {" · "}
            sorted by record count
            {capped ? " · capped at 5,000 most recent" : ""}
          </p>
          <p
            style={{
              fontFamily: "var(--mono)",
              fontSize: 11,
              color: "var(--ink-mute)",
              letterSpacing: "0.04em",
              margin: "var(--s-2) 0 0",
              textTransform: "uppercase",
            }}
          >
            Source · {meta.summarySource}
          </p>
        </div>

        {buildings.length === 0 ? (
          <EmptyState kind={kind} />
        ) : (
          <div style={{ display: "grid", gap: "var(--s-4)", margin: "var(--s-5) 0 var(--s-9)" }}>
            {buildings.map((b) => (
              <BuildingGroup
                key={b.id}
                building={b}
                city={city}
                renderRecord={renderRecord}
                recordHeader={recordHeader}
                recordColumns={recordColumns}
                recordLabel={recordLabel}
                kindPathSegment={meta.deepLinkSegment}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BuildingGroup<T>({
  building,
  city,
  renderRecord,
  recordHeader,
  recordColumns,
  recordLabel,
  kindPathSegment,
}: {
  building: LandlordIncidentBuilding<T>;
  city: City;
  renderRecord: (record: T) => React.ReactNode;
  recordHeader: React.ReactNode;
  recordColumns: string;
  recordLabel: string;
  kindPathSegment: string;
}) {
  const href =
    building.slug && building.borough
      ? `${buildingUrl({ borough: building.borough, slug: building.slug }, city)}/${kindPathSegment}`
      : null;
  const buildingHref =
    building.slug && building.borough ? buildingUrl({ borough: building.borough, slug: building.slug }, city) : null;
  const shortAddress = building.full_address.split(",")[0] ?? building.full_address;
  const hidden = building.totalCount - building.records.length;

  return (
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
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "16px 20px",
          background: "var(--paper-2)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div style={{ minWidth: 0 }}>
          {buildingHref ? (
            <Link
              href={buildingHref}
              style={{
                fontFamily: "var(--sans)",
                fontSize: 15,
                fontWeight: 700,
                color: "var(--ink)",
                letterSpacing: "-0.005em",
                textDecoration: "none",
              }}
            >
              {shortAddress}
            </Link>
          ) : (
            <span
              style={{
                fontFamily: "var(--sans)",
                fontSize: 15,
                fontWeight: 700,
                color: "var(--ink)",
                letterSpacing: "-0.005em",
              }}
            >
              {shortAddress}
            </span>
          )}
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
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div
            style={{
              fontFamily: "var(--serif)",
              fontSize: 24,
              letterSpacing: "-0.02em",
              color: building.totalCount > 0 ? "var(--bad)" : "var(--ink)",
              lineHeight: 1,
            }}
          >
            {building.totalCount.toLocaleString()}
          </div>
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: 10,
              color: "var(--ink-mute)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              marginTop: 2,
            }}
          >
            {recordLabel}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: recordColumns,
          gap: 12,
          padding: "10px 20px",
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
        {recordHeader}
      </div>

      <div>
        {building.records.map((r, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: recordColumns,
              gap: 12,
              padding: "10px 20px",
              borderBottom: "1px solid var(--border)",
              fontFamily: "var(--sans)",
              fontSize: 13,
              color: "var(--ink)",
              alignItems: "center",
            }}
          >
            {renderRecord(r)}
          </div>
        ))}
      </div>

      {hidden > 0 && href ? (
        <Link
          href={href}
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
          See all {building.totalCount.toLocaleString()} at this building →
        </Link>
      ) : null}
    </div>
  );
}

function EmptyState({ kind }: { kind: "violations" | "complaints" | "litigations" }) {
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
        No {kind === "litigations" ? "active court cases" : kind} on file across this portfolio.
      </p>
    </div>
  );
}

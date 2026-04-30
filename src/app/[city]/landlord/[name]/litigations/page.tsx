import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { cityPath, canonicalUrl, landlordSlug } from "@/lib/seo";
import type { City } from "@/lib/cities";
import { getLandlordStats } from "@/lib/landlord-stats";
import {
  loadLandlordLitigationsByBuilding,
  type LandlordLitigationRow,
} from "@/app/[city]/landlord/[name]/_data";
import { LandlordIncidentBreakdown } from "@/components/landlord/LandlordIncidentBreakdown";

export const revalidate = 86400;

interface Props {
  params: Promise<{ city: string; name: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city: cityParam, name } = await params;
  const city = (cityParam || "nyc") as City;
  const stats = await getLandlordStats(name, city);
  if (!stats) return { title: "Landlord Not Found" };
  const title = `${stats.name} — Housing Court Cases`;
  const url = canonicalUrl(cityPath(`/landlord/${stats.slug}/litigations`, city));
  return {
    title,
    description: `Every housing-court case on record across the ${stats.buildingCount.toLocaleString()}-building portfolio of ${stats.name}, grouped by building.`,
    alternates: { canonical: url },
  };
}

const recordHeader = (
  <>
    <span>Opened</span>
    <span>Case type</span>
    <span>Respondent</span>
    <span>Status</span>
  </>
);

const renderRecord = (r: LandlordLitigationRow) => (
  <>
    <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-soft)" }}>
      {r.case_open_date ? new Date(r.case_open_date).toLocaleDateString() : "—"}
    </span>
    <span style={{ fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
      {r.case_type ?? "—"}
    </span>
    <span style={{ minWidth: 0, color: "var(--ink-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
  </>
);

export default async function LandlordLitigationsPage({ params }: Props) {
  const { city: cityParam, name } = await params;
  const city = (cityParam || "nyc") as City;

  const cachedStats = await getLandlordStats(name, city);
  if (!cachedStats) {
    redirect(cityPath("/landlords", city));
  }

  const correctSlug = landlordSlug(cachedStats.name);
  if (correctSlug !== name) {
    redirect(cityPath(`/landlord/${correctSlug}/litigations`, city));
  }

  const groups = await loadLandlordLitigationsByBuilding(correctSlug, city);
  if (groups.totalBuildings === 0) {
    notFound();
  }

  return (
    <LandlordIncidentBreakdown
      city={city}
      landlordName={cachedStats.name}
      landlordSlug={correctSlug}
      kind="litigations"
      groups={groups}
      renderRecord={renderRecord}
      recordHeader={recordHeader}
      recordColumns="120px 1.2fr 1.4fr 120px"
      recordLabel="cases on file"
    />
  );
}

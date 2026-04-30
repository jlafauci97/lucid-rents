import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { cityPath, canonicalUrl, landlordSlug } from "@/lib/seo";
import type { City } from "@/lib/cities";
import { getLandlordStats } from "@/lib/landlord-stats";
import {
  loadLandlordViolationsByBuilding,
  type LandlordHpdViolationRow,
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
  const title = `${stats.name} — All HPD Violations`;
  const url = canonicalUrl(cityPath(`/landlord/${stats.slug}/violations`, city));
  return {
    title,
    description: `Every HPD violation on record across the ${stats.buildingCount.toLocaleString()}-building portfolio of ${stats.name}, grouped by building.`,
    alternates: { canonical: url },
  };
}

const recordHeader = (
  <>
    <span>Date</span>
    <span>Class</span>
    <span>Description</span>
    <span>Status</span>
  </>
);

const renderRecord = (r: LandlordHpdViolationRow) => (
  <>
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
  </>
);

export default async function LandlordViolationsPage({ params }: Props) {
  const { city: cityParam, name } = await params;
  const city = (cityParam || "nyc") as City;

  const cachedStats = await getLandlordStats(name, city);
  if (!cachedStats) {
    redirect(cityPath("/landlords", city));
  }

  const correctSlug = landlordSlug(cachedStats.name);
  if (correctSlug !== name) {
    redirect(cityPath(`/landlord/${correctSlug}/violations`, city));
  }

  const groups = await loadLandlordViolationsByBuilding(correctSlug, city);
  if (groups.totalBuildings === 0) {
    notFound();
  }

  return (
    <LandlordIncidentBreakdown
      city={city}
      landlordName={cachedStats.name}
      landlordSlug={correctSlug}
      kind="violations"
      groups={groups}
      renderRecord={renderRecord}
      recordHeader={recordHeader}
      recordColumns="120px 80px 1fr 140px"
      recordLabel="violations on file"
    />
  );
}

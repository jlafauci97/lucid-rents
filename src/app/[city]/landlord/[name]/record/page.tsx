import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { cityPath, canonicalUrl, landlordSlug } from "@/lib/seo";
import type { City } from "@/lib/cities";
import { CITY_META } from "@/lib/cities";
import { getLandlordStats } from "@/lib/landlord-stats";
import {
  loadLandlordBuildingList,
  loadLandlordViolationsByBuilding,
  loadLandlordComplaintsByBuilding,
  loadLandlordLitigationsByBuilding,
} from "@/app/[city]/landlord/[name]/_data";
import { LandlordRecordBreakdown } from "@/components/landlord/LandlordRecordBreakdown";

export const revalidate = 86400;

interface Props {
  params: Promise<{ city: string; name: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city: cityParam, name } = await params;
  const city = (cityParam || "nyc") as City;
  const stats = await getLandlordStats(name, city);
  if (!stats) return { title: "Landlord Not Found" };
  const title = `${stats.name} — Record by Building`;
  const url = canonicalUrl(cityPath(`/landlord/${stats.slug}/record`, city));
  return {
    title,
    description: `Every HPD violation, 311 complaint, and housing-court case across the ${stats.buildingCount.toLocaleString()}-building portfolio of ${stats.name} in ${CITY_META[city].fullName}, grouped by building.`,
    alternates: { canonical: url },
  };
}

export default async function LandlordRecordPage({ params }: Props) {
  const { city: cityParam, name } = await params;
  const city = (cityParam || "nyc") as City;

  const cachedStats = await getLandlordStats(name, city);
  if (!cachedStats) {
    redirect(cityPath("/landlords", city));
  }

  const correctSlug = landlordSlug(cachedStats.name);
  if (correctSlug !== name) {
    redirect(cityPath(`/landlord/${correctSlug}/record`, city));
  }

  const [buildings, violations, complaints, litigations] = await Promise.all([
    loadLandlordBuildingList(correctSlug, city),
    loadLandlordViolationsByBuilding(correctSlug, city),
    loadLandlordComplaintsByBuilding(correctSlug, city),
    loadLandlordLitigationsByBuilding(correctSlug, city),
  ]);

  if (buildings.length === 0) {
    notFound();
  }

  return (
    <LandlordRecordBreakdown
      city={city}
      landlordName={cachedStats.name}
      landlordSlug={correctSlug}
      buildings={buildings}
      violations={violations}
      complaints={complaints}
      litigations={litigations}
    />
  );
}

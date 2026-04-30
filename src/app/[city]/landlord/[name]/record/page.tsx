import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { cityPath, canonicalUrl, cityBreadcrumbs, landlordSlug, landlordUrl } from "@/lib/seo";
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
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { V2Zoom } from "@/components/building/v2/V2Zoom";

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

async function RecordContent({
  city,
  landlordName,
  landlordSlug: slug,
}: {
  city: City;
  landlordName: string;
  landlordSlug: string;
}) {
  const [buildings, violations, complaints, litigations] = await Promise.all([
    loadLandlordBuildingList(slug, city),
    loadLandlordViolationsByBuilding(slug, city),
    loadLandlordComplaintsByBuilding(slug, city),
    loadLandlordLitigationsByBuilding(slug, city),
  ]);

  if (buildings.length === 0) {
    notFound();
  }

  return (
    <LandlordRecordBreakdown
      city={city}
      landlordName={landlordName}
      landlordSlug={slug}
      buildings={buildings}
      violations={violations}
      complaints={complaints}
      litigations={litigations}
    />
  );
}

function RecordSkeleton({
  city,
  landlordName,
  landlordSlug: slug,
}: {
  city: City;
  landlordName: string;
  landlordSlug: string;
}) {
  const breadcrumbs = cityBreadcrumbs(
    city,
    { label: "Landlords", href: cityPath("/landlords", city) },
    { label: landlordName, href: cityPath(`/landlord/${slug}`, city) },
    { label: "Record by building", href: cityPath(`/landlord/${slug}/record`, city) },
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
            Loading {landlordName}&apos;s portfolio…
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gap: "var(--s-4)",
            margin: "var(--s-5) 0 var(--s-9)",
          }}
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                background: "var(--paper)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                height: 140,
                opacity: 0.4,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
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

  return (
    <Suspense
      fallback={
        <RecordSkeleton city={city} landlordName={cachedStats.name} landlordSlug={correctSlug} />
      }
    >
      <RecordContent city={city} landlordName={cachedStats.name} landlordSlug={correctSlug} />
    </Suspense>
  );
}

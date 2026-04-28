import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { cityPath, cityBreadcrumbs, landlordSlug, landlordUrl, canonicalUrl, buildingUrl } from "@/lib/seo";
import { CITY_META } from "@/lib/cities";
import type { City } from "@/lib/cities";
import { getLandlordStats } from "@/lib/landlord-stats";
import {
  loadLandlordAllReviews,
  loadLandlordBuildingList,
  loadLandlordTenantVoice,
} from "@/app/[city]/landlord/[name]/_data";
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
  const title = `${stats.name} — All Tenant Reviews`;
  const url = canonicalUrl(cityPath(`/landlord/${stats.slug}/reviews`, city));
  return {
    title,
    description: `Every published tenant review across ${stats.buildingCount.toLocaleString()} buildings owned or managed by ${stats.name} in ${CITY_META[city].fullName}.`,
    alternates: { canonical: url },
  };
}

function stars(rating: number): React.ReactNode {
  const filled = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <>
      {"★".repeat(filled)}
      {filled < 5 ? <span style={{ color: "var(--border-hi)" }}>{"★".repeat(5 - filled)}</span> : null}
    </>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

async function resolveOwnerName(
  supabase: Awaited<ReturnType<typeof createClient>>,
  slug: string,
  city: City
): Promise<string | null> {
  const { data } = await supabase
    .from("landlord_stats")
    .select("name")
    .eq("slug", slug)
    .eq("metro", city)
    .limit(1)
    .maybeSingle();
  return data?.name ?? null;
}

export default async function LandlordReviewsPage({ params }: Props) {
  const { city: cityParam, name } = await params;
  const city = (cityParam || "nyc") as City;
  const supabase = await createClient();

  const [ownerName, cachedStats] = await Promise.all([
    resolveOwnerName(supabase, name, city),
    getLandlordStats(name, city),
  ]);

  if (!ownerName || !cachedStats) {
    redirect(cityPath("/landlords", city));
  }

  const correctSlug = landlordSlug(ownerName);
  if (correctSlug !== name) {
    redirect(cityPath(`/landlord/${correctSlug}/reviews`, city));
  }

  const [reviews, voice, buildings] = await Promise.all([
    loadLandlordAllReviews(correctSlug, city),
    loadLandlordTenantVoice(correctSlug, city),
    loadLandlordBuildingList(correctSlug, city),
  ]);

  if (reviews.length === 0) {
    notFound();
  }

  const buildingById = new Map(buildings.map((b) => [b.id, b]));
  const displayName = cachedStats.name;

  const breadcrumbs = cityBreadcrumbs(
    city,
    { label: "Landlords", href: cityPath("/landlords", city) },
    { label: displayName, href: cityPath(`/landlord/${correctSlug}`, city) },
    { label: "Reviews", href: cityPath(`/landlord/${correctSlug}/reviews`, city) },
  );

  return (
    <div className="v2">
      <V2Zoom />
      <div className="container">
        <Breadcrumbs items={breadcrumbs} />

        <div style={{ padding: "var(--s-5) 0 var(--s-3)" }}>
          <Link
            href={landlordUrl(displayName, city)}
            className="inline-flex items-center gap-1 text-sm text-[#64748b] hover:text-[#0F1D2E] mt-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to {displayName}
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
            All {reviews.length.toLocaleString()} tenant reviews.
          </h1>
          <p style={{ fontFamily: "var(--sans)", fontSize: "var(--f-16)", color: "var(--ink-soft)", margin: 0 }}>
            {displayName} · avg <b>{voice.avgRating.toFixed(1)}</b>{" "}
            <span style={{ color: "var(--sun)", letterSpacing: 2 }}>{stars(voice.avgRating)}</span> ·{" "}
            {CITY_META[city].fullName}
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gap: 10,
            margin: "var(--s-5) 0 var(--s-9)",
          }}
        >
          {reviews.map((r) => {
            const b = buildingById.get(r.building_id);
            return (
              <div
                key={r.id}
                style={{
                  background: "var(--paper)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: "14px 18px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 8,
                    fontFamily: "var(--mono)",
                    fontSize: 11,
                    color: "var(--ink-mute)",
                    letterSpacing: "0.02em",
                  }}
                >
                  <span style={{ color: "var(--sun)", letterSpacing: 2 }}>{stars(r.overall_rating)}</span>
                  <span>{formatDate(r.created_at)}</span>
                </div>
                {r.body ? (
                  <p
                    style={{
                      margin: "0 0 8px",
                      fontSize: 14,
                      lineHeight: 1.55,
                      color: "var(--ink-soft)",
                      letterSpacing: "-0.005em",
                    }}
                  >
                    &ldquo;{r.body}&rdquo;
                  </p>
                ) : (
                  <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--ink-mute)", fontStyle: "italic" }}>
                    — no written feedback —
                  </p>
                )}
                <Link
                  href={buildingUrl(
                    { borough: b?.borough ?? r.region ?? "unknown", slug: b?.slug ?? "" },
                    city
                  )}
                  style={{
                    display: "inline-block",
                    fontFamily: "var(--mono)",
                    fontSize: 11,
                    color: "var(--sky-deep)",
                    textDecoration: "none",
                  }}
                >
                  — {r.building_address.split(",")[0] ?? r.building_address} · {r.region}
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

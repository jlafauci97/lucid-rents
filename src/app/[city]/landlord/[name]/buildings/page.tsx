import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { cityPath, cityBreadcrumbs, landlordSlug, landlordUrl, canonicalUrl, buildingUrl } from "@/lib/seo";
import { CITY_META } from "@/lib/cities";
import type { City } from "@/lib/cities";
import { getLandlordStats } from "@/lib/landlord-stats";
import { loadLandlordBuildingList } from "@/app/[city]/landlord/[name]/_data";
import { normalizeScore } from "@/lib/constants";
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
  const title = `${stats.name} — All ${stats.buildingCount.toLocaleString()} Buildings`;
  const url = canonicalUrl(cityPath(`/landlord/${stats.slug}/buildings`, city));
  return {
    title,
    description: `Full portfolio of ${stats.buildingCount.toLocaleString()} buildings owned or managed by ${stats.name} in ${CITY_META[city].fullName}.`,
    alternates: { canonical: url },
  };
}

function gradeFor(score: number | null): { letter: string; bg: string; fg: string } {
  if (score === null) return { letter: "—", bg: "var(--paper-2)", fg: "var(--ink-mute)" };
  const s = normalizeScore(score);
  if (s >= 3.65) return { letter: "A", bg: "var(--good)", fg: "white" };
  if (s >= 3.0) return { letter: "B", bg: "var(--sky-deep)", fg: "var(--ink)" };
  if (s >= 2.3) return { letter: "C", bg: "var(--warn)", fg: "var(--ink)" };
  if (s >= 1.0) return { letter: "D", bg: "#ea580c", fg: "white" };
  return { letter: "F", bg: "var(--bad)", fg: "white" };
}

function score10(score: number | null): string {
  if (score === null) return "—";
  return (normalizeScore(score) * 2).toFixed(1);
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

export default async function LandlordBuildingsPage({ params }: Props) {
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
    redirect(cityPath(`/landlord/${correctSlug}/buildings`, city));
  }

  const buildings = await loadLandlordBuildingList(correctSlug, city);
  if (buildings.length === 0) {
    notFound();
  }

  const isAltMetro = city === "chicago" || city === "miami" || city === "houston";
  const sorted = [...buildings].sort(
    (a, b) => (a.overall_score ?? Infinity) - (b.overall_score ?? Infinity)
  );
  const displayName = cachedStats.name;

  const breadcrumbs = cityBreadcrumbs(
    city,
    { label: "Landlords", href: cityPath("/landlords", city) },
    { label: displayName, href: cityPath(`/landlord/${correctSlug}`, city) },
    { label: "Buildings", href: cityPath(`/landlord/${correctSlug}/buildings`, city) },
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
            All {buildings.length.toLocaleString()} buildings.
          </h1>
          <p
            style={{
              fontFamily: "var(--sans)",
              fontSize: "var(--f-16)",
              color: "var(--ink-soft)",
              margin: 0,
            }}
          >
            {displayName} · {CITY_META[city].fullName} · sorted by score (worst first)
          </p>
        </div>

        <div
          style={{
            background: "var(--paper)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            overflow: "hidden",
            margin: "var(--s-5) 0 var(--s-9)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "auto 2.2fr 1fr 1fr 1fr 1fr 48px",
              gap: 12,
              padding: "10px 18px",
              background: "var(--paper-2)",
              borderBottom: "1px solid var(--border)",
              fontFamily: "var(--mono)",
              fontSize: 10,
              color: "var(--ink-mute)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              fontWeight: 700,
            }}
          >
            <span>Grade</span>
            <span>Building</span>
            <span>Units</span>
            <span>Violations</span>
            <span>Complaints</span>
            <span>Score</span>
            <span></span>
          </div>
          {sorted.map((b) => {
            const g = gradeFor(b.overall_score);
            const violations = isAltMetro ? (b.dob_violation_count ?? 0) : (b.violation_count ?? 0);
            return (
              <Link
                key={b.id}
                href={buildingUrl({ borough: b.borough ?? "unknown", slug: b.slug ?? "" }, city)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 2.2fr 1fr 1fr 1fr 1fr 48px",
                  gap: 12,
                  padding: "12px 18px",
                  borderBottom: "1px solid var(--border)",
                  alignItems: "center",
                  color: "inherit",
                  textDecoration: "none",
                }}
              >
                <span
                  style={{
                    width: 28,
                    height: 32,
                    borderRadius: 6,
                    display: "grid",
                    placeItems: "center",
                    fontFamily: "var(--serif)",
                    fontSize: 15,
                    fontWeight: 500,
                    background: g.bg,
                    color: g.fg,
                  }}
                >
                  {g.letter}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: "var(--sans)",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--ink)",
                      letterSpacing: "-0.005em",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {b.full_address.split(",")[0] ?? b.full_address}
                  </div>
                  <small
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: 10,
                      color: "var(--ink-mute)",
                      letterSpacing: "0.02em",
                    }}
                  >
                    {b.borough ?? "—"}
                    {b.year_built ? ` · built ${b.year_built}` : ""}
                  </small>
                </div>
                <span style={numStyle(false)}>{b.total_units?.toLocaleString() ?? "—"}</span>
                <span style={numStyle(violations >= 100)}>{violations.toLocaleString()}</span>
                <span style={numStyle((b.complaint_count ?? 0) >= 100)}>
                  {(b.complaint_count ?? 0).toLocaleString()}
                </span>
                <span style={numStyle(false)}>{score10(b.overall_score)} / 10</span>
                <span style={{ color: "var(--ink-mute)", textAlign: "right" }}>›</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function numStyle(warn: boolean): React.CSSProperties {
  return {
    fontFamily: "var(--mono)",
    fontSize: 13,
    fontWeight: 600,
    color: warn ? "var(--bad)" : "var(--ink-soft)",
  };
}

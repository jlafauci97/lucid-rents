import Link from "next/link";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { LucidIQBadge } from "./LucidIQBadge";
import type { Building } from "@/types";
import type { BuildingV2Data } from "@/app/[city]/building/[borough]/[slug]/v2/_data";
import { landlordUrl, regionSlug } from "@/lib/seo";
import type { City } from "@/lib/cities";
import { CITY_META } from "@/lib/cities";

interface Props {
  building: Building;
  rents: BuildingV2Data["rents"];
  reviews: BuildingV2Data["reviews"];
  landlord: BuildingV2Data["landlord"];
  city: City;
  cityPrefix: string;
  borough: string;
  slug: string;
  grade: string;
}

function formatRentRange(rents: BuildingV2Data["rents"]["current"]): string {
  if (!rents.length) return "—";
  const mins = rents.map((r) => r.min_rent).filter((n): n is number => n != null);
  const maxs = rents.map((r) => r.max_rent).filter((n): n is number => n != null);
  if (!mins.length && !maxs.length) return "—";
  const lo = mins.length ? Math.min(...mins) : null;
  const hi = maxs.length ? Math.max(...maxs) : null;
  const fmt = (n: number) => `$${n.toLocaleString()}`;
  if (lo && hi) return `${fmt(lo)} – ${fmt(hi)}/mo`;
  if (lo) return `From ${fmt(lo)}/mo`;
  if (hi) return `Up to ${fmt(hi)}/mo`;
  return "—";
}

function MetaItem({ value, label }: { value: string | number | null | undefined; label: string }) {
  if (value == null || value === "") return null;
  return (
    <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
      <span style={{ color: "var(--v2-ink-mute)" }}>·</span>
      <span>{label} {value}</span>
    </span>
  );
}

export function HeroV2({ building, rents, reviews, landlord, city, cityPrefix, borough, slug, grade }: Props) {
  const rentRange = formatRentRange(rents.current);
  const hasHistoric = rents.historic.length > 0;
  const reviewUrl = `/${cityPrefix}/building/${regionSlug(borough)}/${slug}/review`;
  const landlordLink = landlord.name ? landlordUrl(landlord.name, city) : null;

  const breadcrumbs = [
    { label: "Home", href: "/" },
    { label: CITY_META[city].name, href: `/${cityPrefix}` },
    { label: building.borough, href: `/${cityPrefix}/neighborhoods` },
    { label: building.full_address, href: `/${cityPrefix}/building/${regionSlug(borough)}/${slug}` },
  ];

  // 4 rating axes — building doesn't have per-category scores yet, show dashes
  const ratingAxes = [
    { label: "Rent Fairness", value: null },
    { label: "Livability", value: null },
    { label: "Landlord", value: null },
    { label: "Protections", value: null },
  ];

  const overallScore = building.overall_score ?? 0;
  const isTopTier = overallScore >= 80;
  const regionLabel = CITY_META[city].regionLabel;

  return (
    <section
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 340px",
        gap: 32,
        alignItems: "start",
        paddingBottom: 32,
      }}
    >
      {/* ── Left column ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Breadcrumbs */}
        <Breadcrumbs items={breadcrumbs} variant="light" />

        {/* Building name */}
        <h1
          style={{
            fontFamily: "var(--v2-serif)",
            fontSize: "clamp(32px, 4vw, 52px)",
            fontWeight: 700,
            color: "var(--v2-ink)",
            margin: 0,
            lineHeight: 1.15,
          }}
        >
          {building.name && !/^\d/.test(building.name.trim()) ? building.name : building.full_address}
        </h1>

        {/* Address (if we showed the building name above) */}
        {building.name && !/^\d/.test(building.name.trim()) && (
          <p
            style={{
              fontFamily: "var(--v2-sans)",
              fontSize: 16,
              color: "var(--v2-ink-soft)",
              margin: 0,
            }}
          >
            {building.full_address}
          </p>
        )}

        {/* Meta line */}
        <div
          style={{
            fontFamily: "var(--v2-mono)",
            fontSize: 12,
            color: "var(--v2-ink-mute)",
            display: "flex",
            flexWrap: "wrap",
            gap: 4,
            alignItems: "center",
          }}
        >
          {building.year_built && <span>Built {building.year_built}</span>}
          <MetaItem value={building.num_floors} label="floors" />
          <MetaItem value={building.total_units} label="units" />
          {building.bbl && (
            <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <span style={{ color: "var(--v2-ink-mute)" }}>·</span>
              <span>BBL {building.bbl}</span>
            </span>
          )}
        </div>

        {/* Leasing card */}
        <div
          style={{
            border: "1px solid var(--v2-border)",
            borderRadius: "var(--v2-radius)",
            padding: "20px 24px",
            background: "var(--v2-surface)",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "var(--v2-mono)",
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--v2-ink-mute)",
                marginBottom: 6,
              }}
            >
              Current rent range
            </div>
            <div
              style={{
                fontFamily: "var(--v2-serif)",
                fontSize: 28,
                fontWeight: 700,
                color: "var(--v2-ink)",
                lineHeight: 1,
              }}
            >
              {rentRange}
            </div>
            {hasHistoric && (
              <div
                style={{
                  fontFamily: "var(--v2-sans)",
                  fontSize: 12,
                  color: "var(--v2-ink-mute)",
                  marginTop: 4,
                }}
              >
                Based on recent listings · Historic data available below
              </div>
            )}
          </div>
          <Link
            href={reviewUrl}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 20px",
              borderRadius: "var(--v2-radius-chip)",
              background: "var(--v2-brand)",
              color: "#fff",
              fontFamily: "var(--v2-sans)",
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
              alignSelf: "flex-start",
              transition: "background 0.15s",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Leave a review
          </Link>
        </div>

        {/* Trust row */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            alignItems: "center",
          }}
        >
          {/* Star rating */}
          {reviews.total > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  fontFamily: "var(--v2-serif)",
                  fontSize: 16,
                  fontWeight: 700,
                  color: "var(--v2-ink)",
                }}
              >
                {reviews.avgRating.toFixed(1)}
              </span>
              <span style={{ color: "#facc15", fontSize: 14 }}>★★★★★</span>
              <span
                style={{
                  fontFamily: "var(--v2-sans)",
                  fontSize: 13,
                  color: "var(--v2-ink-mute)",
                }}
              >
                ({reviews.total} review{reviews.total !== 1 ? "s" : ""})
              </span>
            </div>
          )}

          {/* Landlord chip */}
          {landlord.name && landlordLink && (
            <Link
              href={landlordLink}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 12px",
                borderRadius: "var(--v2-radius-chip)",
                border: "1px solid var(--v2-border)",
                background: "var(--v2-paper-2)",
                color: "var(--v2-ink-soft)",
                fontFamily: "var(--v2-sans)",
                fontSize: 12,
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="9" width="18" height="12" rx="1"/><path d="M9 21V9"/><path d="M15 21V9"/><path d="M3 9l9-6 9 6"/>
              </svg>
              {landlord.name}
              {landlord.portfolioSize > 0 && (
                <span style={{ color: "var(--v2-ink-mute)" }}>
                  · {landlord.portfolioSize} building{landlord.portfolioSize !== 1 ? "s" : ""}
                </span>
              )}
            </Link>
          )}
        </div>
      </div>

      {/* ── Right column: verdict card ── */}
      <div
        style={{
          background: "var(--v2-navy)",
          borderRadius: "var(--v2-radius)",
          padding: "28px 24px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
          color: "#fff",
        }}
      >
        <div
          style={{
            fontFamily: "var(--v2-mono)",
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "rgba(255,255,255,0.5)",
          }}
        >
          The verdict
        </div>

        <LucidIQBadge grade={grade} rating={reviews.avgRating} size={180} />

        {isTopTier && (
          <div
            style={{
              fontFamily: "var(--v2-sans)",
              fontSize: 13,
              color: "rgba(255,255,255,0.65)",
              textAlign: "center",
            }}
          >
            Top 20% in {building.borough}
          </div>
        )}

        {/* Rating axes */}
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
          {ratingAxes.map((axis) => (
            <div
              key={axis.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontFamily: "var(--v2-sans)",
                fontSize: 13,
              }}
            >
              <span style={{ color: "rgba(255,255,255,0.75)", flexShrink: 0 }}>
                {axis.label}
              </span>
              {/* Dotted fill */}
              <span
                style={{
                  flex: 1,
                  borderBottom: "1px dashed rgba(255,255,255,0.2)",
                  margin: "0 4px",
                  minWidth: 20,
                }}
              />
              <span
                style={{
                  color: "rgba(255,255,255,0.45)",
                  fontFamily: "var(--v2-mono)",
                  fontSize: 12,
                  flexShrink: 0,
                }}
              >
                {axis.value != null ? (axis.value as number).toFixed(1) : "—"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

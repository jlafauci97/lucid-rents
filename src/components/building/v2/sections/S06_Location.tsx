"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { neighborhoodUrl, neighborhoodsUrl } from "@/lib/seo";
import type { Building } from "@/types";
import type { City } from "@/lib/cities";

// LazyBuildingMap is a client component that requires lat/lon/address.
// We import it dynamically so SSR doesn't try to execute Leaflet.
const LazyBuildingMap = dynamic(
  () =>
    import("@/components/building/LazyBuildingMap").then(
      (m) => m.LazyBuildingMap
    ),
  { ssr: false, loading: () => <MapPlaceholder /> }
);

function MapPlaceholder() {
  return (
    <div
      style={{
        height: 300,
        borderRadius: "var(--v2-radius-sm)",
        border: "1px solid var(--v2-border)",
        background: "var(--v2-paper)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span
        style={{
          fontFamily: "var(--v2-mono)",
          fontSize: 12,
          color: "var(--v2-ink-mute)",
        }}
      >
        Loading map…
      </span>
    </div>
  );
}

// ── Score ring ────────────────────────────────────────────────────────────────

function ScoreRing({
  score,
  label,
}: {
  score: number | null | undefined;
  label: string;
}) {
  const val = score ?? null;
  // Circumference for r=15.9 ≈ 99.9
  const CIRC = 99.9;
  const dasharray = val !== null ? `${(val / 100) * CIRC} ${CIRC}` : "0 100";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column" as const,
        alignItems: "center",
        gap: 6,
        flex: "1 1 80px",
      }}
    >
      <div style={{ position: "relative", width: 64, height: 64 }}>
        <svg
          viewBox="0 0 36 36"
          width="64"
          height="64"
          style={{ display: "block" }}
        >
          {/* Track */}
          <circle
            cx="18"
            cy="18"
            r="15.9"
            fill="none"
            stroke="var(--v2-border)"
            strokeWidth="3"
          />
          {/* Progress */}
          {val !== null && (
            <circle
              cx="18"
              cy="18"
              r="15.9"
              fill="none"
              stroke="var(--v2-brand)"
              strokeWidth="3"
              strokeDasharray={dasharray}
              strokeDashoffset="25"
              transform="rotate(-90 18 18)"
              strokeLinecap="round"
            />
          )}
        </svg>
        {/* Score number centered in ring */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontFamily: "var(--v2-serif)",
              fontSize: val !== null ? 14 : 16,
              fontWeight: 700,
              color: "var(--v2-ink)",
              lineHeight: 1,
            }}
          >
            {val !== null ? val : "—"}
          </span>
        </div>
      </div>
      <span
        style={{
          fontFamily: "var(--v2-mono)",
          fontSize: 11,
          color: "var(--v2-ink-mute)",
          textTransform: "uppercase" as const,
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </span>
    </div>
  );
}

// ── S06: Main export ──────────────────────────────────────────────────────────

interface Props {
  building: Building;
  city: City;
}

export function S06_Location({ building, city }: Props) {
  // Building type uses community_area (Chicago), super_neighborhood (Houston),
  // or borough as the neighborhood display name — pick first truthy one.
  const neighborhoodName =
    building.community_area ??
    building.super_neighborhood ??
    building.borough ??
    "Neighborhood";
  const nbUrl = neighborhoodUrl(building.zip_code ?? "", city);
  const allNbUrl = neighborhoodsUrl(city);

  const hasCoords =
    building.latitude !== null && building.longitude !== null;

  // Walk/transit/bike scores — not on the Building type yet; show — if absent
  const walkScore = (building as Record<string, unknown>).walk_score as
    | number
    | null
    | undefined;
  const transitScore = (building as Record<string, unknown>).transit_score as
    | number
    | null
    | undefined;
  const bikeScore = (building as Record<string, unknown>).bike_score as
    | number
    | null
    | undefined;

  return (
    <section
      id="location"
      style={{
        paddingTop: 80,
        borderTop: "1px dashed var(--v2-border)",
        marginTop: 40,
      }}
    >
      {/* Section header */}
      <div style={{ marginBottom: 28 }}>
        <div
          style={{
            fontFamily: "var(--v2-mono)",
            fontSize: 11,
            textTransform: "uppercase" as const,
            letterSpacing: "0.1em",
            color: "var(--v2-ink-mute)",
            marginBottom: 8,
          }}
        >
          06 · Location
        </div>
        <h2
          style={{
            fontFamily: "var(--v2-serif)",
            fontSize: "clamp(24px, 3vw, 32px)",
            fontWeight: 700,
            color: "var(--v2-ink)",
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          Location &amp; daily life
        </h2>
      </div>

      {/* 2-column layout: map | neighborhood card */}
      <style>{`
        .s06-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 20px;
        }
        @media (max-width: 699px) {
          .s06-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="s06-grid">
        {/* Left: map */}
        <div>
          {hasCoords ? (
            <LazyBuildingMap
              latitude={building.latitude as number}
              longitude={building.longitude as number}
              address={building.full_address}
            />
          ) : (
            <div
              style={{
                height: 300,
                borderRadius: "var(--v2-radius-sm)",
                border: "1px solid var(--v2-border)",
                background: "var(--v2-paper)",
                display: "flex",
                flexDirection: "column" as const,
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--v2-ink-faint)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span
                style={{
                  fontFamily: "var(--v2-mono)",
                  fontSize: 12,
                  color: "var(--v2-ink-mute)",
                }}
              >
                Location coordinates not available
              </span>
            </div>
          )}
        </div>

        {/* Right: neighborhood card */}
        <div
          style={{
            background: "linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)",
            border: "1px solid rgba(59,130,246,0.15)",
            borderRadius: "var(--v2-radius-sm)",
            padding: "28px",
            display: "flex",
            flexDirection: "column" as const,
            justifyContent: "space-between",
            gap: 20,
            minHeight: 220,
          }}
        >
          <div>
            {/* Eyebrow */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontFamily: "var(--v2-mono)",
                fontSize: 11,
                textTransform: "uppercase" as const,
                letterSpacing: "0.08em",
                color: "#1e40af",
                marginBottom: 8,
              }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              The neighborhood
            </div>

            {/* Neighborhood name */}
            <div
              style={{
                fontFamily: "var(--v2-serif)",
                fontSize: "clamp(22px, 2.5vw, 28px)",
                fontWeight: 700,
                color: "#1e3a8a",
                marginBottom: 10,
                lineHeight: 1.2,
              }}
            >
              {neighborhoodName}
            </div>

            {/* Description */}
            <p
              style={{
                fontFamily: "var(--v2-sans)",
                fontSize: 14,
                color: "#1e40af",
                margin: 0,
                lineHeight: 1.6,
                opacity: 0.85,
              }}
            >
              Explore the neighborhood&apos;s schools, transit, and amenities.
            </p>
          </div>

          {/* CTAs */}
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
            <Link
              href={nbUrl}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontFamily: "var(--v2-sans)",
                fontSize: 14,
                fontWeight: 600,
                color: "#1e40af",
                textDecoration: "none",
              }}
            >
              Explore {neighborhoodName}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
            <Link
              href={allNbUrl}
              style={{
                fontFamily: "var(--v2-mono)",
                fontSize: 11,
                color: "#3b82f6",
                textDecoration: "none",
              }}
            >
              Browse all neighborhoods →
            </Link>
          </div>
        </div>
      </div>

      {/* Walk · Transit · Bike score strip */}
      <div
        style={{
          background: "var(--v2-paper)",
          border: "1px solid var(--v2-border)",
          borderRadius: "var(--v2-radius-sm)",
          padding: "24px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-around",
          gap: 16,
          flexWrap: "wrap" as const,
        }}
      >
        <ScoreRing score={walkScore} label="Walk" />

        {/* Divider */}
        <div
          style={{
            width: 1,
            height: 48,
            background: "var(--v2-border)",
            flexShrink: 0,
          }}
        />

        <ScoreRing score={transitScore} label="Transit" />

        <div
          style={{
            width: 1,
            height: 48,
            background: "var(--v2-border)",
            flexShrink: 0,
          }}
        />

        <ScoreRing score={bikeScore} label="Bike" />

        {walkScore == null && transitScore == null && bikeScore == null && (
          <p
            style={{
              fontFamily: "var(--v2-mono)",
              fontSize: 11,
              color: "var(--v2-ink-mute)",
              margin: 0,
              textAlign: "center" as const,
            }}
          >
            Walk Score data not yet available for this building.
          </p>
        )}
      </div>
    </section>
  );
}

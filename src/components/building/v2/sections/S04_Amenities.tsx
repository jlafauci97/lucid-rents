import {
  categorizeAmenity,
  AMENITY_CATEGORIES,
  type AmenityCategory,
} from "@/lib/building/amenity-categories";
import type { BuildingV2Data } from "@/app/[city]/building/[borough]/[slug]/v2/_data";

interface Props {
  amenities: BuildingV2Data["amenities"];
}

// ── Display metadata per category ────────────────────────────────────────────

const CATEGORY_META: Record<
  AmenityCategory,
  { label: string; bg: string; color: string; icon: React.ReactNode }
> = {
  "in-home": {
    label: "In-Home",
    bg: "rgba(219,234,254,0.6)",
    color: "#1d4ed8",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="13" r="6" />
        <rect x="5" y="2" width="14" height="20" rx="2" />
      </svg>
    ),
  },
  "building-services": {
    label: "Building Services",
    bg: "rgba(224,231,255,0.6)",
    color: "#4338ca",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="4" y="2" width="16" height="20" rx="2" />
        <path d="M9 22v-6h6v6" />
      </svg>
    ),
  },
  fitness: {
    label: "Fitness",
    bg: "rgba(237,233,254,0.6)",
    color: "#7c3aed",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M6.5 6.5l11 11M6.5 17.5l11-11M3 9v6M21 9v6" />
      </svg>
    ),
  },
  outdoor: {
    label: "Outdoor",
    bg: "rgba(209,250,229,0.6)",
    color: "#059669",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M17 14l3-3m-3 3a5 5 0 1 1-5-5 5 5 0 0 1 5 5z" />
        <path d="M13 22V8M9 22v-7M5 22V11" />
      </svg>
    ),
  },
  "transit-parking": {
    label: "Parking & Bikes",
    bg: "rgba(219,234,254,0.6)",
    color: "#0369a1",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="7" cy="17" r="2" />
        <circle cx="17" cy="17" r="2" />
        <path d="M5 17H3V7a2 2 0 0 1 2-2h10l4 4v8h-2" />
      </svg>
    ),
  },
  pets: {
    label: "Pet Friendly",
    bg: "rgba(254,243,199,0.6)",
    color: "#b45309",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="4" r="2" />
        <circle cx="18" cy="8" r="2" />
        <circle cx="20" cy="16" r="2" />
        <circle cx="9" cy="10" r="2" />
        <path d="M9 15a4 4 0 0 0-4 4c0 2 2 3 4 3s4-1 4-3a4 4 0 0 0-4-4z" />
      </svg>
    ),
  },
  community: {
    label: "Community",
    bg: "rgba(219,234,254,0.5)",
    color: "#1e40af",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  security: {
    label: "Security",
    bg: "rgba(254,226,226,0.6)",
    color: "#b91c1c",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 22s-8-4.5-8-12V5l8-3 8 3v5c0 7.5-8 12-8 12z" />
      </svg>
    ),
  },
  other: {
    label: "Other",
    bg: "rgba(241,245,249,0.8)",
    color: "#64748b",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  },
};

// ── Category card ─────────────────────────────────────────────────────────────

function AmenityCategoryCard({
  cat,
  items,
}: {
  cat: AmenityCategory;
  items: string[];
}) {
  const meta = CATEGORY_META[cat];
  const MAX_VISIBLE = 5;
  const visible = items.slice(0, MAX_VISIBLE);
  const overflow = items.length - MAX_VISIBLE;

  return (
    <div
      style={{
        background: meta.bg,
        border: "1px solid rgba(0,0,0,0.07)",
        borderRadius: "var(--v2-radius-sm)",
        padding: "20px",
        display: "flex",
        flexDirection: "column" as const,
        gap: 12,
      }}
    >
      {/* Card header: icon + category name */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          color: meta.color,
        }}
      >
        {meta.icon}
        <span
          style={{
            fontFamily: "var(--v2-serif)",
            fontSize: 16,
            fontWeight: 700,
            color: meta.color,
            lineHeight: 1.2,
          }}
        >
          {meta.label}
        </span>
      </div>

      {/* Amenity list */}
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "flex",
          flexDirection: "column" as const,
          gap: 6,
        }}
      >
        {visible.map((item) => (
          <li
            key={item}
            style={{
              fontFamily: "var(--v2-sans)",
              fontSize: 13,
              color: "var(--v2-ink-soft)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: meta.color,
                flexShrink: 0,
                opacity: 0.6,
              }}
            />
            {item}
          </li>
        ))}
        {overflow > 0 && (
          <li
            style={{
              fontFamily: "var(--v2-mono)",
              fontSize: 11,
              color: "var(--v2-ink-mute)",
              paddingLeft: 11,
            }}
          >
            +{overflow} more
          </li>
        )}
      </ul>
    </div>
  );
}

// ── S04: Main export ──────────────────────────────────────────────────────────

export function S04_Amenities({ amenities }: Props) {
  // Group by category, preserving AMENITY_CATEGORIES order
  const grouped = new Map<AmenityCategory, string[]>();
  for (const a of amenities) {
    const cat = categorizeAmenity(a.amenity);
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(a.amenity);
  }

  // Ordered categories that actually have items
  const orderedCategories = AMENITY_CATEGORIES.filter((cat) => grouped.has(cat));

  return (
    <section
      id="amenities"
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
          04 · Amenities
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 12,
            flexWrap: "wrap" as const,
          }}
        >
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
            Building amenities
          </h2>
          {amenities.length > 0 && (
            <span
              style={{
                fontFamily: "var(--v2-mono)",
                fontSize: 12,
                color: "var(--v2-ink-mute)",
                background: "var(--v2-paper)",
                border: "1px solid var(--v2-border)",
                borderRadius: "var(--v2-radius-chip)",
                padding: "3px 10px",
              }}
            >
              {amenities.length} amenities
            </span>
          )}
        </div>
      </div>

      {amenities.length === 0 ? (
        /* Empty state */
        <div
          style={{
            background: "var(--v2-paper)",
            border: "1px solid var(--v2-border)",
            borderRadius: "var(--v2-radius-sm)",
            padding: "40px 24px",
            textAlign: "center" as const,
          }}
        >
          <p
            style={{
              fontFamily: "var(--v2-sans)",
              fontSize: 14,
              color: "var(--v2-ink-mute)",
              margin: 0,
            }}
          >
            Amenities not yet catalogued for this building.
          </p>
        </div>
      ) : (
        <>
          {/* Category grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: 16,
              marginBottom: 16,
            }}
          >
            {orderedCategories.map((cat) => (
              <AmenityCategoryCard
                key={cat}
                cat={cat}
                items={grouped.get(cat) ?? []}
              />
            ))}
          </div>

          {/* Footer note */}
          <p
            style={{
              fontFamily: "var(--v2-mono)",
              fontSize: 11,
              color: "var(--v2-ink-mute)",
              margin: 0,
            }}
          >
            Based on listing data and verified tenant reports.
          </p>
        </>
      )}
    </section>
  );
}

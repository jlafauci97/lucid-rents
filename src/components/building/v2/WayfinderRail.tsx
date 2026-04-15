import Link from "next/link";
import { LucidIQBadge } from "./LucidIQBadge";

interface Props {
  grade: string;
  rating: number;
  buildingName: string;
  reviewsUrl: string;
}

const WAY_ITEMS = [
  {
    id: "rent",
    label: "Rental intelligence",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    ),
  },
  {
    id: "issues",
    label: "Violations, 311, & more",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
  },
  {
    id: "reviews",
    label: "Tenant Reviews",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  {
    id: "amenities",
    label: "Amenities",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
  },
  {
    id: "landlord",
    label: "Landlord",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="9" width="18" height="12" rx="1"/><path d="M9 21V9"/><path d="M15 21V9"/><path d="M3 9l9-6 9 6"/>
      </svg>
    ),
  },
  {
    id: "location",
    label: "Location",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
      </svg>
    ),
  },
  {
    id: "history",
    label: "History",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
  },
  {
    id: "similar",
    label: "Similar buildings",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      </svg>
    ),
  },
  {
    id: "faq",
    label: "FAQ",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
  },
];

export function WayfinderRail({ grade, rating, buildingName, reviewsUrl }: Props) {
  return (
    <>
      {/* Inline media query to hide below 900px */}
      <style>{`
        .v2-wayfinder-rail {
          display: flex;
          flex-direction: column;
          gap: 0;
          width: 220px;
          flex-shrink: 0;
          position: sticky;
          top: 84px;
          align-self: flex-start;
          height: fit-content;
        }
        @media (max-width: 899px) {
          .v2-wayfinder-rail {
            display: none !important;
          }
        }
      `}</style>

      <aside className="v2-wayfinder-rail">
        {/* Top card: badge + building name */}
        <div
          style={{
            background: "var(--v2-surface)",
            border: "1px solid var(--v2-border)",
            borderRadius: "var(--v2-radius)",
            padding: "20px 16px 16px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
            marginBottom: 8,
          }}
        >
          <LucidIQBadge grade={grade} rating={rating} size={80} />
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontFamily: "var(--v2-mono)",
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--v2-ink-mute)",
                marginBottom: 4,
              }}
            >
              LucidIQ Score
            </div>
            <div
              style={{
                fontFamily: "var(--v2-serif)",
                fontSize: 15,
                fontWeight: 700,
                color: "var(--v2-ink)",
                lineHeight: 1.3,
                textAlign: "center",
                wordBreak: "break-word",
              }}
            >
              {buildingName}
            </div>
          </div>
        </div>

        {/* Wayfinder links */}
        <nav
          aria-label="Page sections"
          style={{
            background: "var(--v2-surface)",
            border: "1px solid var(--v2-border)",
            borderRadius: "var(--v2-radius)",
            padding: "8px 0",
            marginBottom: 8,
          }}
        >
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {WAY_ITEMS.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 16px",
                    color: "var(--v2-ink-soft)",
                    fontFamily: "var(--v2-sans)",
                    fontSize: 13,
                    fontWeight: 500,
                    textDecoration: "none",
                    borderRadius: 0,
                    transition: "background 0.1s, color 0.1s",
                  }}
                >
                  <span style={{ color: "var(--v2-brand)", flexShrink: 0 }}>{item.icon}</span>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Tools row */}
        <div
          style={{
            background: "var(--v2-surface)",
            border: "1px solid var(--v2-border)",
            borderRadius: "var(--v2-radius)",
            padding: "12px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", gap: 8 }}>
            <button
              disabled
              aria-label="Save building (coming soon)"
              style={{
                flex: 1,
                padding: "8px 0",
                borderRadius: "var(--v2-radius-sm)",
                border: "1px solid var(--v2-border)",
                background: "var(--v2-paper-2)",
                color: "var(--v2-ink-mute)",
                fontFamily: "var(--v2-sans)",
                fontSize: 12,
                fontWeight: 500,
                cursor: "not-allowed",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
              </svg>
              Save
            </button>
            <button
              disabled
              aria-label="Share building (coming soon)"
              style={{
                flex: 1,
                padding: "8px 0",
                borderRadius: "var(--v2-radius-sm)",
                border: "1px solid var(--v2-border)",
                background: "var(--v2-paper-2)",
                color: "var(--v2-ink-mute)",
                fontFamily: "var(--v2-sans)",
                fontSize: 12,
                fontWeight: 500,
                cursor: "not-allowed",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
              Share
            </button>
          </div>
          <Link
            href={reviewsUrl}
            aria-label="Write a review for this building"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "9px 0",
              borderRadius: "var(--v2-radius-sm)",
              background: "var(--v2-brand)",
              color: "#fff",
              fontFamily: "var(--v2-sans)",
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
              transition: "background 0.15s",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Write a review
          </Link>
        </div>
      </aside>
    </>
  );
}

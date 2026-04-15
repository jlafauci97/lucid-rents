import Link from "next/link";
import { CITY_META, type City } from "@/lib/cities";
import { NavV2CityPicker } from "./NavV2.CityPicker";
import { NavV2Search } from "./NavV2.Search";

interface Props {
  city: City;
}

const NAV_LINKS = [
  {
    label: "Rankings",
    href: (prefix: string) => `/${prefix}/worst-rated-buildings`,
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
  },
  {
    label: "Landlords",
    href: (prefix: string) => `/${prefix}/landlords`,
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="9" width="18" height="12" rx="1"/><path d="M9 21V9"/><path d="M15 21V9"/><path d="M3 9l9-6 9 6"/>
      </svg>
    ),
  },
  {
    label: "Neighborhoods",
    href: (prefix: string) => `/${prefix}/neighborhoods`,
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="3 11 12 2 21 11 21 21 3 21"/><line x1="9" y1="21" x2="9" y2="12"/><line x1="15" y1="21" x2="15" y2="12"/>
      </svg>
    ),
  },
  {
    label: "Tenant Tools",
    href: () => "/tenant-tools",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
      </svg>
    ),
  },
  {
    label: "Guides",
    href: () => "/guides",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
      </svg>
    ),
  },
];

export function NavV2({ city }: Props) {
  const cityPrefix = CITY_META[city].urlPrefix;

  return (
    <nav
      aria-label="Site navigation"
      style={{
        background: "var(--v2-navy)",
        color: "#fff",
        position: "sticky",
        top: 0,
        zIndex: 50,
        width: "100%",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div
        style={{
          maxWidth: 1440,
          margin: "0 auto",
          padding: "0 24px",
          height: 60,
          display: "flex",
          alignItems: "center",
          gap: 20,
        }}
      >
        {/* Brand */}
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            textDecoration: "none",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "var(--v2-brand)",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: "var(--v2-sans)",
              fontWeight: 700,
              fontSize: 16,
              color: "#fff",
              letterSpacing: "-0.02em",
            }}
          >
            lucidrents
          </span>
        </Link>

        {/* City picker */}
        <NavV2CityPicker currentCity={city} />

        {/* Search */}
        <NavV2Search city={city} />

        {/* Nav links */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            flexShrink: 0,
          }}
        >
          {NAV_LINKS.map((link) => {
            const hideMobile = !["Rankings", "Landlords"].includes(link.label);
            return (
              <Link
                key={link.label}
                href={link.href(cityPrefix)}
                className={hideMobile ? "v2-nav-link-hide-mobile" : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "6px 10px",
                  borderRadius: "var(--v2-radius-sm)",
                  color: "rgba(255,255,255,0.75)",
                  fontFamily: "var(--v2-sans)",
                  fontSize: 13,
                  fontWeight: 500,
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                  transition: "color 0.15s, background 0.15s",
                }}
              >
                {link.icon}
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* Login */}
        <Link
          href="/login"
          style={{
            marginLeft: "auto",
            flexShrink: 0,
            fontFamily: "var(--v2-sans)",
            fontSize: 13,
            fontWeight: 500,
            color: "rgba(255,255,255,0.75)",
            textDecoration: "none",
            padding: "6px 12px",
            borderRadius: "var(--v2-radius-chip)",
            border: "1px solid rgba(255,255,255,0.2)",
          }}
        >
          Log in
        </Link>
      </div>
    </nav>
  );
}

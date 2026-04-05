import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
  },
  redirects: async () => [
    {
      source: "/dashboard/:path*",
      destination: "/profile/:path*",
      permanent: true,
    },
    {
      source: "/dashboard",
      destination: "/profile",
      permanent: true,
    },
  ],
  rewrites: async () => ({
    beforeFiles: [
      { source: "/sitemap.xml", destination: "/api/sitemap-xml" },
      { source: "/sitemap-index.xml", destination: "/api/sitemap-xml" },
      { source: "/sitemap/:id.xml", destination: "/api/sitemap-xml/:id" },
    ],
  }),
  headers: async () => [
    // Allow embed pages to be iframed by any domain
    {
      source: "/embed/:path*",
      headers: [
        { key: "X-Frame-Options", value: "ALLOWALL" },
        { key: "Content-Security-Policy", value: "frame-ancestors *" },
      ],
    },
    {
      source: "/(.*)",
      headers: [
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=(self)",
        },
      ],
    },
    // Cache static sitemaps (regenerated at build time)
    {
      source: "/sitemap/:path*",
      headers: [
        { key: "Cache-Control", value: "public, max-age=86400, s-maxage=86400" },
        { key: "Content-Type", value: "application/xml" },
      ],
    },
    // Cache static assets aggressively (fonts, images, JS/CSS bundles)
    {
      source: "/fonts/:path*",
      headers: [
        { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
      ],
    },
    {
      source: "/_next/static/:path*",
      headers: [
        { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
      ],
    },
    // Cache API responses that power client-side components
    {
      source: "/api/transit/:path*",
      headers: [
        { key: "Cache-Control", value: "public, s-maxage=3600, stale-while-revalidate=86400" },
      ],
    },
    {
      source: "/api/schools/:path*",
      headers: [
        { key: "Cache-Control", value: "public, s-maxage=3600, stale-while-revalidate=86400" },
      ],
    },
    {
      source: "/api/crime/:path*",
      headers: [
        { key: "Cache-Control", value: "public, s-maxage=3600, stale-while-revalidate=86400" },
      ],
    },
    {
      source: "/api/recreation/:path*",
      headers: [
        { key: "Cache-Control", value: "public, s-maxage=3600, stale-while-revalidate=86400" },
      ],
    },
    {
      source: "/api/buildings/:path*/trends",
      headers: [
        { key: "Cache-Control", value: "public, s-maxage=3600, stale-while-revalidate=86400" },
      ],
    },
    // Cache search, rankings, and map API responses
    {
      source: "/api/search",
      headers: [
        { key: "Cache-Control", value: "public, s-maxage=300, stale-while-revalidate=3600" },
      ],
    },
    {
      source: "/api/rankings",
      headers: [
        { key: "Cache-Control", value: "public, s-maxage=600, stale-while-revalidate=3600" },
      ],
    },
    {
      source: "/api/map/:path*",
      headers: [
        { key: "Cache-Control", value: "public, s-maxage=300, stale-while-revalidate=1800" },
      ],
    },
    {
      source: "/api/activity",
      headers: [
        { key: "Cache-Control", value: "public, s-maxage=300, stale-while-revalidate=1800" },
      ],
    },
  ],
};

export default nextConfig;

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
      // Sitemap index: /sitemap.xml → static pre-generated file
      { source: "/sitemap.xml", destination: "/sitemap/index.xml" },
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
  ],
};

export default nextConfig;

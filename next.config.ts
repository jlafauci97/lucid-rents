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
      // Sitemap index: /sitemap.xml → API route
      { source: "/sitemap.xml", destination: "/api/sitemap-index" },
      // Individual sitemaps: /sitemap/0.xml → API route (pass id with .xml suffix, stripped in handler)
      { source: "/sitemap/:id.xml", destination: "/api/sitemap/:id" },
    ],
  }),
  headers: async () => [
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

import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "loremflickr.com" },
    ],
  },
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "framer-motion",
      "date-fns",
    ],
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
    // /map was a page-level redirect() to /crime — a temporary 307 that Next
    // 16 streaming also degrades to <meta refresh>. Static config redirects
    // give a real 308 with no page involved. One entry per live city prefix
    // (the [city] prefixes span one and two path segments, so no single
    // pattern covers them).
    ...["nyc", "CA/Los-Angeles", "IL/Chicago"].map((prefix) => ({
      source: `/${prefix}/map`,
      destination: `/${prefix}/crime`,
      permanent: true,
    })),
  ],
  rewrites: async () => ({
    beforeFiles: [
      // All sitemap XML is generated nightly into Vercel Blob (see
      // src/lib/sitemap/generator.ts + scripts/generate-sitemaps-blob.mts) and
      // served by src/app/sitemap-v2/[chunk]. These rewrites keep every public
      // sitemap URL Google already knows, now backed by Blob.
      { source: "/sitemap.xml", destination: "/sitemap-v2/index.xml" },
      { source: "/sitemap-buildings.xml", destination: "/sitemap-v2/buildings.xml" },
      // Fresh alias for the building index. The original /sitemap-buildings.xml
      // got stuck in Google's per-URL error state after repeated failed fetches
      // during earlier deploys; this clean URL (no failure history) lets Google
      // fetch the identical file without that backoff. Submit this one in GSC.
      { source: "/buildings-sitemap.xml", destination: "/sitemap-v2/buildings.xml" },
      { source: "/sitemap-landlords.xml", destination: "/sitemap-v2/landlords.xml" },
      // Hubs sitemap is DYNAMIC (ISR) so newly published articles auto-appear
      // within the hour — the index lists /sitemap/hubs.xml, and this rewrite
      // MUST stay above the generic /sitemap/:chunk rule so the dynamic route
      // wins over the nightly Blob copy.
      { source: "/sitemap/hubs.xml", destination: "/sitemap-hubs.xml" },
      // Chunk URLs (/sitemap/b-N.xml, /sitemap/l-N.xml, /sitemap/0.xml, ...)
      // — the shape referenced by index.xml and known to Google since the
      // static-file era.
      { source: "/sitemap/:chunk", destination: "/sitemap-v2/:chunk" },
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
        // Force HTTPS for 1 year, include subdomains, eligible for browser preload list.
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains; preload",
        },
        // Block cross-origin window access (Spectre/cross-origin info leaks).
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        // CSP in report-only mode first — flip to Content-Security-Policy after
        // reviewing reports to confirm GA, AdSense, Vercel scripts all parse.
        {
          key: "Content-Security-Policy-Report-Only",
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://pagead2.googlesyndication.com https://*.googlesyndication.com https://fundingchoicesmessages.google.com https://*.google.com https://vercel.live https://va.vercel-scripts.com https://www.clarity.ms https://*.clarity.ms",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "img-src 'self' data: blob: https:",
            "font-src 'self' data: https://fonts.gstatic.com",
            "connect-src 'self' https://*.supabase.co https://www.google-analytics.com https://*.googlesyndication.com https://vitals.vercel-insights.com https://vercel.live wss://*.supabase.co https://*.clarity.ms",
            "frame-src 'self' https://googleads.g.doubleclick.net https://*.googlesyndication.com https://www.youtube.com https://www.youtube-nocookie.com https://vercel.live https://ep2.adtrafficquality.google https://www.google.com",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'self'",
            "require-trusted-types-for 'script'",
            // NOTE: re-add "upgrade-insecure-requests" when flipping this
            // policy from report-only to enforcing — the directive is ignored
            // in report-only mode and just logs a console error on every page.
          ].join("; "),
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
    {
      source: "/leaflet/:path*",
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
    // Public building reads — same building looks the same for every visitor.
    {
      source: "/api/buildings/:path*/reviews",
      headers: [
        { key: "Cache-Control", value: "public, s-maxage=600, stale-while-revalidate=3600" },
      ],
    },
    {
      source: "/api/buildings/:path*/violations",
      headers: [
        { key: "Cache-Control", value: "public, s-maxage=1800, stale-while-revalidate=86400" },
      ],
    },
    {
      source: "/api/buildings/nearby",
      headers: [
        { key: "Cache-Control", value: "public, s-maxage=3600, stale-while-revalidate=86400" },
      ],
    },
    {
      source: "/api/encampments/nearby",
      headers: [
        { key: "Cache-Control", value: "public, s-maxage=3600, stale-while-revalidate=86400" },
      ],
    },
    {
      source: "/api/hazards/:path*",
      headers: [
        { key: "Cache-Control", value: "public, s-maxage=3600, stale-while-revalidate=86400" },
      ],
    },
    {
      source: "/api/flood-zones/:path*",
      headers: [
        { key: "Cache-Control", value: "public, s-maxage=86400, stale-while-revalidate=604800" },
      ],
    },
    {
      source: "/api/landlords",
      headers: [
        { key: "Cache-Control", value: "public, s-maxage=600, stale-while-revalidate=3600" },
      ],
    },
    {
      source: "/api/landlords/:path*",
      headers: [
        { key: "Cache-Control", value: "public, s-maxage=600, stale-while-revalidate=3600" },
      ],
    },
    {
      source: "/api/rent-timing-calculator",
      headers: [
        { key: "Cache-Control", value: "public, s-maxage=86400, stale-while-revalidate=604800" },
      ],
    },
    {
      source: "/api/violations/recent",
      headers: [
        { key: "Cache-Control", value: "public, s-maxage=300, stale-while-revalidate=600" },
      ],
    },
  ],
};

export default withWorkflow(nextConfig);

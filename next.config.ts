import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
  },
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
  ],
};

export default nextConfig;

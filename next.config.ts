import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@remotion/renderer", "@remotion/compositor-darwin-arm64", "@remotion/compositor-darwin-x64", "@remotion/compositor-linux-x64-gnu", "@remotion/compositor-linux-x64-musl", "@remotion/compositor-linux-arm64-gnu", "@remotion/compositor-linux-arm64-musl", "@remotion/compositor-win32-x64-msvc"],
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

export default withWorkflow(nextConfig);

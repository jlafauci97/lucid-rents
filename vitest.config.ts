import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    css: false,
    include: [
      "tests/**/*.{test,spec}.{ts,tsx}",
      "src/**/__tests__/**/*.{test,spec}.{ts,tsx}",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Mirror supabase/functions/import_map.json so edge-function modules
      // can be unit-tested via vitest without Deno's runtime resolver.
      "shared/": `${path.resolve(__dirname, "./supabase/functions/_shared")}/`,
    },
  },
});

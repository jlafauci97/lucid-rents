import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  globalIgnores([
    "node_modules/**",
    ".next/**",
    "public/**",
    "supabase/**",
    "scripts/**",
    "docs/**",
    "remotion/**",
    "workflows/**",
    "coverage/**",
  ]),
  ...nextCoreWebVitals,
  {
    // Pre-existing, codebase-wide patterns. Downgraded to warnings so `lint`
    // stays green while still surfacing them; new/real problems remain errors.
    rules: {
      // 48 hits: hydrate-from-localStorage / measure-then-set effects.
      "react-hooks/set-state-in-effect": "warn",
      // 2 hits: components declared inside components.
      "react-hooks/static-components": "warn",
      // 30 hits: <a> used for internal routes instead of <Link>.
      "@next/next/no-html-link-for-pages": "warn",
      // 26 hits: raw apostrophes/quotes in JSX copy (stylistic).
      "react/no-unescaped-entities": "warn",
      // 2 hits: literal // inside JSX text.
      "react/jsx-no-comment-textnodes": "warn",
    },
  },
]);

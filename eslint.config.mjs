import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "public/quran/**", "vendor/**", "next-env.d.ts", ".wrangler/**"]),
  {
    rules: {
      // Strict separation: the static export must never import Pages Functions code.
      "no-restricted-imports": ["error", { patterns: [{ group: ["**/functions/**"], message: "Pages Functions are not part of the static export." }] }],
    },
  },
]);

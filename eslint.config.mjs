import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Untracked frontend / docs in backend-only repository:
    "src/app/admin/**",
    "src/app/login/**",
    "src/app/change-pin/**",
    "src/components/**",
    "docs/**",
    "notes.md",
  ]),
]);

export default eslintConfig;

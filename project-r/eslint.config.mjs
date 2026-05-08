import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Note: `eslint-config-next/core-web-vitals` bundles `eslint-plugin-jsx-a11y` (verified with @16.2.6).
// Do NOT register jsx-a11y separately (causes ConfigError: "Cannot redefine plugin jsx-a11y").
// ⚠️ On Next.js upgrade: Verify jsx-a11y is still bundled via `npx eslint --debug | grep jsx-a11y`
// See: Story 1.13 (CI configuration for version verification).
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
  ]),
]);

export default eslintConfig;

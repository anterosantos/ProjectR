import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: [path.resolve(__dirname, "./vitest.setup.ts")],
    include: ["__tests__/**/*.{test,spec}.{ts,tsx}", "src/**/*.{test,spec}.{ts,tsx}"],
    // passWithNoTests: true in dev (fast iteration), false in CI (Story 1.13)
    // See AGENTS.md: Running Tests section
    passWithNoTests: !process.env.CI,
    coverage: {
      provider: "v8",
      reportOnFailure: true,
      include: ["src/**"],
      exclude: ["src/**/*.test.*", "src/**/*.spec.*", "src/**/*.d.ts"],
      thresholds: {
        "src/lib/outbox/**": {
          statements: 80,
          branches: 80,
          functions: 80,
          lines: 80,
        },
        "src/lib/uuid.ts": {
          statements: 80,
          branches: 80,
          functions: 80,
          lines: 80,
        },
        // src/lib/readiness/** — threshold deferred until directory has content (Story 5.x)
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

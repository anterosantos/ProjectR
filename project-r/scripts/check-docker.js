#!/usr/bin/env node

/**
 * Pre-dev hook: Verify Docker Desktop is running before starting dev server
 * Used by: npm run predev (called via "predev" in package.json)
 * Story: 1.2 (Code Review, Patch #13)
 * Cross-platform version (Windows, macOS, Linux)
 */

const { execSync } = require("child_process");

try {
  execSync("docker info", { stdio: "pipe" });
  console.log("✅ Docker is running. Ready to start dev server.");
  process.exit(0);
} catch (error) {
  console.error("❌ Docker Desktop is not running.");
  console.error("");
  console.error("Local development requires Docker for the Supabase stack.");
  console.error("Please start Docker Desktop and try again.");
  console.error("");
  console.error("   macOS/Windows: Open the Docker Desktop application");
  console.error("   Linux: Run 'systemctl start docker' or equivalent");
  console.error("");
  process.exit(1);
}

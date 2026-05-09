#!/bin/bash
# Pre-dev hook: Verify Docker Desktop is running before starting dev server
# Used by: npm run predev (called via "predev" in package.json)
# Story: 1.2 (Code Review, Patch #13)

if ! docker info > /dev/null 2>&1; then
  echo "❌ Docker Desktop is not running."
  echo ""
  echo "Local development requires Docker for the Supabase stack."
  echo "Please start Docker Desktop and try again."
  echo ""
  echo "   macOS/Windows: Open the Docker Desktop application"
  echo "   Linux: Run 'systemctl start docker' or equivalent"
  echo ""
  exit 1
fi

echo "✅ Docker is running. Ready to start dev server."

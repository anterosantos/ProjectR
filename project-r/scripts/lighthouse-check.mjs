#!/usr/bin/env node
// Local wrapper for Lighthouse CI. Uses .lighthouserc.json in project-r/.
// In CI, npx lhci autorun is called directly from the workflow.
// Local usage: npm run lighthouse

import { execSync } from 'child_process';

try {
  execSync('npx lhci autorun', { stdio: 'inherit' });
} catch {
  process.exit(1);
}

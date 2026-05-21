#!/usr/bin/env node
// Bundle size guard — fails with exit 1 if initial JS > 200 KB gzipado.
// Uses only Node.js built-ins. Run after `npm run build`.

import { readFileSync } from 'fs';
import { gzipSync } from 'zlib';
import { join, resolve } from 'path';

const LIMIT_BYTES = 200 * 1024; // 200 KB
const NEXT_DIR = resolve(process.cwd(), '.next');

let manifest;
try {
  manifest = JSON.parse(readFileSync(join(NEXT_DIR, 'build-manifest.json'), 'utf8'));
} catch {
  console.error('❌ .next/build-manifest.json not found. Run `npm run build` first.');
  process.exit(1);
}

const initialFiles = new Set(manifest.rootMainFiles ?? []);
if (initialFiles.size === 0) {
  console.error('❌ rootMainFiles is empty in build-manifest.json — unexpected build output.');
  process.exit(1);
}

let totalGzip = 0;
for (const relativePath of initialFiles) {
  if (!relativePath.endsWith('.js')) continue;
  const filePath = join(NEXT_DIR, relativePath);
  try {
    const content = readFileSync(filePath);
    const compressed = gzipSync(content, { level: 9 });
    totalGzip += compressed.length;
    console.log(`  ${relativePath}: ${(compressed.length / 1024).toFixed(1)} KB gz`);
  } catch {
    // Chunk absent in this build (e.g. client-only chunk skipped in SSR build)
  }
}

const totalKB = (totalGzip / 1024).toFixed(1);
console.log(`\nTotal Initial JS: ${totalKB} KB gzipado (limite: 200 KB)`);

if (totalGzip > LIMIT_BYTES) {
  console.error(`❌ Bundle size excede 200 KB: ${totalKB} KB`);
  process.exit(1);
}
console.log(`✅ Bundle size OK: ${totalKB} KB ≤ 200 KB`);

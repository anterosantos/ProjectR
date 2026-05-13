/** @type {import('next').NextConfig} */
const nextConfig = {
  // Webpack (not Turbopack) is required for Serwist PWA service worker compatibility.
  // See: architecture.md#L180 and Story 1.11 (PWA initialization).
  // The --webpack flag in package.json dev script enforces this constraint.
};

export default nextConfig;
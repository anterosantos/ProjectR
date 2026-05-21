import withSerwistInit from '@serwist/next'

// Serwist generates the service worker bundle (public/sw.js) during next build.
// If compilation fails, the build will fail. No manual verification needed.
const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === 'development',
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Webpack (not Turbopack) is required for Serwist PWA service worker compatibility.
  // See: architecture.md#L180 and Story 1.11 (PWA initialization).
  // The --webpack flag in package.json dev script enforces this constraint.
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/sign/**",
      },
    ],
  },
}

export default withSerwist(nextConfig)

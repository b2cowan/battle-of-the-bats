import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 16.3's `next dev` auto-appends a managed block to AGENTS.md when it detects an AI coding
  // agent. Ours is a governed, hand-authored convention document (its content already points
  // agents at node_modules/next/dist/docs/), so silent framework appends are drift by definition.
  agentRules: false,
  // Next's own build-time TypeScript check is a second, memory-heavy full-project typecheck on
  // top of webpack compilation - and it's redundant with the `npx tsc --noEmit` the /release
  // pre-flight already runs locally before every push. Skipping it here removes that duplicate
  // memory spike from the Amplify build; type safety is still gated, just before the push instead
  // of during it.
  typescript: {
    ignoreBuildErrors: true,
  },
  // Amplify's build machine is a fixed 8GB, and this app's webpack production build was
  // OOM-killing the build worker even at a 7GB Node heap. Webpack's persistent filesystem
  // cache (serializing the whole compiled module graph to .next/cache after every build)
  // is the likely spike: it holds the old and new graphs in memory at once to write it.
  // Disabling it for production trades some build speed for actually finishing the build.
  webpack(config, { dev }) {
    if (!dev) config.cache = false;
    return config;
  },
  async redirects() {
    return [
      // Redirect .com to .ca (canonical domain)
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'fieldlogichq.com' }],
        destination: 'https://www.fieldlogichq.ca/:path*',
        permanent: true,
      },
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.fieldlogichq.com' }],
        destination: 'https://www.fieldlogichq.ca/:path*',
        permanent: true,
      },
      // One canonical host (owner ruling 2026-08-08, finalized the same day after the live matrix
      // passed): the .ca apex forwards PERMANENTLY to www so sessions, cookies-set-with-redirects
      // and search all live on ONE address. Stripe's LIVE webhook was repointed to www BEFORE this
      // shipped (webhook deliveries do not follow redirects).
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'fieldlogichq.ca' }],
        destination: 'https://www.fieldlogichq.ca/:path*',
        permanent: true,
      },
      // Legacy path redirects (pre-multi-tenancy)
      { source: '/schedule',     destination: '/milton-bats/schedule',     permanent: true },
      { source: '/results',      destination: '/milton-bats/results',      permanent: true },
      { source: '/register',     destination: '/milton-bats/register',     permanent: true },
      { source: '/rules',        destination: '/milton-bats/rules',        permanent: true },
      { source: '/news',         destination: '/milton-bats/news',         permanent: true },
      { source: '/teams',        destination: '/milton-bats/teams',        permanent: true },
      { source: '/teams/:id',    destination: '/milton-bats/teams/:id',    permanent: true },
      { source: '/admin/:path*', destination: '/milton-bats/admin/:path*', permanent: true },
    ];
  },
};

export default nextConfig;

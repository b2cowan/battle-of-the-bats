import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // sharp is a Next.js *default* external server package, but under the Turbopack
  // production build + pnpm's non-hoisted node_modules its plain-JS runtime dep
  // detect-libc was NOT traced into the deployed Lambda — so `import sharp` threw
  // "Cannot find module 'detect-libc'" at module load and 500'd every route importing
  // it (tournament branding, logo upload, PWA icon routes). Force just detect-libc into
  // the output file trace. We deliberately do NOT include the @img/* native packages:
  // Amplify's compute bundler already ships those, and globbing them recreates a pnpm
  // symlink Amplify already made → "EEXIST … @img/sharp-libvips-linux-x64" build failure.
  outputFileTracingIncludes: {
    '/**': [
      './node_modules/detect-libc/**/*',
    ],
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

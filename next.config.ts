import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
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

import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";
import { OWN_HOST_PATTERN } from "./lib/own-hosts";

// This PC's own LAN addresses (e.g. 192.168.2.200), read at startup so a new DHCP lease needs only
// a dev-server restart, never an edit here.
function ownLanAddresses(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((a) => !!a && a.family === "IPv4" && !a.internal)
    .map((a) => a!.address);
}

// `has` clause limiting a redirect to the hosts that are ours (see lib/own-hosts.ts).
const ownHost = [{ type: 'host' as const, value: OWN_HOST_PATTERN }];

const nextConfig: NextConfig = {
  // Phone testing against `npm run dev` (owner, 2026-10-09). Next 16 answers 403 to its dev-only
  // scripts and the hot-reload socket for any origin but localhost, so a page opened on a phone at
  // http://<this PC's LAN IP>:3000 rendered its first server frame and never came alive - the sign-in
  // screen sat on "CHECKING SESSION..." forever, and every button everywhere was dead. Dev-only:
  // production never reads this.
  allowedDevOrigins: ownLanAddresses(),
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
  // Security headers on every response (owner, 2026-10-19, found while answering "can a club mask our address?").
  // Production sent neither: any site could show our admin and coach screens inside its own frame and trick a signed-in
  // user into clicking them (clickjacking), and browsers were never told to stay on HTTPS. frame-ancestors 'self' is the
  // modern rule and X-Frame-Options the older browsers' copy; same-origin frames (the dev email preview) still work. A
  // club's own domain (Club Tier 4e) serves its pages as 'self' too. HSTS stays on THIS host only: includeSubDomains
  // would also force HTTPS on any subdomain we have not audited (an email link-tracking host, say), and preload is a
  // commitment that is hard to undo, so neither is set. Pinned by tests/unit/security-headers.test.ts.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000' },
        ],
      },
    ];
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
      // Legacy path redirects (pre-multi-tenancy). Our own hosts ONLY (Club Tier 4e): a club's own web address
      // (www.lakeshorelynx.ca) is not ours, and there /teams is THAT club's Teams page - proven live, these sent it
      // to another club's. A host that is not listed is by definition a club's, so the list is the safe side to keep.
      { source: '/schedule',     has: ownHost, destination: '/milton-bats/schedule',     permanent: true },
      { source: '/results',      has: ownHost, destination: '/milton-bats/results',      permanent: true },
      { source: '/register',     has: ownHost, destination: '/milton-bats/register',     permanent: true },
      { source: '/rules',        has: ownHost, destination: '/milton-bats/rules',        permanent: true },
      { source: '/news',         has: ownHost, destination: '/milton-bats/news',         permanent: true },
      { source: '/teams',        has: ownHost, destination: '/milton-bats/teams',        permanent: true },
      { source: '/teams/:id',    has: ownHost, destination: '/milton-bats/teams/:id',    permanent: true },
      { source: '/admin/:path*', has: ownHost, destination: '/milton-bats/admin/:path*', permanent: true },
      // Run a tournament's step 1 moved to /start/tournament when its intro page folded into it (The first look, Ask 6,
      // 2026-10-19). An old /auth/signup link forwards there before any render, its query (the pricing page's plan and
      // billing) passed through; `?account=1` is the account-only sign-up and stays. Not permanent: the address still
      // serves account-only, so no browser should learn to skip it.
      { source: '/auth/signup', missing: [{ type: 'query', key: 'account', value: '1' }], destination: '/start/tournament', permanent: false },
      // The four pre-rename product pages (/platform/accounting, /house-league, /rep-teams, /tournaments) were retired in
      // The public face, warm: S4 (owner, 2026-10-23): nothing linked to them, they were out of the sitemap, and the warm
      // marketing set would have left them dark under a warm bar. An old bookmark or search result lands on the home page.
      { source: '/platform/:page(accounting|house-league|rep-teams|tournaments)', destination: '/', permanent: true },
    ];
  },
};

export default nextConfig;

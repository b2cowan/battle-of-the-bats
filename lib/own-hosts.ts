/**
 * Which hosts are OURS (Club Tier Stage 4e).
 *
 * Until a club can connect its own web address, every host this app answered on was ours, so nothing
 * had to ask. Now a request can arrive on `www.lakeshorelynx.ca`, and a handful of rules differ there:
 * the legacy `/teams`-style shortcuts must not send a club's visitor to another club, and robots.txt
 * and the sitemap must name the address they were served on.
 *
 * Pure on purpose (no `server-only`, no env): `next.config.ts` imports the pattern, the proxy and
 * tests import the predicate. A host that is not ours is, by elimination, a club's own address - the
 * known-club check (and its cache) belongs to the proxy, not here.
 *
 * ⚠ This is NOT the email trust rule. `isTrustedAppOrigin` in `lib/app-origin.ts` guards links that
 * carry a live one-time token and deliberately stays narrower; do not widen it from this list.
 */

/** Regex source (matched whole, case-insensitive host, port already stripped) for every host that is ours. */
export const OWN_HOST_PATTERN =
  '(?:' +
  [
    '(?:[a-z0-9-]+\\.)*fieldlogichq\\.(?:ca|com)', // the platform, its subdomains (dev., sites.) and the .com twin
    '(?:[a-z0-9-]+\\.)*amplifyapp\\.com', // Amplify's own preview addresses
    'localhost',
    '(?:\\d{1,3}\\.){3}\\d{1,3}', // an IP address - phone testing on the LAN; a club can never be one
  ].join('|') +
  ')';

const OWN_HOST = new RegExp(`^${OWN_HOST_PATTERN}$`);

/** The host of a request without its port, lowercased - the same reduction Next applies before `has: host`. */
export function bareHost(host: string | null | undefined): string {
  return (host ?? '').split(':', 1)[0].trim().toLowerCase();
}

/** Is this one of OUR hosts (as opposed to a club's own web address)? An empty host is treated as ours. */
export function isOwnHost(host: string | null | undefined): boolean {
  const h = bareHost(host);
  return h === '' || OWN_HOST.test(h);
}

/**
 * The origin to write into an absolute address for a request that arrived on `host`: the configured
 * site address on our own hosts, the host itself (always https) on a club's own address.
 */
export function siteOriginForHost(host: string | null | undefined, configuredSiteUrl: string): string {
  return isOwnHost(host) ? configuredSiteUrl : `https://${bareHost(host)}`;
}

/**
 * lib/reserved-slugs.ts
 *
 * An organization's slug is the first URL segment (`/{orgSlug}/…`), so it must
 * never equal a top-level app route — otherwise the static route wins and the
 * org's own pages become unreachable at their URL. This blocklist is checked at
 * every org-creation entry point (create / league-create / signup) and by the
 * auto-slug generator, so neither a hand-typed slug nor an auto-derived one can
 * land on a reserved word.
 *
 * Keep in sync with the top-level segments under `app/` (dirs + the consumer
 * shell routes in `lib/consumer-routes.ts`). It's checked at creation time only —
 * it never affects an org that already exists.
 *
 * Slugs are validated to `^[a-z0-9]+(?:-[a-z0-9]+)*$` (lowercase, hyphens, no dots)
 * before reaching here, so dotted asset paths (robots.txt, sitemap.xml, favicon.ico,
 * manifest.json) can't be slugs and don't need listing.
 */
export const RESERVED_ORG_SLUGS: ReadonlySet<string> = new Set([
  // Consumer shell + logged-out front door
  'discover', 'scores', 'chat', 'following', 'account',
  // Auth / entry / workspace switcher
  'auth', 'home', 'start', 'my', 'login', 'logout', 'signup', 'onboarding',
  // Platform / admin / API
  'admin', 'api', 'platform', 'platform-admin', 'dashboard', 'dev',
  // Role shells & tournament sub-surfaces that also exist at the top level
  'coaches', 'coach', 'team', 'teams', 'official', 'scorekeeper', 'check-in',
  'news', 'results', 'rules', 'schedule', 'standings', 'tryout-response', 'tryout-score',
  // Marketing / content
  'pricing', 'blog', 'changelog', 'about', 'contact', 'support', 'help', 'legal',
  'privacy', 'terms', 'unsubscribe',
  'for-tournament-organizers', 'for-leagues', 'for-clubs', 'for-coaches',
  // Framework / asset paths that must never be shadowed
  'icons', 'favicon', 'manifest', 'sw', 'offline', 'robots', 'sitemap',
  'static', 'public', '_next', 'assets', 'images', 'fonts',
]);

/** True when `slug` collides with a top-level app route and must not be assigned. */
export function isReservedOrgSlug(slug: string): boolean {
  return RESERVED_ORG_SLUGS.has(slug.trim().toLowerCase());
}

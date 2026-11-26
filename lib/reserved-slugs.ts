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
  'discover', 'scores', 'chat', 'following', 'account', 'family',
  // Auth / entry / workspace switcher
  'auth', 'home', 'start', 'my', 'login', 'logout', 'signup', 'onboarding',
  // Platform / admin / API
  'admin', 'api', 'platform', 'platform-admin', 'dashboard', 'dev',
  // Role shells & tournament sub-surfaces that also exist at the top level
  'coaches', 'coach', 'team', 'teams', 'official', 'scorekeeper', 'check-in',
  // 'tryout-response' stays reserved though its route was retired (family decision emails
  // removed, owner 2026-08-26) — a path that used to be public must not become claimable.
  'news', 'results', 'rules', 'schedule', 'standings', 'tryout-response', 'tryout-score',
  // Marketing / content
  'pricing', 'blog', 'changelog', 'about', 'contact', 'support', 'help', 'legal',
  'privacy', 'terms', 'data-terms', 'subprocessors', 'security', 'unsubscribe', 'second-parent-stop', 'invitation-stop',
  'for-tournament-organizers', 'for-leagues', 'for-clubs', 'for-coaches',
  // The retired demo doors (owner 2026-11-25). Their addresses still redirect to /pricing (next.config),
  // so an org holding either slug would be shadowed by the redirect and lose every page it owns.
  'see-it-live', 'demos',
  // Framework / asset paths that must never be shadowed
  'icons', 'favicon', 'manifest', 'sw', 'offline', 'robots', 'sitemap',
  'static', 'public', '_next', 'assets', 'images', 'fonts',
]);

/**
 * The two retired public demo clubs (owner 2026-11-25, "Both public demos are RETIRED"; Decision D3 of
 * docs/projects/active/RETIRE_PUBLIC_DEMOS_PLAN.md). They are NOT routes, so they are kept apart from the set
 * above, which other code reads as "a real top-level route". Old links, QR codes and cached pages still point at
 * `/riverdale-minor-ball/…` and `/riverdale-ridge/…`: a real club that signed up under one of these names would
 * receive a stranger's traffic labelled as a demo. Never assignable, and disallowed in robots.txt.
 */
export const RETIRED_DEMO_ORG_SLUGS: readonly string[] = ['riverdale-minor-ball', 'riverdale-ridge'];

/** True when `slug` collides with a top-level app route, or is a retired demo club's name, and must not be assigned. */
export function isReservedOrgSlug(slug: string): boolean {
  const normalized = slug.trim().toLowerCase();
  return RESERVED_ORG_SLUGS.has(normalized) || RETIRED_DEMO_ORG_SLUGS.includes(normalized);
}

/**
 * lib/consumer-routes.ts
 *
 * The logged-out "consumer shell" front door (unified-app Phase 1): the directory
 * plus its sibling tabs, wrapped in one app-like shell (top bar + mobile bottom nav)
 * instead of the marketing Navbar/Footer. Single source of truth so the shell layout,
 * SiteChrome, and Footer all agree on which routes are consumer-shell routes.
 */
import { RESERVED_ORG_SLUGS } from './reserved-slugs';

// NOTE: this is the pref-gated consumer-shell set — it drives the shell layout, the
// marketing Navbar/Footer suppression, the warm nav skin, AND the theme-color tint.
// /auth is included (design_decisions 2026-07-23): once warm became the platform default,
// the sign-in family staying dark was a jarring island — auth now follows the user theme
// exactly like the tabs (its pages wear the warmTab surface via app/(consumer)/auth/layout.tsx).
// This supersedes the R1-4 "auth stays dark" carve-out. /start is not a tab but DOES paint
// warm: see WARM_JOURNEY_PREFIXES below, kept separate so the warm skin can extend to the
// coach sign-up journey without entangling footer/Navbar classification.
export const CONSUMER_SHELL_PREFIXES = ['/discover', '/scores', '/chat', '/following', '/account', '/auth'] as const;

export function isConsumerShellPath(pathname: string): boolean {
  return CONSUMER_SHELL_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'));
}

// Warm sign-up JOURNEY routes (Founding Season Coaches launch — design_decisions S1-1/S1-2):
// the coach get-started + Premium sign-up journey wears the warm ConsumerNav skin so it reads
// as one app, but these are NOT consumer-shell tabs (they stay out of CONSUMER_SHELL_PREFIXES).
// /start lives inside the (consumer) group so the nav already mounts; /coaches/start and the
// post-provision success screen (/coaches/welcome) mount the same warm nav via their own layout.
export const WARM_JOURNEY_PREFIXES = ['/start', '/coaches/start', '/coaches/claim', '/coaches/welcome'] as const;

export function isWarmJourneyPath(pathname: string): boolean {
  return WARM_JOURNEY_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'));
}

/** Routes that paint the warm ConsumerNav skin: the four consumer tabs + the warm sign-up journey. */
export function isWarmSkinPath(pathname: string): boolean {
  return isConsumerShellPath(pathname) || isWarmJourneyPath(pathname);
}

// ── Tournament-chrome gate (Unified Home IA · Phase 5) ────────────────────────
// Split out of isConsumerShellPath so the persistent global bar and the branded
// event chrome (header + top tabs) can BOTH be true on /{orgSlug}/{tournamentSlug}/*.

// Static children of app/[orgSlug]/ — org-level public pages + operator shells.
// Next resolves these static segments BEFORE the dynamic [tournamentSlug], so a
// tournament slug can never occupy one; excluding them keeps the global bar off
// org pages AND off day-of ops shells (admin/coaches/scorekeeper/check-in/official/
// league) by construction. Keep in sync with the app/[orgSlug]/ directory.
const ORG_STATIC_SECTIONS = new Set([
  'admin', 'archives', 'check-in', 'coaches', 'league', 'news', 'official',
  'register', 'results', 'rules', 'schedule', 'scorekeeper', 'standings', 'teams',
]);

/**
 * Public tournament routes — `/{orgSlug}/{tournamentSlug}[/...]`. Gates the root-mounted
 * global consumer bar. (The branded event chrome — header + top tabs — gates independently
 * via useParams + OrgNavContext; this predicate is the bar's gate.)
 *
 * seg[0] is checked against RESERVED_ORG_SLUGS — the CANONICAL "can't be an org slug" list
 * (one source, reused, not a second drifting copy), so every real top-level route (/discover,
 * /platform/…, /tryout-response/…, …) is excluded; a real org slug is never
 * reserved, so it passes through to the seg[1] section check.
 *
 * The bar mount pairs this with `useParams().tournamentSlug`, and BOTH checks are needed —
 * neither subsumes the other:
 *   • seg[1] in ORG_STATIC_SECTIONS excludes org-level public pages (`/{orgSlug}/teams…`) AND
 *     every operator shell — crucially the admin PREVIEW (`/{org}/admin/tournaments/preview/
 *     [tournamentSlug]`), whose route ALSO carries a `tournamentSlug` param, so the param check
 *     alone can NOT keep the bar off it; `'admin'` in ORG_STATIC_SECTIONS is what does.
 *   • The param is truthy ONLY on a matched `[tournamentSlug]` route, so if a new static child
 *     dir is added under app/[orgSlug]/ and missed from ORG_STATIC_SECTIONS, that org page
 *     (which lacks the param) still won't mis-mount the bar.
 */
export function showsTournamentChrome(pathname: string): boolean {
  const seg = pathname.split('/').filter(Boolean);
  if (seg.length < 2) return false;                 // '/' or org home '/{orgSlug}' — out of scope
  if (RESERVED_ORG_SLUGS.has(seg[0])) return false; // seg[0] is a real top-level route, not an org
  if (ORG_STATIC_SECTIONS.has(seg[1])) return false;
  return true;
}

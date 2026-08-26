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
// /family (Chunk D) is a consumer-shell route, not a tab: it has no bottom-nav entry of
// its own, but a family surface belongs to the consumer app (the two-family ruling — no
// third shell), so it must suppress the marketing Navbar/Footer and paint warm like the
// rest of the fan experience. A family member arrives here from a link in their team's
// group chat; landing them on a marketing header would be the wrong product entirely.
export const CONSUMER_SHELL_PREFIXES = ['/discover', '/scores', '/chat', '/following', '/account', '/auth', '/family'] as const;

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

// Static children of app/[orgSlug]/, split by AUDIENCE. Next resolves these static segments
// BEFORE the dynamic [tournamentSlug], so a tournament slug can never occupy one.
//
// ONE list per audience and the union derived from them — the two predicates below read
// different halves, so a section added to the wrong half is a visible bug rather than a
// silent drift between two hand-maintained copies. Keep in sync with the app/[orgSlug]/ directory.

/** Day-of ops + operator shells. These render their own chrome and never take consumer bars. */
const ORG_OPERATOR_SECTIONS = ['admin', 'check-in', 'coaches', 'official', 'scorekeeper'] as const;

/** Fan-facing org pages — the org's own public site. */
const ORG_PUBLIC_SECTIONS = [
  'archives', 'league', 'news', 'register', 'results', 'rules', 'schedule', 'standings', 'teams',
] as const;

const ORG_OPERATOR_SECTION_SET = new Set<string>(ORG_OPERATOR_SECTIONS);
const ORG_PUBLIC_SECTION_SET = new Set<string>(ORG_PUBLIC_SECTIONS);
const ORG_STATIC_SECTIONS = new Set<string>([...ORG_OPERATOR_SECTIONS, ...ORG_PUBLIC_SECTIONS]);

/**
 * Segment a pathname and apply the "could this even be an org route?" guard, ONCE. Returns null for
 * the marketing root and for any real top-level route (seg[0] reserved), so the three predicates
 * below share one definition of that question instead of three copies that can drift apart.
 */
function orgSegments(pathname: string): string[] | null {
  const seg = pathname.split('/').filter(Boolean);
  if (seg.length === 0) return null;                 // '/' — marketing root
  if (RESERVED_ORG_SLUGS.has(seg[0])) return null;   // a real top-level route, not an org
  return seg;
}

/**
 * Public tournament routes — `/{orgSlug}/{tournamentSlug}[/...]`. Gates the root-mounted
 * global consumer bar. (The branded event chrome — header + top tabs — gates independently
 * via useParams + OrgNavContext; this predicate is the bar's gate.)
 *
 * seg[0] is checked against RESERVED_ORG_SLUGS — the CANONICAL "can't be an org slug" list
 * (one source, reused, not a second drifting copy), so every real top-level route (/discover,
 * /platform/…, /tryout-score/…, …) is excluded; a real org slug is never
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
  const seg = orgSegments(pathname);
  if (!seg || seg.length < 2) return false;         // org home '/{orgSlug}' — out of scope here
  return !ORG_STATIC_SECTIONS.has(seg[1]);
}

/**
 * An ORG's own public pages — `/{orgSlug}` and its fan-facing sections (league, teams,
 * archives, and the tournament-shim routes). Gates the PHONE bottom bar there.
 *
 * Decision D1 (owner, 2026-08-01 — "connectivity vs full parity", settled from mockups):
 * **PHONE ONLY.** Org public pages take the app's bottom bar ≤900px and nothing at all above
 * it. The gap this closes is real and was inverted against the price ladder — a free-tier
 * tournament family kept the app throughout while a League/Club family lost it the moment they
 * left Home — but the fix is deliberately asymmetric: on a phone the club still owns the top of
 * the screen (their identity row), which is the part that reads as theirs, while the bar takes
 * the bottom. Adding the desktop strip too would have sandwiched a paying club's branded page
 * between two FieldLogicHQ bars, which is what every design lens marked the parity option down
 * for. So: no strip, no second wordmark, no top-of-screen platform chrome on these pages.
 *
 * The org root has ONE segment, so it is matched by length rather than by a section name.
 * A `/{orgSlug}/{tournamentSlug}` path falls through (its segment is not a known section) —
 * `showsTournamentChrome` owns that surface and renders the fuller treatment.
 */
export function showsOrgPublicChrome(pathname: string): boolean {
  const seg = orgSegments(pathname);
  if (!seg) return false;
  if (seg.length === 1) return true;                // the org home itself
  return ORG_PUBLIC_SECTION_SET.has(seg[1]);
}

/** True on an org's operator/day-of shells (`/{orgSlug}/admin…`, `/coaches…`, `/scorekeeper…`).
 *  Exported so a caller can ask the question directly instead of re-deriving the segment list. */
export function isOrgOperatorShellPath(pathname: string): boolean {
  const seg = orgSegments(pathname);
  if (!seg || seg.length < 2) return false;
  return ORG_OPERATOR_SECTION_SET.has(seg[1]);
}

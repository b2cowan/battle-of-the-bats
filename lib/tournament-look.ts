/**
 * lib/tournament-look.ts — WHO OWNS A TOURNAMENT'S LOOK (Public tournament pages, Stage 1a; plan
 * docs/projects/active/PUBLIC_TOURNAMENT_SITE_REVIEW_PLAN.md §4a, build prompt PUBLIC_TOURNAMENT_STAGE1A_BUILD_PROMPT.md,
 * Asks 9–11 ruled 2026-10-27, the drawing's asks ruled 2026-11-02).
 *
 * ONE rule, read everywhere the new look is shown: the frame's band (lib/public-frame.ts wraps this), the admin preview,
 * the Branding page's Look card preview (from the draft — this file is pure and browser-safe), the three share images and
 * Stage 10's printable rules. Never type "the tournament's, else the club's" out again beside it.
 *
 * | Org                                          | Rule    | Own colours | → colours        | → type                  | → logo           |
 * |----------------------------------------------|---------|-------------|------------------|-------------------------|------------------|
 * | no `advanced_tournament_branding`            | —       | any         | neutral          | Classic                 | none             |
 * | carries the site module (League Plus, Club…) | default | yes         | own              | own, else the club's    | own, else club's |
 * | 〃                                            | default | no          | the club's       | the club's              | own, else club's |
 * | 〃                                            | always  | any         | the club's       | the club's              | own, else club's |
 * | branding, no site module (Tournament Plus)   | —       | yes         | own              | own, else Classic       | own only         |
 * | 〃                                            | —       | no          | plain FieldLogicHQ | own, else Classic     | own only         |
 *
 * · "Own colours" = `themePreset || themePrimary` (an explicit FieldLogicHQ pick counts).
 * · "Carries the site module" is the SHAPE question (`planCarriesModule`), not whether the site is online and not the
 *   access question: a club with its site switched off, or a cancelled one, is still a club and still has a look.
 * · The rule is applied when pages are shown and NEVER writes a tournament's saved look (Ask 9): switching back to the
 *   default restores each tournament's own.
 * · Tournament Plus has no club layer: an organization look left on its row (written once on another plan, or through
 *   org-settings) is not read, is kept, and returns on an upgrade to a plan with a public site (owner 2026-11-02).
 * · A tournament's type: null follows; any other stored value is its own pick (a stale `barlow` from the retired font list
 *   reads as Classic).
 */
import { canUseAdvancedTournamentBranding } from './tournament-branding';
import { planCarriesModule, type EntitlementOrg } from './module-entitlements';
import { clubFace } from './club-site';
import { tournamentHomeStatus } from './club-site-home';
import type { Organization, Tournament } from './types';

export type TournamentLookPolicy = 'club_default' | 'always_club';
export const TOURNAMENT_LOOK_POLICIES: ReadonlyArray<TournamentLookPolicy> = ['club_default', 'always_club'];
export const DEFAULT_TOURNAMENT_LOOK_POLICY: TournamentLookPolicy = 'club_default';

/** A stored value → a policy; anything else is the default (today's behaviour). */
export function sanitizeTournamentLookPolicy(input: unknown): TournamentLookPolicy {
  return parseTournamentLookPolicy(input) ?? DEFAULT_TOURNAMENT_LOOK_POLICY;
}

/** Strict form for a request body: null when the value is not one of the two. */
export function parseTournamentLookPolicy(input: unknown): TournamentLookPolicy | null {
  return typeof input === 'string' && (TOURNAMENT_LOOK_POLICIES as readonly string[]).includes(input)
    ? (input as TournamentLookPolicy)
    : null;
}

/**
 * What a tournament's `theme_font` may hold once the Look card writes it (Stage 1a Part 3): the club's three type looks'
 * stored values (Classic, Serif, Clean — `CLUB_LOOKS` in lib/public-site-builder.ts; a test holds the two equal). Null
 * follows the club. Classic is stored as 'system', never as null.
 */
export const TOURNAMENT_TYPE_LOOKS = ['system', 'dm-serif', 'inter'] as const;

/** The face vocabulary of the club frame's `data-club-face` (lib/club-site.ts `clubFace`): Classic, Serif, Clean. */
export type TournamentFace = ReturnType<typeof clubFace>;

export type TournamentLookSource = 'neutral' | 'own' | 'club' | 'plain';

export interface TournamentLook {
  /** Where the colours came from. `neutral` = no tournament branding on the plan; `plain` = Tournament Plus, nothing saved. */
  source: TournamentLookSource;
  preset: string | null;
  primary: string | null;
  accent: string | null;
  face: TournamentFace;
  logoUrl: string | null;
  /** The club's rule, or null when the org has no club layer. */
  policy: TournamentLookPolicy | null;
}

export type LookOrg = EntitlementOrg &
  Pick<Organization, 'themePreset' | 'themePrimary' | 'themeAccent' | 'themeFont' | 'logoUrl' | 'tournamentLookPolicy'>;
export type LookTournament = Pick<Tournament, 'themePreset' | 'themePrimary' | 'themeAccent' | 'themeFont' | 'logoUrl'>;

/** Does the tournament carry colours of its own? The one definition (the question before *Always* asks the same). */
export function hasOwnTournamentColours(t: Pick<Tournament, 'themePreset' | 'themePrimary'> | null | undefined): boolean {
  return !!(t?.themePreset || t?.themePrimary);
}

/** Does this org have a club layer for its tournaments' look (the site module on its plan)? */
export function hasClubTournamentLook(org: EntitlementOrg): boolean {
  return planCarriesModule(org, 'module_public_site');
}

const CLASSIC: TournamentFace = 'warm';

export function resolveTournamentLook(org: LookOrg, tournament?: LookTournament | null): TournamentLook {
  if (!canUseAdvancedTournamentBranding(org)) {
    return { source: 'neutral', preset: 'platform', primary: null, accent: null, face: CLASSIC, logoUrl: null, policy: null };
  }
  const own = hasOwnTournamentColours(tournament);
  const ownFace = tournament?.themeFont ? clubFace(tournament.themeFont) : null;

  if (!hasClubTournamentLook(org)) {
    return {
      source: own ? 'own' : 'plain',
      preset: own ? tournament!.themePreset ?? null : 'platform',
      primary: own ? tournament!.themePrimary ?? null : null,
      accent: own ? tournament!.themeAccent ?? null : null,
      face: ownFace ?? CLASSIC,
      logoUrl: tournament?.logoUrl ?? null,
      policy: null,
    };
  }

  const policy = sanitizeTournamentLookPolicy(org.tournamentLookPolicy);
  const clubFaceOf = clubFace(org.themeFont);
  const logoUrl = tournament?.logoUrl ?? org.logoUrl ?? null;
  if (own && policy === 'club_default') {
    return {
      source: 'own',
      preset: tournament!.themePreset ?? null,
      primary: tournament!.themePrimary ?? null,
      accent: tournament!.themeAccent ?? null,
      face: ownFace ?? clubFaceOf,
      logoUrl,
      policy,
    };
  }
  return {
    source: 'club',
    preset: org.themePreset ?? null,
    primary: org.themePrimary ?? null,
    accent: org.themeAccent ?? null,
    face: clubFaceOf,
    logoUrl,
    policy,
  };
}

/** One tournament the question before *Always* names (the drawing's ask 2). */
export interface OwnLookTournament {
  id: string;
  name: string;
  startDate: string | null;
  /** "(on now)": the club's own state rule (lib/club-site-home.ts), so the question and the club's Tournaments tab agree. */
  live: boolean;
}

/**
 * The club's tournaments that carry colours of their own, for the question before *Always*: the ones not finished — the
 * one on now first, then by start date — and a count of the finished ones ("along with 3 finished tournaments"). A
 * tournament without own colours is never named (it already wears the club's look). A deleted tournament is gone from
 * the table, so it cannot be listed.
 */
export function tournamentsWithOwnColours(
  all: ReadonlyArray<Pick<Tournament, 'id' | 'name' | 'status' | 'startDate' | 'endDate' | 'championsCrownedAt' | 'themePreset' | 'themePrimary'>>,
  todayISO: string,
): { current: OwnLookTournament[]; finished: number } {
  const current: OwnLookTournament[] = [];
  let finished = 0;
  for (const t of all) {
    if (!hasOwnTournamentColours(t)) continue;
    const state = tournamentHomeStatus(t, todayISO, false);
    if (state === 'finished') { finished += 1; continue; }
    current.push({ id: t.id, name: t.name, startDate: t.startDate ?? null, live: state === 'live' });
  }
  current.sort((a, b) =>
    Number(b.live) - Number(a.live)
    || (a.startDate ?? '9999').localeCompare(b.startDate ?? '9999')
    || a.name.localeCompare(b.name));
  return { current, finished };
}

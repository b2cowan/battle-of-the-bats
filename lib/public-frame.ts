/**
 * lib/public-frame.ts — the public tournament pages' new frame (Public tournament pages, Stage 1; plan
 * docs/projects/active/PUBLIC_TOURNAMENT_SITE_REVIEW_PLAN.md §4 and §9, build prompt PUBLIC_TOURNAMENT_STAGE1_BUILD_PROMPT.md).
 *
 * THE FRAME — the organizer's colour band, the club site's light ground and type, the pinned white tab row — is the one
 * look of every public tournament page, the admin preview and the Look card's preview. Stage 1 built it behind a preview
 * switch (a cookie set by a preview link, on in development); Stage 8 turned it on for everyone and deleted the switch
 * (Parts 3–4b: the old halves, then the cookie, its reader and the setter route). The marker below stays: every frame
 * style is keyed to it.
 *
 * This file is the PURE half (the marker, the band, the colour roles), safe in a test and in the browser;
 * lib/public-frame-server.ts holds the server reads (the contact, the band's record facts).
 */
import { CLUB_NEAR_BLACK, clubColourRoles, hexChannels, type ClubColourRoles } from './club-colour-roles';
import { resolveTournamentLook, type LookOrg, type LookTournament, type TournamentFace, type TournamentLook } from './tournament-look';
import { TOURNAMENT_STATUS_WORD, tournamentHomeStatus } from './club-site-home';
import { formatEventDateRange } from './timezone';
import { clubInitials } from './club-site';
import type { Tournament } from './types';

/** The marker on the tournament layout's outer element. Every frame style is keyed to it. */
export const PUBLIC_FRAME_ATTR = 'data-public-frame';
export const publicFrameAttr: Record<string, string> = { [PUBLIC_FRAME_ATTR]: 'light' };


export interface PublicFrameRoles extends ClubColourRoles {
  /** No tournament branding on the plan: the neutral near-black band, no logo and no initials. */
  neutral: boolean;
}

const WHITE = '#FFFFFF';

/**
 * The band's colour, worked through the club's own roles (lib/club-colour-roles.ts): fill, text on fill, ink, edge,
 * accent as decoration only. WHICH colour is Stage 1a's one rule (lib/tournament-look.ts `resolveTournamentLook`): the
 * club's rule for its tournaments, the tournament's own, the plain FieldLogicHQ look on Tournament Plus.
 *
 * A plan without tournament branding (below Tournament Plus — `advanced_tournament_branding`; the free plan and a Premium
 * coach's event) gets a neutral near-black band with white text and no mark, which keeps the rule that a free event
 * carries no host logo or custom colour. Its FieldLogicHQ badge is unchanged.
 */
export function publicFrameRolesOf(look: TournamentLook): PublicFrameRoles {
  if (look.source === 'neutral') {
    return {
      fill: CLUB_NEAR_BLACK, onFill: WHITE, ink: CLUB_NEAR_BLACK, edge: CLUB_NEAR_BLACK, accent: CLUB_NEAR_BLACK,
      mark: WHITE, tile: WHITE, tileInk: CLUB_NEAR_BLACK, darkened: false, neutral: true,
    };
  }
  return { ...clubColourRoles(look.preset, look.primary, look.accent), neutral: false };
}

export function publicFrameRoles(org: LookOrg, tournament?: LookTournament | null): PublicFrameRoles {
  return publicFrameRolesOf(resolveTournamentLook(org, tournament));
}

/** Everything the band shows, worked out once for the live layout and the organizer's admin preview alike. */
export interface PublicFrameBand {
  roles: PublicFrameRoles;
  /** The type look (Classic, Serif, Clean), written as `data-club-face` on the frame's token element. */
  face: TournamentFace;
  /** The event's logo (lib/tournament-look.ts: the tournament's, else the club's; the tournament's only on Tournament
   *  Plus); null on a plan without tournament branding. */
  logoUrl: string | null;
  /** Initials for the tile when there is no logo; null when the plan allows no mark at all. */
  initials: string | null;
  dates: string | null;
  /** One of the four state words (Ask 8), or null when none applies. */
  status: { word: string; live: boolean } | null;
}

type BandOrg = LookOrg;
type BandTournament = LookTournament & Pick<Tournament, 'name' | 'logoUrl' | 'status' | 'startDate' | 'endDate' | 'championsCrownedAt'>;

/**
 * The band's colour (above), mark, dates and state. The state word is the club's Tournaments tab's own rule and words
 * (lib/club-site-home.ts), so the club's card and the event's band never disagree; the dates are the club's spelling,
 * with the year only when it is not this one. A plan without tournament branding carries no logo and no initials.
 */
export function publicFrameBand(
  org: BandOrg,
  tournament: BandTournament,
  todayISO: string,
  registrationOpen: boolean,
): PublicFrameBand {
  const look = resolveTournamentLook(org, tournament);
  const roles = publicFrameRolesOf(look);
  const state = tournamentHomeStatus(tournament, todayISO, registrationOpen);
  return {
    roles,
    face: look.face,
    logoUrl: look.logoUrl,
    initials: roles.neutral ? null : clubInitials(tournament.name) || null,
    dates: tournament.startDate
      ? formatEventDateRange(tournament.startDate, tournament.endDate, !tournament.startDate.startsWith(todayISO.slice(0, 4)))
      : null,
    status: state ? { word: TOURNAMENT_STATUS_WORD[state], live: state === 'live' } : null,
  };
}

/**
 * Who runs the event, as the frame says it (hub "Ask B": the desk band's right side and the footer's host line). ONE rule
 * for both, so they never disagree:
 *   · the organizer's home is a real destination (`resolveOrgHomeHref` in lib/module-entitlements.ts — the layout's own
 *     answer, never a second host test) → "Hosted by {organizer} ›", a link, in the desk band and the footer;
 *   · it is not → "Run by {organizer}", plain text, in the footer only (the band shows nothing there);
 *   · the organizer and the event share a name and there is no door → nothing (no "Run by X" under X).
 */
export type PublicFrameHost =
  | { kind: 'hosted'; name: string; href: string }
  | { kind: 'run'; name: string };

export function publicFrameHost(orgName: string, eventName: string, orgHomeHref: string | null): PublicFrameHost | null {
  if (orgHomeHref) return { kind: 'hosted', name: orgName, href: orgHomeHref };
  if (!orgName || orgName === eventName) return null;
  return { kind: 'run', name: orgName };
}

/**
 * The roles as the club frame's own variable names, so the tournament wears the club site's token block (the ONE light
 * set, components/public/ClubFrame.module.css `.tokens`) with its own colour in it. Written on <html> for the frame only,
 * which outranks the org layout's `:root` block: the app's own phone bar is mounted outside the tournament's markup and
 * reads them too.
 */
function publicFrameRoleVars(roles: PublicFrameRoles): string {
  return [
    `--club-fill: ${roles.fill}`,
    `--club-fill-rgb: ${hexChannels(roles.fill)}`,
    `--club-on-fill: ${roles.onFill}`,
    `--club-ink: ${roles.ink}`,
    `--club-ink-rgb: ${hexChannels(roles.ink)}`,
    `--club-edge: ${roles.edge}`,
    `--club-accent: ${roles.accent}`,
    `--club-mark: ${roles.mark}`,
    `--club-tile: ${roles.tile}`,
    `--club-tile-ink: ${roles.tileInk}`,
  ].join('; ');
}

/** The rule both the live layout and the admin preview write: the roles, on <html>, only while the frame is on it. */
export function publicFrameRoleCss(roles: PublicFrameRoles): string {
  return `html:has([${PUBLIC_FRAME_ATTR}="light"]) { ${publicFrameRoleVars(roles)} }`;
}

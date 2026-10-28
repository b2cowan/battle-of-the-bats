/**
 * lib/public-frame.ts — the public tournament pages' new frame (Public tournament pages, Stage 1; plan
 * docs/projects/active/PUBLIC_TOURNAMENT_SITE_REVIEW_PLAN.md §4 and §9, build prompt PUBLIC_TOURNAMENT_STAGE1_BUILD_PROMPT.md).
 *
 * THE PREVIEW SWITCH. Stage 1 builds the frame — the organizer's colour band, the club site's light ground and type, the
 * pinned white tab row — behind one switch, decided on the server before the first paint:
 *   · ON in development, so the owner sees it on dev with no step;
 *   · ON in any browser that opened the preview link (`/api/public-frame?frame=on&to=…` sets a first-party cookie), and
 *     OFF again through its twin (`frame=off`), which also turns a dev browser back to today's pages;
 *   · OFF for everyone else — every customer and the public demo see today's pages, unchanged.
 * Stage 8 turns it on for everyone, once. The precedent is the coaches portal's warm release (lib/coach-warm-preview.ts):
 * a marker on the shell, styles keyed to it, then a single public release.
 *
 * This file is the PURE half (the decision, the marker, the colour roles), safe in a test and in the browser;
 * lib/public-frame-server.ts reads the cookie. One answer serves the tournament layout, the admin preview and, when a
 * later stage asks, the share image.
 */
import { CLUB_NEAR_BLACK, clubColourRoles, hexChannels, type ClubColourRoles } from './club-colour-roles';
import { canUseAdvancedTournamentBranding } from './tournament-branding';
import type { Organization, Tournament } from './types';

/** The browser's own answer, set by the preview link and its twin. */
export const PUBLIC_FRAME_COOKIE = 'flhq_public_frame';

/** The marker on the tournament layout's outer element. Every frame style is keyed to it. */
export const PUBLIC_FRAME_ATTR = 'data-public-frame';
export const publicFrameAttr: Record<string, string> = { [PUBLIC_FRAME_ATTR]: 'light' };

/** Is the new frame on? The browser's cookie decides when it has one; otherwise on in development only. */
export function publicFrameFromCookie(value: string | null | undefined, isDevelopment: boolean): boolean {
  if (value === 'on') return true;
  if (value === 'off') return false;
  return isDevelopment;
}

/**
 * Where the preview link may send the visitor afterwards: a path on this site, never another site (`//evil`, `/\evil`
 * and a full URL are refused — an open redirect would let anyone's link wear our address).
 */
export function safePublicFrameReturn(to: string | null | undefined): string {
  if (!to || !to.startsWith('/') || to.startsWith('//') || to.startsWith('/\\')) return '/';
  return to;
}

type FrameOrg = Pick<Organization, 'planId' | 'themePreset' | 'themePrimary' | 'themeAccent'>;
type FrameTournament = Pick<Tournament, 'themePreset' | 'themePrimary' | 'themeAccent'>;

export interface PublicFrameRoles extends ClubColourRoles {
  /** No tournament branding on the plan: the neutral near-black band, no logo and no initials. */
  neutral: boolean;
}

const WHITE = '#FFFFFF';

/**
 * The band's colour, worked through the club's own roles (lib/club-colour-roles.ts): fill, text on fill, ink, edge,
 * accent as decoration only. WHICH colour is today's read rule (lib/public-tournament-theme.ts's
 * resolvePublicTournamentTheme): the tournament's own when it has one, else the organizer's. The club's rule for its
 * tournaments is Stage 1a's, not this one's.
 *
 * A plan without tournament branding (below Tournament Plus — `advanced_tournament_branding`; the free plan and a Premium
 * coach's event) gets a neutral near-black band with white text and no mark, which keeps the rule that a free event
 * carries no host logo or custom colour. Its FieldLogicHQ badge is unchanged.
 */
export function publicFrameRoles(org: FrameOrg, tournament?: FrameTournament | null): PublicFrameRoles {
  if (!canUseAdvancedTournamentBranding(org)) {
    return {
      fill: CLUB_NEAR_BLACK, onFill: WHITE, ink: CLUB_NEAR_BLACK, edge: CLUB_NEAR_BLACK, accent: CLUB_NEAR_BLACK,
      mark: WHITE, tile: WHITE, tileInk: CLUB_NEAR_BLACK, darkened: false, neutral: true,
    };
  }
  const own = !!(tournament?.themePreset || tournament?.themePrimary);
  const source = own ? tournament! : org;
  return { ...clubColourRoles(source.themePreset, source.themePrimary, source.themeAccent), neutral: false };
}

/**
 * The roles as the club frame's own variable names, so the tournament wears the club site's token block (the ONE light
 * set, components/public/ClubFrame.module.css `.tokens`) with its own colour in it. Written on <html> for the frame only,
 * which outranks the org layout's `:root` block: the app's own phone bar is mounted outside the tournament's markup and
 * reads them too.
 */
export function publicFrameRoleVars(roles: PublicFrameRoles): string {
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

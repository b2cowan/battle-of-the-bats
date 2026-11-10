import type { UserAccessContextKind } from './user-contexts';

/**
 * The ONE kind→label vocabulary for workspace chrome (Nav Unification /simplify 2026-07-31).
 * Deliberately dependency-free so BOTH sides can import it: lib/user-contexts (server — builds
 * the Workspaces-popover doors) and client components (Home's workspace cards). Renaming a
 * family label happens here, once. (The type import above is erased at compile time, so this
 * module pulls nothing server-only into the client bundle.)
 */
export const WORKSPACE_KIND_LABEL: Record<UserAccessContextKind, string> = {
  organization: 'Admin Area',
  tournament_official: 'Tournament',
  coaches_basic: 'Coaches Portal',
  coaches_premium: 'Coaches Portal',
  house_league_coach: 'Team page',
  fan: 'Following',
};

/**
 * ⚖ THE ADMIN STRIP'S PORTAL WORD (owner 2026-11-09, navigation Phase 1; replaced D4's "Admin" of 2026-11-08): the word
 * over the sidebar names which portal you are in — "Club" on the club's screens, "Events" on a tournament's screens and
 * on a tournament-only organization's ("Tournament" measured 246px against the 240px cell; /marketing confirmed "Events"
 * 2026-11-09). The Coaches Portal's "Coach" waits for its own strip (Phase 4). The Workspaces list, Home's cards, the
 * account pages' way back and the coaches portal keep "Admin Area" (they have the room). All the words live here, beside
 * each other, so none is retyped. Decided from the ADDRESS, so the server's first paint already says it.
 */
export const ADMIN_STRIP_WORD = { club: 'Club', events: 'Events' } as const;

/** The word for a screen: "Events" anywhere under `/{org}/admin/tournaments` or in a tournament-only organization. */
export function adminStripWord({ onTournaments, tournamentOnly }: { onTournaments: boolean; tournamentOnly: boolean }): string {
  return onTournaments || tournamentOnly ? ADMIN_STRIP_WORD.events : ADMIN_STRIP_WORD.club;
}

/**
 * The platform admin's portal name (owner 2026-10-24, Support console Stage 1, Ask 1): the strip, the browser tab
 * and the sign-in page read this one word. It is not a `UserAccessContextKind` (staff hold no workspace), so it
 * lives beside the kinds instead of in the record.
 */
export const PLATFORM_PORTAL_LABEL = 'Support console';

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
 * The admin's portal word in its top strip (Admin header bar round 4, D4, owner 2026-11-08): the short form of
 * `WORKSPACE_KIND_LABEL.organization`, because the strip's left cell is the sidebar's width (240, 64 collapsed). The
 * Workspaces list, Home's cards, the account pages' way back and the coaches portal's door keep "Admin Area" (they have
 * the room; the owner's gate answer, 2026-11-08). Both words live here, beside each other, so neither is retyped.
 */
export const ADMIN_STRIP_LABEL = 'Admin';

/**
 * The platform admin's portal name (owner 2026-10-24, Support console Stage 1, Ask 1): the strip, the browser tab
 * and the sign-in page read this one word. It is not a `UserAccessContextKind` (staff hold no workspace), so it
 * lives beside the kinds instead of in the record.
 */
export const PLATFORM_PORTAL_LABEL = 'Support console';

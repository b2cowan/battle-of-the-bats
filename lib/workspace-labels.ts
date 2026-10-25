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
  fan: 'Following',
};

/**
 * The platform admin's portal name (owner 2026-10-24, Support console Stage 1, Ask 1): the strip, the browser tab
 * and the sign-in page read this one word. It is not a `UserAccessContextKind` (staff hold no workspace), so it
 * lives beside the kinds instead of in the record.
 */
export const PLATFORM_PORTAL_LABEL = 'Support console';

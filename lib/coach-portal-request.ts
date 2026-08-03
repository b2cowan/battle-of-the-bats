import 'server-only';
import { cache } from 'react';
import { getAuthContext } from './api-auth';
import { getCoachingAssignmentsForUser, getClosedCoachingAssignmentsForUser } from './db';
import { resolveOrgHomeHref } from './module-entitlements';

/**
 * Request-scoped reads shared by the TWO server layouts of the premium portal.
 *
 * Why this exists: the portal layout (`/[orgSlug]/coaches`) resolves the coach's identity,
 * assignments and public-site door for the shell; the team layout
 * (`/[orgSlug]/coaches/teams/[teamId]`) needs the same three facts to build the masthead's
 * status feed. On a HARD load both render in one request, so without `cache()` every team page
 * would pay for that work twice. On a soft navigation only the team layout renders — there is
 * nothing to share and nothing is wasted either way.
 *
 * ⚠ Every wrapper takes PRIMITIVE arguments. `cache()` keys on argument identity, so passing the
 * usual `{ isTeamWorkspace }` options object would mint a fresh key per call and dedupe nothing.
 * The one exception is the org below, which is deliberately the SAME object instance both callers
 * already hold (it comes from `getCoachPortalAuth`, itself cached).
 */

/** The portal's auth gate. Null ⇒ not signed in / not a member of this org. */
export const getCoachPortalAuth = cache((orgSlug: string) => getAuthContext({ orgSlug }));

/** Assignments on the team's LIVE (draft/active) seasons. */
export const getCoachPortalAssignments = cache(
  (orgId: string, userId: string, isTeamWorkspace: boolean) =>
    getCoachingAssignmentsForUser(orgId, userId, { isTeamWorkspace }),
);

/** Assignments on completed/archived seasons — every one, undeduped (the switcher's list). */
export const getCoachPortalClosedAssignments = cache(
  (orgId: string, userId: string, isTeamWorkspace: boolean) =>
    getClosedCoachingAssignmentsForUser(orgId, userId, { isTeamWorkspace }),
);

/**
 * The masthead's "Public site" flip target, or null when this org has no real public page.
 *
 * ⚠ `.catch(() => null)`: the resolver runs an uncaught DB count and this sits on the portal's
 * critical path — a query blip must cost the flip pill, never a 500 (/review 2026-08-02).
 */
export const getCoachPortalPublicHref = cache(
  (org: Parameters<typeof resolveOrgHomeHref>[0]) => resolveOrgHomeHref(org).catch(() => null),
);

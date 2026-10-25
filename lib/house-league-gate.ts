import 'server-only';
import { NextResponse } from 'next/server';
import { forbidden, unauthorized, type AuthContextWithRole } from './api-auth';
import { houseLeagueAccess, type HouseLeagueAction } from './house-league-access';
import type { LeagueSeasonStatus } from './types';

/**
 * The route half of the one house-league gate (`lib/house-league-access.ts` holds the rules). Every route under
 * `app/api/admin/house-league/**` refuses through this and names no role (tests/unit/house-league-gate-guard.test.ts).
 */

/** Said when the person could do this on a live season, but this season is finished (Q16). */
export const FINISHED_SEASON_REFUSAL = 'This season is finished. Reopen it to change it.';

/**
 * null when the member may take this action (on this season, if given); otherwise the response to send. A null ctx is
 * the signed-out case, so a route can call this straight after `getAuthContextWithRole`.
 */
export function houseLeagueRefusal(
  ctx: AuthContextWithRole | null,
  action: HouseLeagueAction,
  season?: { status: LeagueSeasonStatus | string } | null,
): Response | null {
  if (!ctx) return unauthorized();
  if (houseLeagueAccess(ctx, ctx.org, season)[action]) return null;
  // Allowed on a live season, refused because this one is finished: say so, so the screen can say why.
  if (season && houseLeagueAccess(ctx, ctx.org, null)[action]) {
    return NextResponse.json({ error: FINISHED_SEASON_REFUSAL, finished: true }, { status: 409 });
  }
  return forbidden();
}

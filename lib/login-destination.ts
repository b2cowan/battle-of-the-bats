/**
 * WHERE SIGNING IN LANDS WHEN THE PERSON ARRIVED WITH A `next` (small fixes from the on-sale doors walk, call C5).
 *
 * The rule has always been: honour `next` only for a person who holds a workspace, because a person with none (a fan, a
 * waiting invitee) could be sent to an admin page they cannot open and bounce back to sign-in forever (J8-018).
 * ⚠ That is also exactly who starts a club or a league: signed in with no organization yet. So `/auth/login?next=/start/club`
 * landed them on Home. The fix is an explicit allow-list of the start doors, honoured without a workspace. It is a list,
 * not the removal of the workspace rule: a start door is a page every signed-in person can open, so it cannot trap anyone.
 *
 * Pure and client-safe (the sign-in page is a client page).
 */
import { safeNextPath } from './safe-redirect.ts';

/** The start pages: the picker and its four doors. Every one opens for any signed-in person. */
export const START_DOOR_NEXT_PATHS: readonly string[] = [
  '/start',
  '/start/club',
  '/start/league',
  '/start/tournament',
  '/start/team',
];

/** A recovery destination wins over any `next`: a suspended member is shown why, not sent on to a start door. */
const RECOVERY_DESTINATIONS = new Set(['/auth/suspended', '/auth/login']);

/** `next`, when it is a safe same-site path to one of the start doors (a query such as `?plan=club` is kept). */
export function startDoorNext(next: string | null | undefined): string | null {
  const safe = safeNextPath(next ?? null, null);
  if (!safe) return null;
  const pathname = safe.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  return START_DOOR_NEXT_PATHS.includes(pathname) ? safe : null;
}

/**
 * Where a signed-in person goes: their own `next` if they hold a workspace, a start door's `next` even if they do not,
 * otherwise the resolved destination.
 */
export function chooseLoginDestination(p: { next: string | null | undefined; destination: string; hasWorkspace: boolean }): string {
  const safeNext = safeNextPath(p.next ?? null, null);
  if (safeNext && p.hasWorkspace) return safeNext;
  const door = startDoorNext(p.next);
  if (door && !RECOVERY_DESTINATIONS.has(p.destination)) return door;
  return p.destination;
}

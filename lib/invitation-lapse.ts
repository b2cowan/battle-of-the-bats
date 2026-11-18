/**
 * ⚖ AN UNACCEPTED INVITATION RUNS OUT (Board Ready trust close-out 13, open call (b), owner ruling 2026-11-18, queue P2c).
 *
 * A club invitation waits 30 days from when it was last SENT (a Resend restarts the clock). After that it has run out:
 * it holds no seat, is not on Home, cannot be accepted at either door, and Members shows it as run out with Resend and
 * Cancel. A run-out invitation is removed by the nightly sweep once it has been run out for a further 30 days, so a club
 * that comes back to Members can still revive it for a while.
 *
 * Both kinds of pending invitation share the rule, each by its own "last sent" date:
 *   - a pending row (`status = 'invited'`): `invited_at` (stamped on send and on every resend);
 *   - a board role waiting on a club's coach (P2b, lib/waiting-board-role.ts): `pending_invited_at`.
 *
 * Lapsing is read at use: nothing writes a "lapsed" status. Every door that offers, counts or accepts a pending
 * invitation asks this module, so Home, the badge, both accept doors, the seat count and Members can never disagree.
 */

export const INVITATION_LIFETIME_DAYS = 30;
/** How long a run-out invitation stays on Members (revivable by Resend) before the nightly sweep removes it. */
export const LAPSED_INVITATION_KEPT_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The earliest "last sent" instant that is still live, as ISO. A row sent before this has run out. */
export function invitationLapseCutoff(now: Date = new Date()): string {
  return new Date(now.getTime() - INVITATION_LIFETIME_DAYS * DAY_MS).toISOString();
}

/** The "last sent" instant before which a run-out invitation is removed by the nightly sweep, as ISO. */
export function invitationPurgeCutoff(now: Date = new Date()): string {
  return new Date(now.getTime() - (INVITATION_LIFETIME_DAYS + LAPSED_INVITATION_KEPT_DAYS) * DAY_MS).toISOString();
}

/** Has an invitation last sent at `sentAt` run out? A missing date reads as run out (a doubt never offers a stale yes). */
export function invitationHasLapsed(sentAt: string | null | undefined, now: Date = new Date()): boolean {
  if (!sentAt) return true;
  const t = Date.parse(sentAt);
  return Number.isNaN(t) || t < Date.parse(invitationLapseCutoff(now));
}

/**
 * The LIVE pending-invitation read, as `.or(livePendingInvitationFilter())`: a pending row still inside its 30 days, or an
 * active coach row whose waiting board role is. `PENDING_INVITATION_FILTER` (lib/waiting-board-role.ts) is the same read
 * without the clock, for a door that must FIND a run-out one to answer it (the Home accept route refuses it by name).
 * tests/unit/invitation-lapse.test.ts keeps a list of every door that reads pending rows without the clock.
 */
export function livePendingInvitationFilter(now: Date = new Date()): string {
  const c = invitationLapseCutoff(now);
  return `and(status.eq.invited,invited_at.gte.${c}),and(status.eq.active,role.eq.coach,pending_role.not.is.null,pending_invited_at.gte.${c})`;
}

/** The refusal both accept doors give a run-out invitation. */
export function lapsedInvitationMessage(orgName: string | null | undefined): string {
  return `This invitation has run out. Ask ${orgName || 'the club'} to send it again.`;
}

/**
 * ⚖ A BOARD ROLE WAITING ON A COACH'S ROW (Board Ready trust close-out 13 P2b, owner ruling 2026-11-18, mig 503).
 *
 * A person who already coaches in a club holds its capability-less `coach` row (one row per person per club). A board role
 * offered to them waits in `pending_role` / `pending_capabilities` / `pending_invited_at` beside their coaching, which it
 * never touches, until they accept it on Home. Every door that meets one asks these three, so Members, Resend, Cancel,
 * Home's card, the badge, the sign-in landing and accept can never disagree about which rows carry one.
 */

/** The role waiting on this row, or null. Only an ACTIVE coach row offers one (a suspended person can't use it). */
export function waitingBoardRole(
  row: { role?: string | null; status?: string | null; pending_role?: string | null } | null | undefined,
): string | null {
  return row && row.role === 'coach' && row.status === 'active' && row.pending_role ? row.pending_role : null;
}

/** The pending-invitation read, as `.or(PENDING_INVITATION_FILTER)`: a pending row, or an active coach row with a role waiting. */
export const PENDING_INVITATION_FILTER = 'status.eq.invited,and(status.eq.active,role.eq.coach,pending_role.not.is.null)';

/** Ends a waiting board role (withdrawn, declined, accepted, or moot): every such write clears all three (mig 503's CHECK pairs them). */
export const WAITING_ROLE_CLEARED = { pending_role: null, pending_capabilities: null, pending_invited_at: null } as const;

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * IS A REMOVED MEMBER'S ACCOUNT KEPT? — the one decision behind Remove member (J4-036, J5-012; Stage 13 fix-now 2,
 * F-A5-10). Removing a member from a club deletes their sign-in ONLY when the account has no other use. Another use is:
 *   1. a membership in another organization;
 *   2. an active free (Basic) Coaches Portal team — org-less, so invisible to (1);
 *   3. a family connection — a parent's link to a child's team, anywhere (status not declined/revoked). A parent signs in
 *      to see their child; `family_links.user_id` is ON DELETE SET NULL, so deleting the account orphaned the link and
 *      locked the parent out (F-A5-10).
 *   4. an account its owner already had, invited and not yet joined. ⚖ Board Ready trust close-out 13 (owner 2026-11-18): an
 *      existing account is INVITED, never added on the spot, so a club can now hold a pending row on someone's own account.
 *      Cancelling that invitation must never delete the account it was sent to — the club did not make it. Only an account
 *      the invitation itself created (a new person who never joined) is deleted with its invitation, as before.
 *
 * PURE: the facts come from `readAccountKeepFacts` (lib/member-account-keep-server.ts), which the member route's GET (the
 * removal window's "Their account is kept" wording) and DELETE (what actually happens) both call, so the words and the
 * behaviour cannot drift.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

export interface AccountKeepFacts {
  /** Memberships in organizations other than this one. */
  otherOrgCount: number;
  /** Active free (Basic) Coaches Portal team memberships. */
  basicCoachTeamCount: number;
  /** Family connections (any club) that are not declined or revoked. */
  familyLinkCount: number;
  /** This club's row is a pending invitation sent to an account that already existed (4). Absent = false. */
  invitedOwnAccount?: boolean;
}

/** Why the account is kept — the first reason that holds, in the order above — or null: the account is deleted. */
export type AccountKeptReason = 'other_org' | 'basic_coach_portal' | 'family_link' | 'invited_own_account';

export function accountKeptReason(f: AccountKeepFacts): AccountKeptReason | null {
  if (f.otherOrgCount > 0) return 'other_org';
  if (f.basicCoachTeamCount > 0) return 'basic_coach_portal';
  if (f.familyLinkCount > 0) return 'family_link';
  if (f.invitedOwnAccount) return 'invited_own_account';
  return null;
}

/**
 * Is a pending row an invitation sent to an account that ALREADY EXISTED? The invite route marks one by leaving
 * `invited_email` empty (an existing account needs no re-attaching by email — its row already names it), and an account
 * its owner made themselves carries no auth `invited_at`. Either fact says "not made by this invitation"; both must be
 * absent before a pending row's account counts as the club's own stub. Errs toward keeping: a doubt never deletes.
 */
export function isInvitationToOwnAccount(row: { status: string; invited_email: string | null }, authInvitedAt: string | null | undefined): boolean {
  if (row.status !== 'invited') return false;
  return row.invited_email == null || !authInvitedAt;
}
